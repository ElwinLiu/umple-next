/**
 * LSP integration for the Umple CodeMirror editor.
 *
 * Bridges the browser to the lsp-proxy WebSocket server, which spawns one
 * umple-lsp-server process per model (session).
 *
 * Architecture:
 *   Browser (CodeMirror + @codemirror/lsp-client)
 *     ─ WebSocket (JSON-RPC) ─▶
 *   lsp-proxy (Node.js, port 9999)
 *     ─ stdio ─▶
 *   umple-lsp-server (one per session)
 */

import {
  LSPClient,
  LSPPlugin,
  Workspace,
  languageServerSupport,
  serverDiagnostics,
  type WorkspaceFile,
} from '@codemirror/lsp-client'
import { Compartment, StateEffect, Text, ChangeSet, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { useSessionStore, type Tab } from '../stores/sessionStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import { ensureUmpExt } from '../lib/umpFile'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LspConfig {
  /** WebSocket URL path (e.g. "/ws/lsp") or full ws:// URL */
  wsUrl: string
  /** Model ID (session directory name) */
  modelId: string
  /** Base path for model files on disk */
  umpBasePath: string
  /** Name of the currently active tab */
  activeTabName: string
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const lspCompartment = new Compartment()

let lspClient: LSPClient | null = null
let lspEnabled = false
let currentWorkspace: UmpleWorkspace | null = null
let currentTransport: { close: () => void } | null = null
let lspAppendedToEditor = false
let lspEditorView: EditorView | null = null
let lspInitPromise: Promise<boolean> | null = null

// Reconnection
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000]
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectCallback: (() => void) | null = null

function docFromString(content: string): Text {
  return Text.of((content || '').split('\n'))
}

function updateStoreTabCode(tabName: string, code: string) {
  useSessionStore.setState((state) => {
    let changed = false
    const tabs = state.tabs.map((tab) => {
      if (tab.name !== tabName || tab.code === code) return tab
      changed = true
      return {
        ...tab,
        code,
        dirty: code !== tab.savedCode,
      }
    })

    if (!changed) return state

    const activeTab = tabs.find((tab) => tab.id === state.activeTabId)
    return {
      tabs,
      ...(activeTab?.name === tabName ? { code } : {}),
    }
  })
}

function sendFullDocumentChange(client: LSPClient, file: WorkspaceFile) {
  // Re-open the file so the server gets the full updated content.
  // didClose + didOpen is the simplest way to sync a passive file.
  client.didClose(file.uri)
  client.didOpen(file)
}


// ---------------------------------------------------------------------------
// WebSocket transport (implements @codemirror/lsp-client Transport)
// ---------------------------------------------------------------------------

function createWebSocketTransport(wsUrl: string) {
  const handlers = new Set<(msg: string) => void>()
  let socket: WebSocket | null = null

  function connect(): Promise<void> {
    socket = new WebSocket(wsUrl)

    socket.onmessage = (event) => {
      const msg = typeof event.data === 'string' ? event.data : event.data.toString()
      for (const handler of handlers) {
        try { handler(msg) } catch (e) { console.error('[lsp] handler error:', e) }
      }
    }

    socket.onerror = () => {
      console.warn('[lsp] WebSocket error')
    }

    socket.onclose = (event) => {
      console.warn('[lsp] WebSocket closed:', event.code, event.reason)
      socket = null

      if (lspClient) lspClient.disconnect()
      if (lspAppendedToEditor && lspEditorView) {
        try {
          lspEditorView.dispatch({ effects: lspCompartment.reconfigure([]) })
        } catch { /* editor may be gone */ }
      }
      lspEnabled = false
      useEphemeralStore.getState().setLspConnected(false)

      const PERMANENT_CODES = new Set([4001, 4002])
      if (!PERMANENT_CODES.has(event.code)) {
        scheduleLspReconnect()
      }
    }

    return new Promise<void>((resolve, reject) => {
      socket!.onopen = () => resolve()
      socket!.onerror = () => reject(new Error('WebSocket connection failed'))
    })
  }

  const transport = {
    send(message: string) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      socket.send(message)
    },
    subscribe(handler: (msg: string) => void) { handlers.add(handler) },
    unsubscribe(handler: (msg: string) => void) { handlers.delete(handler) },
    close() {
      if (socket) {
        socket.onclose = null
        socket.close()
        socket = null
      }
    },
  }

  return { transport, connect }
}

// ---------------------------------------------------------------------------
// UmpleWorkspace — multi-file workspace adapter
// ---------------------------------------------------------------------------

/** Extended file entry with view and open-state tracking */
interface TrackedFile extends WorkspaceFile {
  _view: EditorView | null
  _lspOpen: boolean
}

class UmpleWorkspace extends Workspace {
  /** Tracked files persist across disconnect/reconnect cycles. */
  _files: TrackedFile[] = []
  _umpBasePath: string
  _modelId: string

  constructor(client: LSPClient, umpBasePath: string, modelId: string) {
    super(client)
    this._umpBasePath = umpBasePath
    this._modelId = modelId
  }

  get files(): WorkspaceFile[] { return this._files }

  _tabUri(tabName: string): string {
    const fileName = ensureUmpExt(tabName)
    return 'file://' + this._umpBasePath + '/' + this._modelId + '/' + encodeURIComponent(fileName)
  }

  getFile(uri: string): TrackedFile | null {
    const exact = this._files.find(f => f.uri === uri)
    if (exact) return exact
    const targetName = this._uriToTabName(uri)
    if (targetName) {
      return this._files.find(f => this._uriToTabName(f.uri) === targetName) ?? null
    }
    return null
  }

  syncFiles() {
    const updates: Array<{ changes: ChangeSet; file: TrackedFile; prevDoc: Text }> = []
    for (const file of this._files) {
      const view = file.getView()
      if (!view) continue
      const plugin = LSPPlugin.get(view)
      if (!plugin) continue
      const changes = plugin.unsyncedChanges
      if (!changes.empty) {
        updates.push({ changes, file, prevDoc: file.doc })
        file.doc = view.state.doc
        file.version++
        plugin.clear()
      }
    }
    return updates
  }

  openFile(uri: string, languageId: string, view: EditorView) {
    let file = this.getFile(uri)
    if (file) {
      const wasPassive = !file._view
      file._view = view
      file.doc = view.state.doc
      if (wasPassive && !file._lspOpen) {
        this.client.didOpen(file)
        file._lspOpen = true
      }
      return
    }
    const newFile: TrackedFile = {
      uri,
      languageId,
      version: 0,
      doc: view.state.doc,
      _view: view,
      _lspOpen: true,
      getView() { return this._view },
    }
    this._files.push(newFile)
    this.client.didOpen(newFile)
  }

  closeFile(uri: string, _view: EditorView) {
    const file = this.getFile(uri)
    if (!file) return
    // Don't close on the LSP server — keep all files open so cross-file
    // features (go-to-definition, find-references, rename) work across tabs.
    // Only detach the view; removeFile handles actual didClose.
    file._view = null
  }

  connected() {
    // Open ALL tracked files on the server (active + passive)
    for (const file of this._files) {
      this.client.didOpen(file)
      file._lspOpen = true
    }
  }

  requestFile(uri: string): Promise<WorkspaceFile | null> {
    return Promise.resolve(this.getFile(uri))
  }

  displayFile(uri: string): Promise<EditorView | null> {
    const tabName = this._uriToTabName(uri)
    if (!tabName) return Promise.resolve(null)

    const { tabs, activeTabId, setActiveTab } = useSessionStore.getState()
    const tab = tabs.find(t => t.name === tabName)
    if (!tab) return Promise.resolve(null)

    // Already on this tab — return current view
    if (tab.id === activeTabId) {
      const file = this.getFile(uri)
      return Promise.resolve(file?.getView() ?? null)
    }

    // Switch tab. The editor view stays alive (no remount) — React swaps
    // the document via the code prop and useLsp rebinds the LSP file.
    // Use requestAnimationFrame so React can flush the state update and
    // the document swap before we return the view.
    setActiveTab(tab.id)
    return new Promise<EditorView | null>((resolve) => {
      requestAnimationFrame(() => {
        resolve(lspEditorView)
      })
    })
  }

  updateFile(uri: string, update: TransactionSpec) {
    const file = this.getFile(uri)
    if (!file) return
    const view = file.getView()
    if (view) {
      view.dispatch(update)
    } else if (update.changes) {
      const changeSet = ChangeSet.of(update.changes as any, file.doc.length)
      const nextDoc = changeSet.apply(file.doc)
      file.doc = nextDoc
      file.version++
      const tabName = this._uriToTabName(uri)
      if (tabName) {
        updateStoreTabCode(tabName, nextDoc.toString())
      }
    }
  }

  addPassiveFile(tabName: string, content: string) {
    const uri = this._tabUri(tabName)
    if (this.getFile(uri)) return
    const file: TrackedFile = {
      uri,
      languageId: 'umple',
      version: 0,
      doc: docFromString(content),
      _view: null,
      _lspOpen: false,
      getView() { return null },
    }
    this._files.push(file)
    // Open on the LSP server so cross-file features work
    if (lspEnabled) {
      this.client.didOpen(file)
      file._lspOpen = true
    }
  }

  removeFile(tabName: string) {
    const uri = this._tabUri(tabName)
    const file = this.getFile(uri)
    if (!file) return
    if (file._view || file._lspOpen) {
      this.client.didClose(file.uri)
    }
    const idx = this._files.indexOf(file)
    if (idx !== -1) this._files.splice(idx, 1)
  }

  syncTab(tab: Tab) {
    const uri = this._tabUri(tab.name)
    const file = this.getFile(uri)
    if (!file) {
      this.addPassiveFile(tab.name, tab.code)
      return
    }

    if (file.getView()) return

    const nextCode = tab.code || ''
    if (file.doc.toString() === nextCode) return

    file.doc = docFromString(nextCode)
    file.version++

    if (!file._lspOpen && lspEnabled) {
      this.client.didOpen(file)
      file._lspOpen = true
      return
    }

    if (file._lspOpen) {
      sendFullDocumentChange(this.client, file)
    }
  }

  _uriToTabName(uri: string): string | null {
    const prefix = 'file://' + this._umpBasePath + '/' + this._modelId + '/'
    let encoded: string
    if (uri.startsWith(prefix)) {
      encoded = uri.slice(prefix.length)
    } else {
      encoded = uri.split('/').pop() || ''
    }
    if (!encoded) return null
    try {
      const decoded = decodeURIComponent(encoded)
      return decoded.endsWith('.ump') ? decoded : null
    } catch {
      return encoded.endsWith('.ump') ? encoded : null
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function buildWsUrl(baseUrl: string, modelId: string): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const fullBase = baseUrl.startsWith('/')
    ? proto + '//' + location.host + baseUrl
    : baseUrl
  const sep = fullBase.includes('?') ? '&' : '?'
  return fullBase + sep + 'session=' + encodeURIComponent(modelId)
}

/**
 * Attach LSP extensions to a (possibly new) editor view.
 * If the LSP client is already connected, this just reconfigures the
 * compartment on the new view — no new WebSocket connection is made.
 * This handles the case where UmpleEditor remounts on tab switch.
 */
export function attachLspToView(view: EditorView, activeTabName: string) {
  if (!lspClient || !lspEnabled || !currentWorkspace) return
  lspEditorView = view

  const activeUri = currentWorkspace._tabUri(activeTabName || 'Model')
  const lspExt = languageServerSupport(lspClient, activeUri, 'umple')

  // The old view was destroyed, so the compartment was lost. Re-append.
  lspAppendedToEditor = false
  view.dispatch({ effects: StateEffect.appendConfig.of(lspCompartment.of(lspExt)) })
  lspAppendedToEditor = true
}

export async function initLsp(view: EditorView, config: LspConfig): Promise<boolean> {
  if (!config.wsUrl || !config.modelId) return false

  // Already connected — just attach to the (possibly new) view
  if (lspEnabled && lspClient) {
    attachLspToView(view, config.activeTabName)
    return true
  }

  if (lspInitPromise) return lspInitPromise

  lspInitPromise = doInitLsp(view, config)
  lspInitPromise.finally(() => { lspInitPromise = null })
  return lspInitPromise
}

async function doInitLsp(view: EditorView, config: LspConfig): Promise<boolean> {
  lspEditorView = view

  const fullWsUrl = buildWsUrl(config.wsUrl, config.modelId)
  const { transport, connect } = createWebSocketTransport(fullWsUrl)
  currentTransport = { close: transport.close }

  const rootUri = 'file://' + config.umpBasePath + '/' + config.modelId
  lspClient = new LSPClient({
    rootUri,
    workspace: (client: LSPClient) => {
      currentWorkspace = new UmpleWorkspace(client, config.umpBasePath, config.modelId)
      return currentWorkspace
    },
    extensions: [serverDiagnostics()],
  })

  try {
    await connect()
    lspClient.connect(transport)
    await lspClient.initializing
    lspEnabled = true
    reconnectAttempt = 0
    useEphemeralStore.getState().setLspConnected(true)

    const activeUri = currentWorkspace!._tabUri(config.activeTabName || 'Model')
    const lspExt = languageServerSupport(lspClient, activeUri, 'umple')

    if (!lspAppendedToEditor) {
      view.dispatch({ effects: StateEffect.appendConfig.of(lspCompartment.of(lspExt)) })
      lspAppendedToEditor = true
    } else {
      view.dispatch({ effects: lspCompartment.reconfigure(lspExt) })
    }

    // Open all non-active tabs on the server for cross-file features
    const { tabs, activeTabId } = useSessionStore.getState()
    for (const tab of tabs) {
      if (tab.id !== activeTabId) {
        currentWorkspace!.addPassiveFile(tab.name, tab.code)
      }
    }

    return true
  } catch (err: any) {
    console.warn('[lsp] Connection failed:', err.message)
    lspEnabled = false
    return false
  }
}

export function disconnectLsp() {
  lspEnabled = false
  lspAppendedToEditor = false
  useEphemeralStore.getState().setLspConnected(false)
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (lspClient) { lspClient.disconnect(); lspClient = null }
  if (currentTransport) { currentTransport.close(); currentTransport = null }
  currentWorkspace = null
}

export function switchLspFile(view: EditorView, tabName: string) {
  if (!currentWorkspace || !lspClient || !lspEnabled) return
  const newUri = currentWorkspace._tabUri(tabName)
  view.dispatch({
    effects: lspCompartment.reconfigure(
      languageServerSupport(lspClient, newUri, 'umple')
    ),
  })
}

/**
 * Register a callback to be invoked when the LSP transport disconnects
 * and a reconnect attempt should be made. The host (e.g. useLsp hook)
 * calls initLsp again with fresh config.
 */
export function setLspReconnectCallback(cb: (() => void) | null) {
  reconnectCallback = cb
}

/**
 * Sync workspace with the current tabs from the store.
 * Call after tabs are added, removed, or renamed.
 */
export function syncLspTabs(tabs: Tab[]) {
  if (!currentWorkspace || !lspClient || !lspEnabled) return

  const trackedUris = new Set(currentWorkspace._files.map(f => f.uri))
  const currentUris = new Set(tabs.map(t => currentWorkspace!._tabUri(t.name)))

  // Add new files and keep detached file snapshots in sync with the store
  for (const tab of tabs) {
    currentWorkspace.syncTab(tab)
  }

  // Remove files no longer in tabs
  for (const uri of trackedUris) {
    if (!currentUris.has(uri)) {
      const name = currentWorkspace._uriToTabName(uri)
      if (name) currentWorkspace.removeFile(name)
    }
  }
}

// ---------------------------------------------------------------------------
// Reconnection
// ---------------------------------------------------------------------------

function scheduleLspReconnect() {
  if (reconnectAttempt >= RECONNECT_DELAYS.length) {
    console.warn('[lsp] Max reconnect attempts reached')
    return
  }
  const delay = RECONNECT_DELAYS[reconnectAttempt] || 8000
  reconnectAttempt++
  console.log(`[lsp] Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${RECONNECT_DELAYS.length})`)

  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    if (reconnectCallback) reconnectCallback()
  }, delay)
}

export const __testing = {
  UmpleWorkspace,
  resetState() {
    lspClient = null
    lspEnabled = false
    currentWorkspace = null
    currentTransport = null
    lspAppendedToEditor = false
    lspEditorView = null
    lspInitPromise = null
    reconnectAttempt = 0
    reconnectCallback = null
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  },
  setClientState(client: LSPClient | null, workspace: UmpleWorkspace | null, enabled: boolean) {
    lspClient = client
    currentWorkspace = workspace
    lspEnabled = enabled
  },
}

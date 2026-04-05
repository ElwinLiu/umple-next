/**
 * React hook that manages the LSP lifecycle for the Umple editor.
 *
 * - Fetches an auth token from the backend
 * - Connects to lsp-proxy when a model ID is available
 * - Re-attaches LSP to the editor view on tab switch (editor remount)
 * - Disconnects on unmount
 */

import { useEffect, useRef, useCallback } from 'react'
import type { EditorView } from '@codemirror/view'
import { useSessionStore } from '../stores/sessionStore'
import {
  initLsp,
  disconnectLsp,
  setLspReconnectCallback,
  switchLspFile,
  syncLspTabs,
} from '../codemirror/lsp'

const LSP_WS_PATH = '/ws/lsp'
// Must match the Docker volume mount path that both the backend and lsp-proxy
// use to read/write model files (see docker-compose.yml volumes).
const LSP_BASE_PATH = '/data/models'

export function useLsp(viewRef: React.RefObject<EditorView | null>) {
  const modelId = useSessionStore((s) => s.modelId)
  const activeTabName = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.name) ?? 'Model.ump'
  const tabs = useSessionStore((s) => s.tabs)
  const tabsVersion = useSessionStore((s) => s.tabsVersion)

  const modelIdRef = useRef(modelId)
  modelIdRef.current = modelId

  const doConnect = useCallback(async () => {
    const view = viewRef.current
    const mid = modelIdRef.current
    if (!view || !mid) return

    const { tabs, activeTabId: currentActiveId } = useSessionStore.getState()
    const activeTab = tabs.find(t => t.id === currentActiveId)

    initLsp(view, {
      wsUrl: LSP_WS_PATH,
      modelId: mid,
      umpBasePath: LSP_BASE_PATH,
      activeTabName: activeTab?.name || 'Model.ump',
    })
  }, [viewRef])

  // Connect when modelId becomes available
  useEffect(() => {
    if (!modelId) return
    // Small delay to let the editor mount
    const timer = setTimeout(doConnect, 500)
    return () => clearTimeout(timer)
  }, [modelId, doConnect])

  // When the active tab changes (switch or rename), rebind the LSP plugin
  // to the new file URI. The EditorView stays alive across tab switches.
  useEffect(() => {
    if (!modelId) return
    const view = viewRef.current
    if (!view) return
    switchLspFile(view, activeTabName)
  }, [activeTabName, modelId, viewRef])

  // Sync workspace files when tabs are added/removed/renamed
  useEffect(() => {
    if (!modelId) return
    syncLspTabs(tabs)
  }, [tabsVersion, modelId, tabs])

  // Set up reconnect callback; disconnect on unmount.
  // doConnect is stable (viewRef never changes), so cleanup only runs on unmount.
  useEffect(() => {
    setLspReconnectCallback(doConnect)
    return () => {
      setLspReconnectCallback(null)
      disconnectLsp()
    }
  }, [doConnect])
}

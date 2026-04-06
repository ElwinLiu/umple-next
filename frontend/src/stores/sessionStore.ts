import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'
import type { UmpleModel, GvLayout, StoredLayoutMetadata, ApiTab } from '../api/types'
import { useEphemeralStore } from './ephemeralStore'
import { ensureUmpExt } from '../lib/umpFile'

// ── Editor types ──

export interface Tab {
  id: string
  name: string
  code: string
  dirty: boolean
  /** Snapshot of code when tab was created or last saved */
  savedCode: string
}

// ── Diagram types ──

export type DiagramView = 'class' | 'state' | 'feature' | 'structure' | 'erd' | 'instance' | 'eventSequence' | 'stateTables' | 'crud'

/** Classifies each view by its backend output kind */
export const VIEW_OUTPUT_KIND: Record<DiagramView, 'gv' | 'html' | 'component'> = {
  class: 'gv', state: 'gv', feature: 'gv', structure: 'html',
  erd: 'gv', instance: 'gv',
  eventSequence: 'html', stateTables: 'html',
  crud: 'component',
}

interface DiagramElements {
  nodes: Node[]
  edges: Edge[]
}

const EMPTY_DIAGRAM_ELEMENTS: DiagramElements = { nodes: [], edges: [] }

// ── Chat types ──

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  parts?: unknown[]
}

// ── Constants ──

const MAX_UNDO = 50

const DEFAULT_CODE = ''

export function nextTabNumber(tabs: Array<{ name: string }>): number {
  const used = new Set(
    tabs
      .map((t) => t.name.match(/^untitled-(\d+)\.ump$/))
      .filter(Boolean)
      .map((m) => Number(m![1]))
  )
  let n = 1
  while (used.has(n)) n++
  return n
}

// ── Store ──

interface SessionState {
  // Editor
  code: string
  modelId: string | null
  tabs: Tab[]
  activeTabId: string
  undoStack: string[]
  redoStack: string[]
  selectedExample: string | null
  generateTargetId: string
  /** Set by setCodeFromSync so useCompiler can skip the debounce */
  syncPending: boolean
  /** Bumped on tab rename/reorder to trigger a compile that persists tabs.json */
  tabsVersion: number

  // Diagram content
  viewMode: DiagramView
  umpleModel: UmpleModel | null
  classLayout: GvLayout | null
  storedLayout: StoredLayoutMetadata | null
  diagramData: Partial<Record<DiagramView, DiagramElements>>
  svgCache: Partial<Record<DiagramView, string>>
  htmlCache: Partial<Record<DiagramView, string>>

  // Agent panel
  showAgentPanel: boolean
  chatMessages: ChatMessage[]

  // Editor actions
  setCode: (code: string) => void
  setCodeFromSync: (code: string) => void
  clearSyncPending: () => void
  undo: () => void
  redo: () => void
  setModelId: (id: string) => void
  markSaved: (id?: string) => void
  addTab: (tab: Omit<Tab, 'dirty' | 'savedCode'>) => void
  addNewTab: () => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  renameTab: (id: string, name: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  loadExample: (name: string, code: string, modelId?: string) => void
  closeOtherTabs: (id: string) => void
  restoreTabs: (tabs: ApiTab[], activeTabId: string) => void
  setSelectedExample: (name: string | null) => void
  setGenerateTargetId: (id: string) => void

  // Diagram actions
  setViewMode: (mode: DiagramView) => void
  setUmpleModel: (model: UmpleModel | null, layout?: GvLayout | null, storedLayout?: StoredLayoutMetadata | null) => void
  setDiagramData: (view: DiagramView, nodes: Node[], edges: Edge[]) => void
  getDiagramData: (view: DiagramView) => DiagramElements
setSvgForView: (view: DiagramView, svg: string) => void
  clearSvgCache: () => void
  setHtmlForView: (view: DiagramView, html: string) => void
  clearHtmlCache: () => void
  updateNodePosition: (id: string, x: number, y: number) => void
  addNode: (node: Node) => void
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
  renameNode: (oldId: string, newName: string) => void

  // Agent panel actions
  openAgentPanel: () => void
  closeAgentPanel: () => void
  toggleAgentPanel: () => void
  setChatMessages: (messages: ChatMessage[]) => void
}

/** Returns the active tab's filename, or 'Model.ump' if no tab is active. */
export function getActiveTabName(): string {
  const { tabs, activeTabId } = useSessionStore.getState()
  return tabs.find((t) => t.id === activeTabId)?.name ?? 'Model.ump'
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      // ── Editor state ──
      code: DEFAULT_CODE,
      modelId: null,
      tabs: [{ id: 'main', name: 'Model.ump', code: DEFAULT_CODE, dirty: false, savedCode: DEFAULT_CODE }],
      activeTabId: 'main',
      undoStack: [],
      redoStack: [],
      selectedExample: null,
      generateTargetId: 'Java',
      syncPending: false,
      tabsVersion: 0,

      // ── Diagram content ──
      viewMode: 'class',
      umpleModel: null,
      classLayout: null,
      storedLayout: null,
      diagramData: {},
      svgCache: {},
      htmlCache: {},

      // ── Agent panel ──
      showAgentPanel: false,
      chatMessages: [],

      // ── Editor actions ──

      setCode: (code) => set((s) => ({
        code,
        tabs: s.tabs.map((t) =>
          t.id === s.activeTabId
            ? { ...t, code, dirty: code !== t.savedCode }
            : t
        ),
      })),

      setCodeFromSync: (code) => set((s) => {
        if (code === s.code) return s
        return {
          code,
          syncPending: true,
          undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), s.code],
          redoStack: [],
          tabs: s.tabs.map((t) =>
            t.id === s.activeTabId
              ? { ...t, code, dirty: code !== t.savedCode }
              : t
          ),
        }
      }),

      clearSyncPending: () => set({ syncPending: false }),

      undo: () => set((s) => {
        if (s.undoStack.length === 0) return s
        const prev = s.undoStack[s.undoStack.length - 1]
        return {
          code: prev,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, s.code],
          tabs: s.tabs.map((t) =>
            t.id === s.activeTabId
              ? { ...t, code: prev, dirty: prev !== t.savedCode }
              : t
          ),
        }
      }),

      redo: () => set((s) => {
        if (s.redoStack.length === 0) return s
        const next = s.redoStack[s.redoStack.length - 1]
        return {
          code: next,
          undoStack: [...s.undoStack, s.code],
          redoStack: s.redoStack.slice(0, -1),
          tabs: s.tabs.map((t) =>
            t.id === s.activeTabId
              ? { ...t, code: next, dirty: next !== t.savedCode }
              : t
          ),
        }
      }),

      setModelId: (modelId) => set({ modelId }),

      markSaved: (id) => set((s) => {
        const targetId = id ?? s.activeTabId
        return {
          tabs: s.tabs.map((t) =>
            t.id === targetId ? { ...t, dirty: false, savedCode: t.code } : t
          ),
        }
      }),

      addTab: (tab) => set((s) => ({
        tabs: [...s.tabs, { ...tab, dirty: false, savedCode: tab.code }],
        activeTabId: tab.id,
        code: tab.code,
      })),

      addNewTab: () => set((s) => {
        const id = `tab-${Date.now()}`
        const name = `untitled-${nextTabNumber(s.tabs)}.ump`
        return {
          tabs: [...s.tabs, { id, name, code: '', dirty: false, savedCode: '' }],
          activeTabId: id,
          code: '',
        }
      }),

      removeTab: (id) => set((s) => {
        const remaining = s.tabs.filter((t) => t.id !== id)
        if (remaining.length === 0) return s

        if (s.activeTabId === id) {
          const removedIndex = s.tabs.findIndex((t) => t.id === id)
          const nextTab = remaining[Math.min(removedIndex, remaining.length - 1)]
          return {
            tabs: remaining,
            activeTabId: nextTab.id,
            code: nextTab.code,
            tabsVersion: s.tabsVersion + 1,
          }
        }
        return { tabs: remaining, tabsVersion: s.tabsVersion + 1 }
      }),

      setActiveTab: (activeTabId) => set((s) => {
        const updatedTabs = s.tabs.map((t) =>
          t.id === s.activeTabId ? { ...t, code: s.code } : t
        )
        const nextTab = updatedTabs.find((t) => t.id === activeTabId)
        if (!nextTab) return s
        return {
          tabs: updatedTabs,
          activeTabId,
          code: nextTab.code,
        }
      }),

      renameTab: (id, rawName) => set((s) => {
        const name = ensureUmpExt(rawName)
        const target = s.tabs.find((t) => t.id === id)
        if (!target || target.name === name) return s
        // Prevent duplicate tab names
        if (s.tabs.some((t) => t.id !== id && t.name === name)) return s
        return {
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
          tabsVersion: s.tabsVersion + 1,
        }
      }),

      reorderTabs: (fromIndex, toIndex) => set((s) => {
        if (fromIndex === toIndex) return s
        const newTabs = [...s.tabs]
        const [moved] = newTabs.splice(fromIndex, 1)
        newTabs.splice(toIndex, 0, moved)
        return { tabs: newTabs, tabsVersion: s.tabsVersion + 1 }
      }),

      setSelectedExample: (selectedExample) => set({ selectedExample }),
      setGenerateTargetId: (generateTargetId) => set({ generateTargetId }),

      loadExample: (name, code, modelId) => set((s) => ({
        code,
        selectedExample: name,
        ...(modelId ? { modelId } : {}),
        tabs: s.tabs.map((t) =>
          t.id === s.activeTabId
            ? { ...t, name: ensureUmpExt(name), code, dirty: false, savedCode: code }
            : t
        ),
      })),

      closeOtherTabs: (id) => set((s) => {
        const tab = s.tabs.find((t) => t.id === id)
        if (!tab) return s
        return {
          tabs: [tab],
          activeTabId: id,
          code: tab.code,
          tabsVersion: s.tabsVersion + 1,
        }
      }),

      restoreTabs: (tabs, activeTabId) => set(() => {
        const restored = tabs.map((t) => ({
          ...t,
          dirty: false,
          savedCode: t.code,
        }))
        const active = restored.find((t) => t.id === activeTabId) ?? restored[0]
        return {
          tabs: restored,
          activeTabId: active.id,
          code: active.code,
          undoStack: [],
          redoStack: [],
          selectedExample: null,
        }
      }),

      // ── Diagram actions ──

      setViewMode: (viewMode) => set({ viewMode }),

      setUmpleModel: (umpleModel, layout, storedLayout) => set((s) => {
        if (
          s.umpleModel === umpleModel &&
          (layout === undefined || s.classLayout === layout) &&
          (storedLayout === undefined || s.storedLayout === storedLayout)
        ) return s
        return {
          umpleModel,
          ...(layout !== undefined ? { classLayout: layout } : {}),
          ...(storedLayout !== undefined ? { storedLayout } : {}),
        }
      }),

      setDiagramData: (view, nodes, edges) =>
        set((s) => {
          const current = s.diagramData[view]
          if (current && current.nodes === nodes && current.edges === edges) return s
          return { diagramData: { ...s.diagramData, [view]: { nodes, edges } } }
        }),

      getDiagramData: (view): DiagramElements => get().diagramData[view] ?? EMPTY_DIAGRAM_ELEMENTS,

      setSvgForView: (view, svg) =>
        set((s) => ({ svgCache: { ...s.svgCache, [view]: svg } })),

      clearSvgCache: () => set({ svgCache: {} }),

      setHtmlForView: (view, html) =>
        set((s) => ({ htmlCache: { ...s.htmlCache, [view]: html } })),

      clearHtmlCache: () => set({ htmlCache: {} }),

      updateNodePosition: (id, x, y) =>
        set((s) => {
          const current = s.diagramData.class
          if (!current) return s
          return {
            diagramData: {
              ...s.diagramData,
              class: {
                ...current,
                nodes: current.nodes.map((n) =>
                  n.id === id ? { ...n, position: { x, y } } : n
                ),
              },
            },
          }
        }),

      addNode: (node) => set((s) => {
        const current = s.diagramData.class ?? EMPTY_DIAGRAM_ELEMENTS
        return {
          diagramData: {
            ...s.diagramData,
            class: { ...current, nodes: [...current.nodes, node] },
          },
        }
      }),

      removeNode: (id) => {
        set((s) => {
          const current = s.diagramData.class ?? EMPTY_DIAGRAM_ELEMENTS
          return {
            diagramData: {
              ...s.diagramData,
              class: {
                nodes: current.nodes.filter((n) => n.id !== id),
                edges: current.edges.filter((e) => e.source !== id && e.target !== id),
              },
            },
          }
        })
        // Clear ephemeral selection if the removed node was selected
        const eph = useEphemeralStore.getState()
        if (eph.selectedNodeId === id) eph.setSelectedNode(null)
      },

      removeEdge: (id) => {
        set((s) => {
          const current = s.diagramData.class ?? EMPTY_DIAGRAM_ELEMENTS
          return {
            diagramData: {
              ...s.diagramData,
              class: { ...current, edges: current.edges.filter((e) => e.id !== id) },
            },
          }
        })
        // Clear ephemeral selection if the removed edge was selected
        const eph = useEphemeralStore.getState()
        if (eph.selectedEdgeId === id) eph.setSelectedEdge(null)
      },

      renameNode: (oldId, newName) => set((s) => {
        const newId = `class-${newName}`
        return {
          diagramData: {
            ...s.diagramData,
            class: {
              nodes: (s.diagramData.class?.nodes ?? []).map((n) =>
                n.id === oldId
                  ? { ...n, id: newId, data: { ...n.data, name: newName } }
                  : n
              ),
              edges: (s.diagramData.class?.edges ?? []).map((e) => ({
                ...e,
                source: e.source === oldId ? newId : e.source,
                target: e.target === oldId ? newId : e.target,
              })),
            },
          },
        }
      }),

      // ── Agent panel actions ──

      openAgentPanel: () => set({ showAgentPanel: true }),
      closeAgentPanel: () => set({ showAgentPanel: false }),
      toggleAgentPanel: () => set((s) => ({ showAgentPanel: !s.showAgentPanel })),
      setChatMessages: (chatMessages) => set({ chatMessages }),
    }),
    {
      name: 'umple-session-v1',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        modelId: state.modelId,
        selectedExample: state.selectedExample,
        generateTargetId: state.generateTargetId,
        viewMode: state.viewMode,
        showAgentPanel: state.showAgentPanel,
        chatMessages: state.chatMessages,
      }),
    }
  )
)

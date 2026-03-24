import { create } from 'zustand'
import type { DiffPreviewState } from '@/ai/editPreview'
import type { GenerateResponse, GeneratedArtifact } from '../api/types'
import { useSessionStore } from './sessionStore'

/** Parse Umple JSON error string to count errors vs warnings.
 *  Umple severity: 1 = error, 2 = warning, 3 = warning */
function parseErrorCounts(raw: string | null | undefined): { errors: number; warnings: number } {
  if (!raw) return { errors: 0, warnings: 0 }
  try {
    const parsed = JSON.parse(raw)
    const results: { severity?: string }[] = parsed?.results ?? []
    let errors = 0
    let warnings = 0
    for (const r of results) {
      const sev = Number(r.severity)
      if (sev === 1) errors++
      else warnings++
    }
    return { errors, warnings }
  } catch {
    return { errors: 1, warnings: 0 }
  }
}

type OutputView = 'hidden' | 'strip' | 'panel'

interface EphemeralState {
  // Layout
  showEditor: boolean
  showTaskPanel: boolean
  outputView: OutputView
  commandPaletteOpen: boolean
  diagramOnly: boolean
  rightPanelView: 'diagram' | 'generated'

  // Execution
  executing: boolean
  executionOutput: string
  executionErrors: string | null
  outputErrorCount: number
  outputWarningCount: number

  // Code generation
  generatedCode: string
  generatedHtml: string
  generatedKind: 'text' | 'html' | 'iframe'
  generatedIframeUrl: string | null
  generatedDownloads: GeneratedArtifact[]
  generatedTargetId: string
  generatedLanguage: string
  generatingCode: boolean
  generatedError: string | null
  generationRequested: boolean

  // Diagram ephemeral
  renderMode: 'reactflow' | 'graphviz'
  selectedNodeId: string | null
  selectedEdgeId: string | null
  editingNodeId: string | null
  editingField: 'name' | 'newAttribute' | 'newMethod' | null
  compiling: boolean
  lastError: string | null

  // Editor ephemeral
  diffPreview: DiffPreviewState | null
  selection: { fromLine: number; toLine: number; text: string; coords?: { x: number; yTop: number; yBottom: number } } | null

  // Agent message queue
  pendingAgentMessage: string | null

  // Layout actions
  toggleEditor: () => void
  toggleTaskPanel: () => void
  setOutputView: (view: OutputView) => void
  toggleOutputPanel: () => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  setDiagramOnly: (v: boolean) => void
  setRightPanelView: (view: 'diagram' | 'generated') => void

  // Execution actions
  setExecuting: (executing: boolean) => void
  setExecutionOutput: (output: string, errors?: string | null) => void

  // Code generation actions
  setGeneratedOutput: (result: GenerateResponse, targetId: string) => void
  setGeneratingCode: (generating: boolean) => void
  setGeneratedError: (error: string | null) => void
  clearGenerated: () => void

  // Diagram ephemeral actions
  setRenderMode: (mode: 'reactflow' | 'graphviz') => void
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  setEditing: (nodeId: string | null, field: 'name' | 'newAttribute' | 'newMethod' | null) => void
  setCompiling: (compiling: boolean) => void
  setLastError: (error: string | null) => void

  // Editor ephemeral actions
  showDiffPreview: (preview: DiffPreviewState) => void
  clearDiffPreview: (toolCallId?: string) => void
  setSelection: (sel: EphemeralState['selection']) => void

  // Agent message queue actions
  queueAgentMessage: (msg: string) => void
  consumeAgentMessage: () => string | null
}

export const useEphemeralStore = create<EphemeralState>((set, get) => ({
  // Layout
  showEditor: true,
  showTaskPanel: false,
  outputView: 'hidden',
  commandPaletteOpen: false,
  diagramOnly: false,
  rightPanelView: 'diagram',

  // Execution
  executing: false,
  executionOutput: '',
  executionErrors: null,
  outputErrorCount: 0,
  outputWarningCount: 0,

  // Code generation
  generatedCode: '',
  generatedHtml: '',
  generatedKind: 'text',
  generatedIframeUrl: null,
  generatedDownloads: [],
  generatedTargetId: 'Java',
  generatedLanguage: 'Java',
  generatingCode: false,
  generatedError: null,
  generationRequested: false,

  // Diagram ephemeral
  renderMode: 'reactflow',
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,
  editingField: null,
  compiling: false,
  lastError: null,

  // Editor ephemeral
  diffPreview: null,
  selection: null,

  // Agent message queue
  pendingAgentMessage: null,

  // Layout actions
  toggleEditor: () => set((s) => ({ showEditor: !s.showEditor })),
  toggleTaskPanel: () => set((s) => ({ showTaskPanel: !s.showTaskPanel })),
  setOutputView: (outputView) => set({ outputView }),
  toggleOutputPanel: () => set((s) => ({ outputView: s.outputView === 'hidden' ? 'panel' : 'hidden' })),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  setDiagramOnly: (diagramOnly) => set({ diagramOnly, showEditor: !diagramOnly }),
  setRightPanelView: (rightPanelView) => set({ rightPanelView }),

  // Execution actions
  setExecuting: (executing) => set({ executing }),
  setExecutionOutput: (executionOutput, executionErrors = null) => {
    const { errors, warnings } = parseErrorCounts(executionErrors)
    const showAgentPanel = useSessionStore.getState().showAgentPanel
    set((s) => ({
      executionOutput,
      executionErrors,
      outputErrorCount: errors,
      outputWarningCount: warnings,
      ...(errors > 0 && !showAgentPanel ? { outputView: 'panel' as const } : {}),
    }))
  },

  // Code generation actions
  setGeneratedOutput: (result, generatedTargetId) =>
    set({
      generatedCode: result.output ?? '',
      generatedHtml: result.html ?? '',
      generatedKind: result.kind ?? (result.iframeUrl ? 'iframe' : result.html ? 'html' : 'text'),
      generatedIframeUrl: result.iframeUrl ?? null,
      generatedDownloads: result.downloads ?? [],
      generatedTargetId,
      generatedLanguage: result.language,
      rightPanelView: 'generated',
      generatedError: result.errors ?? null,
    }),
  setGeneratingCode: (generatingCode) => set(generatingCode
    ? { generatingCode, generationRequested: true, rightPanelView: 'generated' }
    : { generatingCode }
  ),
  setGeneratedError: (generatedError) => set({ generatedError }),
  clearGenerated: () => set({
    generatedCode: '',
    generatedHtml: '',
    generatedKind: 'text',
    generatedIframeUrl: null,
    generatedDownloads: [],
    generatedError: null,
    rightPanelView: 'diagram',
    generationRequested: false,
  }),

  // Diagram ephemeral actions
  setRenderMode: (renderMode) => set({ renderMode }),
  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
  setSelectedEdge: (selectedEdgeId) => set({ selectedEdgeId }),
  setEditing: (editingNodeId, editingField) => set({ editingNodeId, editingField }),
  setCompiling: (compiling) => set({ compiling }),
  setLastError: (lastError) => set({ lastError }),

  // Editor ephemeral actions
  showDiffPreview: (diffPreview) => set({ diffPreview }),
  clearDiffPreview: (toolCallId) => set((s) => {
    if (toolCallId && s.diffPreview?.toolCallId !== toolCallId) return s
    return { diffPreview: null }
  }),
  setSelection: (selection) => set({ selection }),

  // Agent message queue actions
  queueAgentMessage: (msg) => set({ pendingAgentMessage: msg }),
  consumeAgentMessage: (): string | null => {
    const msg = get().pendingAgentMessage
    if (msg) set({ pendingAgentMessage: null })
    return msg
  },
}))

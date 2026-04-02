import { create } from 'zustand'
import type { DiffPreviewState } from '@/ai/editPreview'
import type { GenerateResponse, GeneratedArtifact } from '../api/types'
import { useSessionStore } from './sessionStore'
import { usePreferencesStore } from './preferencesStore'

export interface ParsedIssue {
  severity: number
  errorCode: string
  message: string
  line: number
  filename: string
  url: string
}

/** Parse raw error string (possibly multiple JSON objects joined by newlines)
 *  into deduplicated, structured issues.
 *  Umple severity: 1-2 = error, 3-5 = warning. */
function parseIssuesAndRaw(raw: string | null | undefined): {
  issues: ParsedIssue[]
  rawText: string
  errors: number
  warnings: number
} {
  if (!raw) return { issues: [], rawText: '', errors: 0, warnings: 0 }

  const allResults: ParsedIssue[] = []
  const rawLines: string[] = []

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed)
      const results = parsed?.results
      if (Array.isArray(results)) {
        for (const r of results) {
          allResults.push({
            severity: Number(r.severity ?? 1),
            errorCode: String(r.errorCode ?? ''),
            message: String(r.message ?? ''),
            line: Number(r.line ?? 0),
            filename: String(r.filename ?? ''),
            url: String(r.url ?? ''),
          })
        }
      } else {
        rawLines.push(trimmed)
      }
    } catch {
      rawLines.push(trimmed)
    }
  }

  // Deduplicate by errorCode + line + message
  const seen = new Set<string>()
  const unique: ParsedIssue[] = []
  for (const issue of allResults) {
    const key = `${issue.errorCode}:${issue.line}:${issue.message}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(issue)
    }
  }

  // Sort: errors first (severity 1-2), then warnings (3-5), then by line number
  unique.sort((a, b) => {
    const aIsErr = a.severity <= 2 ? 0 : 1
    const bIsErr = b.severity <= 2 ? 0 : 1
    if (aIsErr !== bIsErr) return aIsErr - bIsErr
    return a.line - b.line
  })

  const rawText = rawLines.join('\n')
  const errCount = unique.filter((i) => i.severity <= 2).length + (rawText && !unique.length ? 1 : 0)
  const warnCount = unique.filter((i) => i.severity > 2).length

  return { issues: unique, rawText, errors: errCount, warnings: warnCount }
}

type OutputView = 'hidden' | 'strip' | 'panel'

interface EphemeralState {
  // Layout
  showEditor: boolean
  outputView: OutputView
  commandPaletteOpen: boolean
  diagramOnly: boolean
  rightPanelView: 'diagram' | 'generated'

  // Execution
  executing: boolean
  executionOutput: string
  executionErrors: string | null
  parsedIssues: ParsedIssue[]
  rawErrorText: string
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
  renderMode: 'editable' | 'graphviz'
  selectedNodeId: string | null
  selectedEdgeId: string | null
  editingNodeId: string | null
  editingField: 'name' | 'newAttribute' | 'newMethod' | null
  compiling: boolean

  // Editor ephemeral
  diffPreview: DiffPreviewState | null
  selection: { fromLine: number; toLine: number; text: string; coords?: { x: number; yTop: number; yBottom: number } } | null

  // Agent message queue
  pendingAgentMessage: string | null

  // Onboarding tour
  tourStep: number | null
  startTour: () => void
  setTourStep: (step: number | null) => void
  finishTour: () => void

  // Layout actions
  toggleEditor: () => void
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
  setGeneratingCode: (generating: boolean, targetId?: string) => void
  setGeneratedError: (error: string | null) => void
  clearGenerated: () => void

  // Diagram ephemeral actions
  setRenderMode: (mode: 'editable' | 'graphviz') => void
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  setEditing: (nodeId: string | null, field: 'name' | 'newAttribute' | 'newMethod' | null) => void
  setCompiling: (compiling: boolean) => void


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
  outputView: 'hidden',
  commandPaletteOpen: false,
  diagramOnly: false,
  rightPanelView: 'diagram',

  // Execution
  executing: false,
  executionOutput: '',
  executionErrors: null,
  parsedIssues: [],
  rawErrorText: '',
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
  renderMode: 'graphviz',
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,
  editingField: null,
  compiling: false,

  // Editor ephemeral
  diffPreview: null,
  selection: null,

  // Agent message queue
  pendingAgentMessage: null,

  // Onboarding tour
  tourStep: null,
  startTour: () => {
    usePreferencesStore.getState().dismissWelcome()
    set({ tourStep: 0 })
  },
  setTourStep: (tourStep) => set({ tourStep }),
  finishTour: () => set({ tourStep: null }),

  // Layout actions
  toggleEditor: () => set((s) => ({ showEditor: !s.showEditor })),
  setOutputView: (outputView) => set({ outputView }),
  toggleOutputPanel: () => set((s) => ({ outputView: s.outputView === 'hidden' ? 'panel' : 'hidden' })),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  setDiagramOnly: (diagramOnly) => set({ diagramOnly, showEditor: !diagramOnly }),
  setRightPanelView: (rightPanelView) => set({ rightPanelView }),

  // Execution actions
  setExecuting: (executing) => set({ executing }),
  setExecutionOutput: (executionOutput, executionErrors = null) => {
    const { issues, rawText, errors, warnings } = parseIssuesAndRaw(executionErrors)
    const showAgentPanel = useSessionStore.getState().showAgentPanel
    set((s) => ({
      executionOutput,
      executionErrors,
      parsedIssues: issues,
      rawErrorText: rawText,
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
  setGeneratingCode: (generatingCode, targetId) => set(generatingCode
    ? { generatingCode, generationRequested: true, rightPanelView: 'generated', ...(targetId ? { generatedTargetId: targetId } : {}) }
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

import { create } from 'zustand'

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
    // Not JSON — treat the whole string as a single error
    return { errors: 1, warnings: 0 }
  }
}

type OutputView = 'hidden' | 'strip' | 'panel'

interface UiState {
  showEditor: boolean
  showSidebar: boolean
  sidebarWidth: number
  showTaskPanel: boolean
  outputView: OutputView
  showAgentPanel: boolean
  executionOutput: string
  executionErrors: string | null
  /** Parsed error/warning counts from Umple JSON error output */
  outputErrorCount: number
  outputWarningCount: number
  theme: 'light' | 'dark' | 'system'

  // Progressive disclosure
  commandPaletteOpen: boolean
  rightPanelView: 'diagram' | 'generated'
  diagramOnly: boolean
  generatedCode: string
  generatedLanguage: string
  generatingCode: boolean
  generatedError: string | null
  generationRequested: boolean

  toggleEditor: () => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleTaskPanel: () => void
  setOutputView: (view: OutputView) => void
  toggleOutputPanel: () => void
  openAgentPanel: () => void
  closeAgentPanel: () => void
  toggleAgentPanel: () => void
  setExecutionOutput: (output: string, errors?: string | null) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  openCommandPalette: () => void
  closeCommandPalette: () => void
  setRightPanelView: (view: 'diagram' | 'generated') => void
  setDiagramOnly: (v: boolean) => void
  setGeneratedOutput: (code: string, language: string) => void
  setGeneratingCode: (generating: boolean) => void
  setGeneratedError: (error: string | null) => void
  clearGenerated: () => void
}

const SIDEBAR_KEY = 'umple:sidebar'

function loadSidebarPref(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY)
    if (v === 'true' || v === 'false') return v === 'true'
  } catch { /* SSR / private browsing */ }
  return true // default: expanded
}

export const useUiStore = create<UiState>((set) => ({
  showEditor: true,
  showSidebar: loadSidebarPref(),
  sidebarWidth: 280,
  showTaskPanel: false,
  outputView: 'hidden',
  showAgentPanel: false,
  executionOutput: '',
  executionErrors: null,
  outputErrorCount: 0,
  outputWarningCount: 0,
  theme: 'system',

  commandPaletteOpen: false,
  rightPanelView: 'diagram',
  diagramOnly: false,
  generatedCode: '',
  generatedLanguage: 'Java',
  generatingCode: false,
  generatedError: null,
  generationRequested: false,

  toggleEditor: () => set((s) => ({ showEditor: !s.showEditor })),
  toggleSidebar: () => set((s) => {
    const next = !s.showSidebar
    try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch { /* noop */ }
    return { showSidebar: next }
  }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: Math.min(480, Math.max(200, sidebarWidth)) }),
  toggleTaskPanel: () => set((s) => ({ showTaskPanel: !s.showTaskPanel })),
  setOutputView: (outputView) => set({ outputView }),
  toggleOutputPanel: () => set((s) => ({ outputView: s.outputView === 'hidden' ? 'panel' : 'hidden' })),
  openAgentPanel: () => set({ showAgentPanel: true }),
  closeAgentPanel: () => set({ showAgentPanel: false }),
  toggleAgentPanel: () => set((s) => ({ showAgentPanel: !s.showAgentPanel })),
  setExecutionOutput: (executionOutput, executionErrors = null) => {
    const { errors, warnings } = parseErrorCounts(executionErrors)
    set((s) => ({
      executionOutput,
      executionErrors,
      outputErrorCount: errors,
      outputWarningCount: warnings,
      // Auto-expand to full panel on errors (unless the agent panel is active).
      ...(errors > 0 && !s.showAgentPanel ? { outputView: 'panel' as const } : {}),
    }))
  },
  setTheme: (theme) => set({ theme }),

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  setRightPanelView: (rightPanelView) => set({ rightPanelView }),
  setDiagramOnly: (diagramOnly) => set({ diagramOnly, showEditor: !diagramOnly }),
  setGeneratedOutput: (generatedCode, generatedLanguage) =>
    set({ generatedCode, generatedLanguage, rightPanelView: 'generated', generatedError: null }),
  setGeneratingCode: (generatingCode) => set(generatingCode
    ? { generatingCode, generationRequested: true, rightPanelView: 'generated' }
    : { generatingCode }
  ),
  setGeneratedError: (generatedError) => set({ generatedError }),
  clearGenerated: () => set({ generatedCode: '', generatedError: null, rightPanelView: 'diagram', generationRequested: false }),
}))

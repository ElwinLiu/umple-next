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

interface UiState {
  showEditor: boolean
  showSidebar: boolean
  sidebarWidth: number
  showTaskPanel: boolean
  showAiPanel: boolean
  showExecutionPanel: boolean
  executionOutput: string
  executionErrors: string | null
  /** Parsed error/warning counts from Umple JSON error output */
  outputErrorCount: number
  outputWarningCount: number
  theme: 'light' | 'dark' | 'system'

  // Diagram display preferences
  showAttributes: boolean
  showMethods: boolean
  showActions: boolean
  showTraits: boolean

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
  toggleAiPanel: () => void
  toggleExecutionPanel: () => void
  setExecutionOutput: (output: string, errors?: string | null) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  togglePreference: (key: 'showAttributes' | 'showMethods' | 'showActions' | 'showTraits') => void

  openCommandPalette: () => void
  closeCommandPalette: () => void
  setRightPanelView: (view: 'diagram' | 'generated') => void
  setDiagramOnly: (v: boolean) => void
  setGeneratedOutput: (code: string, language: string) => void
  setGeneratingCode: (generating: boolean) => void
  setGeneratedError: (error: string | null) => void
  clearGenerated: () => void
}

export const useUiStore = create<UiState>((set) => ({
  showEditor: true,
  showSidebar: true,
  sidebarWidth: 280,
  showTaskPanel: false,
  showAiPanel: false,
  showExecutionPanel: false,
  executionOutput: '',
  executionErrors: null,
  outputErrorCount: 0,
  outputWarningCount: 0,
  theme: 'system',
  showAttributes: true,
  showMethods: true,
  showActions: false,
  showTraits: true,

  commandPaletteOpen: false,
  rightPanelView: 'diagram',
  diagramOnly: false,
  generatedCode: '',
  generatedLanguage: 'Java',
  generatingCode: false,
  generatedError: null,
  generationRequested: false,

  toggleEditor: () => set((s) => ({ showEditor: !s.showEditor })),
  toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: Math.min(480, Math.max(200, sidebarWidth)) }),
  toggleTaskPanel: () => set((s) => ({ showTaskPanel: !s.showTaskPanel })),
  toggleAiPanel: () => set((s) => ({ showAiPanel: !s.showAiPanel })),
  toggleExecutionPanel: () => set((s) => ({ showExecutionPanel: !s.showExecutionPanel })),
  setExecutionOutput: (executionOutput, executionErrors = null) => {
    const { errors, warnings } = parseErrorCounts(executionErrors)
    set((s) => ({
      executionOutput,
      executionErrors,
      outputErrorCount: errors,
      outputWarningCount: warnings,
      // Auto-expand on errors, not warnings
      ...(errors > 0 && !s.showExecutionPanel ? { showExecutionPanel: true } : {}),
    }))
  },
  setTheme: (theme) => set({ theme }),
  togglePreference: (key) => set((s) => ({ [key]: !s[key] })),

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

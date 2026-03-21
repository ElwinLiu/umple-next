import { create } from 'zustand'

interface UiState {
  showEditor: boolean
  showDiagram: boolean
  showGeneratePanel: boolean
  showPalette: boolean
  showTaskPanel: boolean
  showAiPanel: boolean
  showExecutionPanel: boolean
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

  toggleEditor: () => void
  toggleDiagram: () => void
  toggleGeneratePanel: () => void
  togglePalette: () => void
  toggleTaskPanel: () => void
  toggleAiPanel: () => void
  toggleExecutionPanel: () => void
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
  showDiagram: true,
  showGeneratePanel: false,
  showPalette: false,
  showTaskPanel: false,
  showAiPanel: false,
  showExecutionPanel: false,
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

  toggleEditor: () => set((s) => ({ showEditor: !s.showEditor })),
  toggleDiagram: () => set((s) => ({ showDiagram: !s.showDiagram })),
  toggleGeneratePanel: () => set((s) => ({ showGeneratePanel: !s.showGeneratePanel })),
  togglePalette: () => set((s) => ({ showPalette: !s.showPalette })),
  toggleTaskPanel: () => set((s) => ({ showTaskPanel: !s.showTaskPanel })),
  toggleAiPanel: () => set((s) => ({ showAiPanel: !s.showAiPanel })),
  toggleExecutionPanel: () => set((s) => ({ showExecutionPanel: !s.showExecutionPanel })),
  setTheme: (theme) => set({ theme }),
  togglePreference: (key) => set((s) => ({ [key]: !s[key] })),

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  setRightPanelView: (rightPanelView) => set({ rightPanelView }),
  setDiagramOnly: (diagramOnly) => set({ diagramOnly, showEditor: !diagramOnly }),
  setGeneratedOutput: (generatedCode, generatedLanguage) =>
    set({ generatedCode, generatedLanguage, rightPanelView: 'generated', generatedError: null }),
  setGeneratingCode: (generatingCode) => set({ generatingCode }),
  setGeneratedError: (generatedError) => set({ generatedError }),
  clearGenerated: () => set({ generatedCode: '', generatedError: null, rightPanelView: 'diagram' }),
}))

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ── AI Config types ──

export type AiProvider =
  | 'openai' | 'anthropic' | 'google' | 'openrouter'
  | 'mistral' | 'xai' | 'groq' | 'deepseek'
  | 'fireworks' | 'cerebras'
  | 'moonshot' | 'minimax' | 'zhipu'

export interface ProviderConfig {
  apiKey: string
  model: string
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  apiKey: '',
  model: '',
}

const ALL_PROVIDERS: AiProvider[] = [
  'openai', 'anthropic', 'google', 'openrouter',
  'mistral', 'xai', 'groq', 'deepseek',
  'fireworks', 'cerebras', 'moonshot', 'minimax', 'zhipu',
]

export function createDefaultProviderConfigs(): Record<AiProvider, ProviderConfig> {
  return Object.fromEntries(
    ALL_PROVIDERS.map((p) => [p, { ...DEFAULT_PROVIDER_CONFIG }]),
  ) as Record<AiProvider, ProviderConfig>
}

// ── Diagram display pref types ──

export type GvLayoutAlgorithm = 'dot' | 'sfdp' | 'circo' | 'neato' | 'fdp' | 'twopi'

export type DisplayPrefKey =
  | 'showAttributes' | 'showMethods' | 'showTraits'
  | 'showActions' | 'showTransitionLabels' | 'showGuards' | 'showGuardLabels' | 'showNaturalLanguage'
  | 'showFeatureDependency'

// ── Store ──

interface PreferencesState {
  // Theme
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // Sidebar
  showSidebar: boolean
  sidebarWidth: number
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void

  // Diagram display preferences
  showAttributes: boolean
  showMethods: boolean
  showTraits: boolean
  showActions: boolean
  showTransitionLabels: boolean
  showGuards: boolean
  showGuardLabels: boolean
  showNaturalLanguage: boolean
  showFeatureDependency: boolean
  layoutAlgorithm: GvLayoutAlgorithm
  toggleDisplayPref: (key: DisplayPrefKey) => void
  setLayoutAlgorithm: (algo: GvLayoutAlgorithm) => void

  // AI config
  activeProvider: AiProvider
  configs: Record<AiProvider, ProviderConfig>
  setActiveProvider: (provider: AiProvider) => void
  setModel: (model: string) => void
  setApiKey: (key: string) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Sidebar
      showSidebar: true,
      sidebarWidth: 280,
      toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: Math.min(480, Math.max(200, sidebarWidth)) }),

      // Diagram display preferences (match Umple compiler defaults)
      showAttributes: true,
      showMethods: false,
      showTraits: false,
      showActions: true,
      showTransitionLabels: false,
      showGuards: true,
      showGuardLabels: false,
      showNaturalLanguage: true,
      showFeatureDependency: false,
      layoutAlgorithm: 'dot',
      toggleDisplayPref: (key) => set((s) => ({ [key]: !s[key] })),
      setLayoutAlgorithm: (layoutAlgorithm) => set({ layoutAlgorithm }),

      // AI config
      activeProvider: 'openai',
      configs: createDefaultProviderConfigs(),
      setActiveProvider: (activeProvider) => set({ activeProvider }),
      setModel: (model) => set((state) => ({
        configs: {
          ...state.configs,
          [state.activeProvider]: {
            ...state.configs[state.activeProvider],
            model,
          },
        },
      })),
      setApiKey: (apiKey) => set((state) => ({
        configs: {
          ...state.configs,
          [state.activeProvider]: {
            ...state.configs[state.activeProvider],
            apiKey,
          },
        },
      })),
    }),
    {
      name: 'umple-preferences-v1',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) }
        // Backfill any new providers missing from persisted localStorage
        const defaults = createDefaultProviderConfigs()
        const configs = { ...defaults, ...(merged as any).configs }
        return { ...merged, configs } as any
      },
      partialize: (state) => ({
        theme: state.theme,
        showSidebar: state.showSidebar,
        sidebarWidth: state.sidebarWidth,
        showAttributes: state.showAttributes,
        showMethods: state.showMethods,
        showTraits: state.showTraits,
        showActions: state.showActions,
        showTransitionLabels: state.showTransitionLabels,
        showGuards: state.showGuards,
        showGuardLabels: state.showGuardLabels,
        showNaturalLanguage: state.showNaturalLanguage,
        showFeatureDependency: state.showFeatureDependency,
        layoutAlgorithm: state.layoutAlgorithm,
        activeProvider: state.activeProvider,
        configs: state.configs,
      }),
    }
  )
)

/** Selector that returns a stable key representing all display preferences.
 *  Use as an effect dependency to trigger diagram refresh on pref changes. */
export function selectSuboptionsKey(s: PreferencesState): string {
  return JSON.stringify([
    s.showAttributes, s.showMethods, s.showTraits,
    s.showActions, s.showTransitionLabels, s.showGuards, s.showGuardLabels, s.showNaturalLanguage,
    s.showFeatureDependency, s.layoutAlgorithm,
  ])
}

/** Builds the suboptions array to send to the backend based on display preferences. */
export function buildSuboptions(
  prefs: Pick<PreferencesState,
    'showAttributes' | 'showMethods' | 'showTraits' |
    'showActions' | 'showTransitionLabels' | 'showGuards' | 'showGuardLabels' | 'showNaturalLanguage' |
    'showFeatureDependency' | 'layoutAlgorithm'
  >,
  viewMode: string,
  isDark: boolean,
): string[] {
  const opts: string[] = []

  if (viewMode === 'class') {
    if (!prefs.showAttributes) opts.push('hideattributes')
    if (prefs.showMethods) opts.push('showmethods')
  } else if (viewMode === 'state') {
    if (!prefs.showActions) opts.push('hideactions')
    if (prefs.showTransitionLabels) opts.push('showtransitionlabels')
    if (!prefs.showGuards) opts.push('hideguards')
    if (prefs.showGuardLabels) opts.push('showguardlabels')
    if (!prefs.showNaturalLanguage) opts.push('hidenaturallanguage')
  } else if (viewMode === 'feature') {
    if (prefs.showFeatureDependency) opts.push('showFeatureDependency')
  }

  if (prefs.layoutAlgorithm !== 'dot') {
    opts.push('gv' + prefs.layoutAlgorithm)
  }

  if (isDark) opts.push('gvdark')

  return opts
}

/** Returns the effective diagram type, accounting for the Traits toggle. */
export function getEffectiveDiagramType(viewMode: string, showTraits: boolean): string {
  const VIEW_TO_GV_TYPE: Record<string, string> = {
    class: 'GvClassDiagram',
    state: 'GvStateDiagram',
    feature: 'GvFeatureDiagram',
    structure: 'StructureDiagram',
    erd: 'GvEntityRelationshipDiagram',
    instance: 'InstanceDiagram',
    eventSequence: 'EventSequence',
    stateTables: 'StateTables',
  }
  if (viewMode === 'class' && showTraits) return 'GvClassTraitDiagram'
  return VIEW_TO_GV_TYPE[viewMode] ?? 'GvClassDiagram'
}

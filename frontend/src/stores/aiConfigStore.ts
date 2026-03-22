import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type AiProvider = 'openai' | 'anthropic' | 'google' | 'openrouter'

export interface ProviderConfig {
  apiKey: string
  model: string
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  apiKey: '',
  model: '',
}

export function createDefaultProviderConfigs(): Record<AiProvider, ProviderConfig> {
  return {
    openai: { ...DEFAULT_PROVIDER_CONFIG },
    anthropic: { ...DEFAULT_PROVIDER_CONFIG },
    google: { ...DEFAULT_PROVIDER_CONFIG },
    openrouter: { ...DEFAULT_PROVIDER_CONFIG },
  }
}

interface AiConfigState {
  activeProvider: AiProvider
  configs: Record<AiProvider, ProviderConfig>

  setActiveProvider: (provider: AiProvider) => void
  setModel: (model: string) => void
  setApiKey: (key: string) => void
}

export const useAiConfigStore = create<AiConfigState>()(
  persist(
    (set) => ({
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
      name: 'umple-ai-config-v2',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        activeProvider: state.activeProvider,
        configs: state.configs,
      }),
    }
  )
)

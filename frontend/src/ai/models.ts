import type { AiProvider } from '@/stores/preferencesStore'

export interface ModelInfo {
  id: string
  name: string
  contextLength?: number
  maxOutput?: number
  pricing?: { prompt: number; completion: number } // USD per 1M tokens
}

export async function fetchModels(provider: AiProvider, apiKey: string): Promise<ModelInfo[]> {
  switch (provider) {
    case 'openai': {
      const { fetchOpenAIModels } = await import('./adapters/openai')
      return fetchOpenAIModels(apiKey)
    }
    case 'anthropic': {
      const { fetchAnthropicModels } = await import('./adapters/anthropic')
      return fetchAnthropicModels(apiKey)
    }
    case 'google': {
      const { fetchGoogleModels } = await import('./adapters/google')
      return fetchGoogleModels(apiKey)
    }
    case 'openrouter': {
      const { fetchOpenRouterModels } = await import('./adapters/openrouter')
      return fetchOpenRouterModels(apiKey)
    }
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${_exhaustive}`)
    }
  }
}

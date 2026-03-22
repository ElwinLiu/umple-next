import type { LanguageModel } from 'ai'
import type { AiProvider } from '@/stores/aiConfigStore'

/**
 * Create the correct AI SDK language model instance for the given provider.
 * Each provider SDK is dynamically imported so only the selected provider's
 * code is loaded — the others stay out of the bundle chunk.
 *
 * All providers route through the backend proxy (`/api/ai/...`) so that
 * API keys never leave the browser directly to third-party origins.
 */
export async function getModel(
  provider: AiProvider,
  model: string,
  apiKey: string,
): Promise<LanguageModel> {
  switch (provider) {
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({
        apiKey,
        baseURL: '/api/ai/openai/v1',
      }).chat(model)
    }

    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      return createAnthropic({
        apiKey,
        baseURL: '/api/ai/anthropic',
        headers: { 'anthropic-version': '2023-06-01' },
      }).languageModel(model)
    }

    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      return createGoogleGenerativeAI({
        apiKey,
        baseURL: '/api/ai/google/v1beta',
      }).languageModel(model)
    }

    case 'openrouter': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({
        apiKey,
        baseURL: '/api/ai/openrouter/v1',
        name: 'openrouter',
      }).chat(model)
    }

    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown AI provider: ${_exhaustive}`)
    }
  }
}

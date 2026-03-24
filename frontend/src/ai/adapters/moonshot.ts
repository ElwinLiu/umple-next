import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchMoonshotModels = createOpenAICompatibleFetcher(
  '/api/ai/moonshot/v1/models', 'Moonshot',
)

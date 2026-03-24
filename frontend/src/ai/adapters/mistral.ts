import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchMistralModels = createOpenAICompatibleFetcher(
  '/api/ai/mistral/v1/models', 'Mistral',
)

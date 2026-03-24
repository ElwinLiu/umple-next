import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchCerebrasModels = createOpenAICompatibleFetcher(
  '/api/ai/cerebras/v1/models', 'Cerebras',
)

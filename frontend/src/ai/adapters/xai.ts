import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchXaiModels = createOpenAICompatibleFetcher(
  '/api/ai/xai/v1/models', 'xAI',
)

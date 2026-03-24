import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchFireworksModels = createOpenAICompatibleFetcher(
  '/api/ai/fireworks/inference/v1/models', 'Fireworks',
)

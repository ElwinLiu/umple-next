import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchDeepSeekModels = createOpenAICompatibleFetcher(
  '/api/ai/deepseek/models', 'DeepSeek',
)

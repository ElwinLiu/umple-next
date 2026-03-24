import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchZhipuModels = createOpenAICompatibleFetcher(
  '/api/ai/zhipu/api/paas/v4/models', 'Zhipu',
)

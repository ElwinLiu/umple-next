import { createOpenAICompatibleFetcher } from './openai-compatible'

export const fetchGroqModels = createOpenAICompatibleFetcher(
  '/api/ai/groq/openai/v1/models', 'Groq',
  { mapExtra: (m) => ({ contextLength: m.context_window }) },
)

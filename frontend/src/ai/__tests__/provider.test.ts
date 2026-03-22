import { describe, it, expect } from 'vitest'
import { getModel } from '../provider'

describe('getModel', () => {
  const DUMMY_KEY = 'sk-test-key'

  it('returns an OpenAI chat completions model (not responses API)', async () => {
    const model = (await getModel('openai', 'gpt-4o', DUMMY_KEY)) as any
    // The provider ID must be "openai.chat" (chat completions),
    // NOT "openai.responses" (responses API).
    // The responses API fails on multi-turn conversations through our proxy.
    expect(model.provider).toBe('openai.chat')
  })

  it('returns an OpenRouter chat completions model', async () => {
    const model = (await getModel('openrouter', 'openai/gpt-4o', DUMMY_KEY)) as any
    expect(model.provider).toBe('openrouter.chat')
  })

  it('returns an Anthropic model', async () => {
    const model = (await getModel('anthropic', 'claude-sonnet-4-5-20250514', DUMMY_KEY)) as any
    expect(model.provider).toContain('anthropic')
  })

  it('returns a Google model', async () => {
    const model = (await getModel('google', 'gemini-2.0-flash', DUMMY_KEY)) as any
    expect(model.provider).toContain('google')
  })

  it('routes OpenAI through the proxy', async () => {
    const model = (await getModel('openai', 'gpt-4o', DUMMY_KEY)) as any
    expect(model.modelId).toBe('gpt-4o')
  })

  it('throws for unknown provider', async () => {
    await expect(getModel('unknown' as any, 'model', DUMMY_KEY)).rejects.toThrow()
  })
})

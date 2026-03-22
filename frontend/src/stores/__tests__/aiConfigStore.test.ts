// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultProviderConfigs, useAiConfigStore } from '../aiConfigStore'

afterEach(() => {
  sessionStorage.clear()
  useAiConfigStore.setState({
    activeProvider: 'openai',
    configs: createDefaultProviderConfigs(),
  })
})

describe('aiConfigStore', () => {
  it('keeps api keys and models isolated per provider', () => {
    const store = useAiConfigStore.getState()

    store.setApiKey('openai-key')
    store.setModel('gpt-4o')
    store.setActiveProvider('anthropic')

    expect(useAiConfigStore.getState().configs.anthropic).toEqual({
      apiKey: '',
      model: '',
    })

    useAiConfigStore.getState().setApiKey('anthropic-key')
    useAiConfigStore.getState().setModel('claude-sonnet')
    useAiConfigStore.getState().setActiveProvider('openai')

    expect(useAiConfigStore.getState().configs.openai).toEqual({
      apiKey: 'openai-key',
      model: 'gpt-4o',
    })
    expect(useAiConfigStore.getState().configs.anthropic).toEqual({
      apiKey: 'anthropic-key',
      model: 'claude-sonnet',
    })
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultProviderConfigs, usePreferencesStore } from '../preferencesStore'

afterEach(() => {
  localStorage.clear()
  usePreferencesStore.setState({
    activeProvider: 'openai',
    configs: createDefaultProviderConfigs(),
  })
})

describe('aiConfigStore', () => {
  it('keeps api keys and models isolated per provider', () => {
    const store = usePreferencesStore.getState()

    store.setApiKey('openai-key')
    store.setModel('gpt-4o')
    store.setActiveProvider('anthropic')

    expect(usePreferencesStore.getState().configs.anthropic).toEqual({
      apiKey: '',
      model: '',
    })

    usePreferencesStore.getState().setApiKey('anthropic-key')
    usePreferencesStore.getState().setModel('claude-sonnet')
    usePreferencesStore.getState().setActiveProvider('openai')

    expect(usePreferencesStore.getState().configs.openai).toEqual({
      apiKey: 'openai-key',
      model: 'gpt-4o',
    })
    expect(usePreferencesStore.getState().configs.anthropic).toEqual({
      apiKey: 'anthropic-key',
      model: 'claude-sonnet',
    })
  })
})

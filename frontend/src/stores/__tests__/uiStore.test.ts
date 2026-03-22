import { afterEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../uiStore'

afterEach(() => {
  useUiStore.setState({
    showExecutionPanel: false,
    showAgentPanel: false,
    executionOutput: '',
    executionErrors: null,
    outputErrorCount: 0,
    outputWarningCount: 0,
  })
})

describe('uiStore', () => {
  it('auto-expands the output panel on errors when the agent panel is closed', () => {
    useUiStore.getState().setExecutionOutput('', '{"results":[{"severity":"1"}]}')

    expect(useUiStore.getState().showExecutionPanel).toBe(true)
    expect(useUiStore.getState().outputErrorCount).toBe(1)
    expect(useUiStore.getState().outputWarningCount).toBe(0)
  })

  it('keeps the output panel collapsed on errors when the agent panel is open', () => {
    useUiStore.setState({ showAgentPanel: true })

    useUiStore.getState().setExecutionOutput('', '{"results":[{"severity":"1"}]}')

    expect(useUiStore.getState().showExecutionPanel).toBe(false)
    expect(useUiStore.getState().outputErrorCount).toBe(1)
    expect(useUiStore.getState().outputWarningCount).toBe(0)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../uiStore'

afterEach(() => {
  useUiStore.setState({
    outputView: 'hidden',
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

    expect(useUiStore.getState().outputView).toBe('panel')
    expect(useUiStore.getState().outputErrorCount).toBe(1)
    expect(useUiStore.getState().outputWarningCount).toBe(0)
  })

  it('keeps the output view unchanged on errors when the agent panel is open', () => {
    useUiStore.setState({ showAgentPanel: true })

    useUiStore.getState().setExecutionOutput('', '{"results":[{"severity":"1"}]}')

    expect(useUiStore.getState().outputView).toBe('hidden')
    expect(useUiStore.getState().outputErrorCount).toBe(1)
    expect(useUiStore.getState().outputWarningCount).toBe(0)
  })

  it('toggleOutputPanel cycles between hidden and panel', () => {
    expect(useUiStore.getState().outputView).toBe('hidden')

    useUiStore.getState().toggleOutputPanel()
    expect(useUiStore.getState().outputView).toBe('panel')

    useUiStore.getState().toggleOutputPanel()
    expect(useUiStore.getState().outputView).toBe('hidden')
  })

  it('does not change output view when clearing output', () => {
    useUiStore.setState({ outputView: 'panel' })

    useUiStore.getState().setExecutionOutput('')

    expect(useUiStore.getState().outputView).toBe('panel')
  })
})

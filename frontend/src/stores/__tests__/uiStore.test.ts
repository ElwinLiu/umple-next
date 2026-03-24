import { afterEach, describe, expect, it } from 'vitest'
import { useEphemeralStore } from '../ephemeralStore'
import { useSessionStore } from '../sessionStore'

afterEach(() => {
  useEphemeralStore.setState({
    outputView: 'hidden',
    executionOutput: '',
    executionErrors: null,
    outputErrorCount: 0,
    outputWarningCount: 0,
  })
  useSessionStore.setState({ showAgentPanel: false })
})

describe('uiStore', () => {
  it('auto-expands the output panel on errors when the agent panel is closed', () => {
    useEphemeralStore.getState().setExecutionOutput('', '{"results":[{"severity":"1"}]}')

    expect(useEphemeralStore.getState().outputView).toBe('panel')
    expect(useEphemeralStore.getState().outputErrorCount).toBe(1)
    expect(useEphemeralStore.getState().outputWarningCount).toBe(0)
  })

  it('keeps the output view unchanged on errors when the agent panel is open', () => {
    useSessionStore.setState({ showAgentPanel: true })

    useEphemeralStore.getState().setExecutionOutput('', '{"results":[{"severity":"1"}]}')

    expect(useEphemeralStore.getState().outputView).toBe('hidden')
    expect(useEphemeralStore.getState().outputErrorCount).toBe(1)
    expect(useEphemeralStore.getState().outputWarningCount).toBe(0)
  })

  it('toggleOutputPanel cycles between hidden and panel', () => {
    expect(useEphemeralStore.getState().outputView).toBe('hidden')

    useEphemeralStore.getState().toggleOutputPanel()
    expect(useEphemeralStore.getState().outputView).toBe('panel')

    useEphemeralStore.getState().toggleOutputPanel()
    expect(useEphemeralStore.getState().outputView).toBe('hidden')
  })

  it('toggleOutputPanel from strip goes to hidden', () => {
    useEphemeralStore.setState({ outputView: 'strip' })

    useEphemeralStore.getState().toggleOutputPanel()
    expect(useEphemeralStore.getState().outputView).toBe('hidden')
  })

  it('does not change output view when clearing output', () => {
    useEphemeralStore.setState({ outputView: 'panel' })

    useEphemeralStore.getState().setExecutionOutput('')

    expect(useEphemeralStore.getState().outputView).toBe('panel')
  })
})

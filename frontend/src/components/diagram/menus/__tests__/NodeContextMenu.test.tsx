// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NodeContextMenu } from '../NodeContextMenu'
import { useSessionStore } from '@/stores/sessionStore'
import { useEphemeralStore } from '@/stores/ephemeralStore'

const ACCESS_CONTROL_ASSOCIATION_CLASS = `associationClass RoleFacilityAccessRight {
  * Facility;
  * Role;
  CRUD_Value { R, RW }
}
`

describe('NodeContextMenu', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    useSessionStore.setState({ code: '', showAgentPanel: false })
    useEphemeralStore.setState({
      editingNodeId: null,
      editingField: null,
      executionOutput: '',
      executionErrors: null,
      outputView: 'hidden',
    })
  })

  it('blocks adding methods to association classes', () => {
    useSessionStore.setState({ code: ACCESS_CONTROL_ASSOCIATION_CLASS, showAgentPanel: false })

    const onClose = vi.fn()
    render(
      <NodeContextMenu
        position={{ x: 120, y: 80 }}
        nodeId="class-RoleFacilityAccessRight"
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('menuitem', { name: /add method/i }))

    const state = useEphemeralStore.getState()
    expect(state.editingField).toBeNull()
    expect(state.rawErrorText).toContain('association classes')
    expect(state.outputErrorCount).toBe(1)
    expect(onClose).toHaveBeenCalled()
  })
})

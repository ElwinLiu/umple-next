// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import * as Y from 'yjs'

import { useCollabTabs } from '../useCollabTabs'
import { useCollabStore } from '@/stores/collabStore'
import { useSessionStore } from '@/stores/sessionStore'

const { getYDocMock } = vi.hoisted(() => ({
  getYDocMock: vi.fn(),
}))

vi.mock('../useCollab', () => ({
  getYDoc: getYDocMock,
}))

function TestHarness() {
  useCollabTabs()
  return null
}

describe('useCollabTabs', () => {
  afterEach(() => {
    cleanup()
    getYDocMock.mockReset()
    useCollabStore.setState({
      isCollaborating: false,
      roomId: null,
      connected: false,
      ready: false,
      connectedUsers: [],
    })
    useSessionStore.setState({
      code: '',
      activeTabId: 'main',
      tabsVersion: 0,
      tabs: [{ id: 'main', name: 'Model.ump', code: '', dirty: false, savedCode: '', undoStack: [], redoStack: [] }],
    })
  })

  it('syncs remote non-active tab text edits into session state and bumps tabsVersion', async () => {
    const doc = new Y.Doc()
    const ytabs = doc.getMap('tabs')

    doc.transact(() => {
      const mainMeta = new Y.Map<unknown>()
      mainMeta.set('name', 'Model.ump')
      mainMeta.set('order', 0)
      ytabs.set('main', mainMeta)
      doc.getText('tab:main').insert(0, 'class Invoice {}')

      const helperMeta = new Y.Map<unknown>()
      helperMeta.set('name', 'Helper.ump')
      helperMeta.set('order', 1)
      ytabs.set('helper', helperMeta)
      doc.getText('tab:helper').insert(0, 'class Helper {}')
    })

    getYDocMock.mockReturnValue(doc)
    useCollabStore.setState({ isCollaborating: true, ready: true })
    useSessionStore.setState({
      code: 'class Invoice {}',
      activeTabId: 'main',
      tabsVersion: 0,
      tabs: [
        { id: 'main', name: 'Model.ump', code: 'class Invoice {}', dirty: false, savedCode: 'class Invoice {}', undoStack: [], redoStack: [] },
        { id: 'helper', name: 'Helper.ump', code: 'class Helper {}', dirty: false, savedCode: 'class Helper {}', undoStack: [], redoStack: [] },
      ],
    })

    render(<TestHarness />)

    act(() => {
      doc.transact(() => {
        const helperText = doc.getText('tab:helper')
        helperText.delete(0, helperText.length)
        helperText.insert(0, 'class Helper { String name; }')
      })
    })

    await waitFor(() => {
      expect(
        useSessionStore.getState().tabs.find((tab) => tab.id === 'helper')?.code,
      ).toBe('class Helper { String name; }')
    })

    expect(useSessionStore.getState().tabsVersion).toBe(1)
    expect(useSessionStore.getState().code).toBe('class Invoice {}')
  })
})

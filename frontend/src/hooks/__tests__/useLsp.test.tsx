// @vitest-environment jsdom
import { useRef } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { useSessionStore } from '@/stores/sessionStore'
const lspMocks = vi.hoisted(() => ({
  initLsp: vi.fn(),
  disconnectLsp: vi.fn(),
  setLspReconnectCallback: vi.fn(),
  syncLspTabs: vi.fn(),
  switchLspFile: vi.fn(),
}))

vi.mock('../../codemirror/lsp', () => ({
  initLsp: lspMocks.initLsp,
  disconnectLsp: lspMocks.disconnectLsp,
  setLspReconnectCallback: lspMocks.setLspReconnectCallback,
  syncLspTabs: lspMocks.syncLspTabs,
  switchLspFile: lspMocks.switchLspFile,
}))

import { useLsp } from '../useLsp'

const fakeView = {} as EditorView

function Harness() {
  const ref = useRef<EditorView | null>(fakeView)
  useLsp(ref)
  return null
}

describe('useLsp', () => {
  beforeEach(() => {
    sessionStorage.clear()
    lspMocks.initLsp.mockReset()
    lspMocks.disconnectLsp.mockReset()
    lspMocks.setLspReconnectCallback.mockReset()
    lspMocks.syncLspTabs.mockReset()
    lspMocks.switchLspFile.mockReset()

    useSessionStore.setState({
      code: 'class Person {}',
      modelId: 'model-1',
      tabs: [
        {
          id: 'main',
          name: 'Person.ump',
          code: 'class Person {}',
          dirty: false,
          savedCode: 'class Person {}',
        },
      ],
      activeTabId: 'main',
      tabsVersion: 0,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('rebinds the active LSP file when the current tab is renamed', async () => {
    render(<Harness />)

    await waitFor(() => {
      expect(lspMocks.switchLspFile).toHaveBeenCalledWith(fakeView, 'Person.ump')
    })

    lspMocks.switchLspFile.mockClear()

    act(() => {
      useSessionStore.getState().renameTab('main', 'RenamedPerson')
    })

    await waitFor(() => {
      expect(lspMocks.switchLspFile).toHaveBeenCalledWith(fakeView, 'RenamedPerson.ump')
    })
  })
})

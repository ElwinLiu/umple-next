// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LSPClient } from '@codemirror/lsp-client'
import { __testing, syncLspTabs } from '../lsp'
import { useSessionStore, type Tab } from '@/stores/sessionStore'

function makeTab(id: string, name: string, code: string): Tab {
  return {
    id,
    name,
    code,
    dirty: false,
    savedCode: code,
    undoStack: [],
    redoStack: [],
  }
}

function createClient() {
  const didOpen = vi.fn()
  const didClose = vi.fn()
  const notification = vi.fn()

  return {
    client: {
      didOpen,
      didClose,
      notification,
      supportSync: 1,
    } as unknown as LSPClient,
    didOpen,
    didClose,
    notification,
  }
}

describe('LSP workspace sync', () => {
  beforeEach(() => {
    sessionStorage.clear()
    __testing.resetState()
    useSessionStore.setState({
      code: '',
      modelId: 'model-1',
      tabs: [makeTab('person', 'Person.ump', 'class Person {}')],
      activeTabId: 'person',
    })
  })

  it('pushes updated detached tab contents to the language server', () => {
    const { client, didOpen, didClose } = createClient()
    const workspace = new __testing.UmpleWorkspace(client, '/data/models', 'model-1')
    const initialCode = 'class Person {}'
    const updatedCode = 'class Person {\n  name;\n}\n'

    __testing.setClientState(client, workspace, true)
    workspace.addPassiveFile('Person.ump', initialCode)

    // Reset mocks after addPassiveFile's initial didOpen
    didOpen.mockClear()
    didClose.mockClear()

    useSessionStore.setState({
      tabs: [makeTab('person', 'Person.ump', updatedCode)],
    })
    syncLspTabs(useSessionStore.getState().tabs)

    const uri = workspace._tabUri('Person.ump')
    expect(workspace.getFile(uri)?.doc.toString()).toBe(updatedCode)
    // sendFullDocumentChange syncs via didClose + didOpen
    expect(didClose).toHaveBeenCalledWith(uri)
    expect(didOpen).toHaveBeenCalledWith(
      expect.objectContaining({ uri, doc: expect.anything() }),
    )
  })

  it('mirrors passive file edits back into the session store', () => {
    const { client } = createClient()
    const workspace = new __testing.UmpleWorkspace(client, '/data/models', 'model-1')
    const initialCode = 'class Person {}'
    const updatedCode = 'class RenamedPerson {}'
    const uri = workspace._tabUri('Person.ump')

    workspace.addPassiveFile('Person.ump', initialCode)
    workspace.updateFile(uri, {
      changes: { from: 0, to: initialCode.length, insert: updatedCode },
    })

    expect(useSessionStore.getState().tabs[0]).toMatchObject({
      name: 'Person.ump',
      code: updatedCode,
      dirty: true,
    })
  })
})

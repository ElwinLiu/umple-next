// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useDiagramSync } from '../useDiagramSync'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useSessionStore } from '@/stores/sessionStore'

const syncMock = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    sync: (...args: unknown[]) => syncMock(...args),
  },
}))

function SyncHarness() {
  const { sync } = useDiagramSync()

  return (
    <button
      type="button"
      onClick={() => {
        void sync('editClass', { className: 'Person', newName: 'RenamedPerson' })
      }}
    >
      Sync
    </button>
  )
}

afterEach(() => {
  cleanup()
  syncMock.mockReset()
  useSessionStore.setState({
    code: '',
    modelId: null,
    activeTabId: 'main',
    generateTargetId: 'classDiagram',
    viewMode: 'class',
    syncPending: false,
    tabs: [{
      id: 'main',
      name: 'Model.ump',
      code: '',
      dirty: false,
      savedCode: '',
      undoStack: [],
      redoStack: [],
    }],
  })
  useEphemeralStore.setState({
    rightPanelView: 'diagram',
    renderMode: 'graphviz',
    diagramSourceCode: null,
    diagramSourceTabId: null,
    diagramTargetId: null,
    executionOutput: '',
    executionErrors: null,
    parsedIssues: [],
    rawErrorText: '',
    outputErrorCount: 0,
    outputWarningCount: 0,
  })
  usePreferencesStore.setState({ dynamicGeneration: true })
})

describe('useDiagramSync', () => {
  it('marks editable class diagram output fresh after a successful sync edit', async () => {
    const nextCode = 'class RenamedPerson { name; }'

    syncMock.mockResolvedValue({
      code: nextCode,
      result: '{}',
      modelId: 'model-1',
    })

    useSessionStore.setState({
      code: 'class Person { name; }',
      modelId: 'model-1',
      activeTabId: 'main',
      generateTargetId: 'classDiagram',
      viewMode: 'class',
      tabs: [{
        id: 'main',
        name: 'Model.ump',
        code: 'class Person { name; }',
        dirty: false,
        savedCode: 'class Person { name; }',
        undoStack: [],
        redoStack: [],
      }],
    })
    useEphemeralStore.setState({
      rightPanelView: 'diagram',
      renderMode: 'editable',
      diagramSourceCode: 'class Person { name; }',
      diagramSourceTabId: 'main',
      diagramTargetId: 'classDiagram',
    })
    usePreferencesStore.setState({ dynamicGeneration: false })

    render(<SyncHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }))

    await waitFor(() => {
      expect(useSessionStore.getState().code).toBe(nextCode)
      expect(useEphemeralStore.getState().diagramSourceCode).toBe(nextCode)
      expect(useEphemeralStore.getState().diagramSourceTabId).toBe('main')
      expect(useEphemeralStore.getState().diagramTargetId).toBe('classDiagram')
    })
  })
})

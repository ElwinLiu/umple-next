// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { EditorPanel } from '../EditorPanel'
import { useEditorStore } from '@/stores/editorStore'

vi.mock('../TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}))

vi.mock('../UmpleEditor', () => ({
  UmpleEditor: () => <div data-testid="umple-editor" />,
}))

vi.mock('../UmpleDiffEditor', () => ({
  UmpleDiffEditor: ({ originalCode, proposedCode }: { originalCode: string; proposedCode: string }) => (
    <div data-testid="umple-diff-editor">
      {`${originalCode} -> ${proposedCode}`}
    </div>
  ),
}))

vi.mock('../../agent/AgentPanel', () => ({
  AgentPanel: () => <div data-testid="agent-panel" />,
}))

vi.mock('@/ai/useAgent', () => ({
  useAgent: () => ({
    isConfigured: true,
    messages: [],
    status: 'ready',
    error: undefined,
    send: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    approveToolCall: vi.fn(),
    rejectToolCall: vi.fn(),
  }),
}))

afterEach(() => {
  cleanup()
  useEditorStore.setState({
    code: '',
    diffPreview: null,
    activeTabId: 'main',
    tabs: [{ id: 'main', name: 'model.ump', code: '', dirty: false, savedCode: '' }],
  })
})

describe('EditorPanel', () => {
  it('renders the diff preview when an approval preview is active', () => {
    useEditorStore.setState({
      code: 'class Student {}',
      diffPreview: {
        toolCallId: 'call-1',
        toolName: 'editCode',
        title: 'Previewing proposed edit',
        description: 'Rename Student to Person',
        originalCode: 'class Student {}',
        proposedCode: 'class Person {}',
      },
    })

    render(<EditorPanel />)

    expect(screen.getByText('Previewing proposed edit')).toBeDefined()
    expect(screen.getByText('Rename Student to Person')).toBeDefined()
    expect(screen.getByTestId('umple-diff-editor')).toBeDefined()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentPanel from '../AgentPanel'
import { createDefaultProviderConfigs, usePreferencesStore } from '@/stores/preferencesStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { TooltipProvider } from '@/components/ui/tooltip'

const mockSend = vi.fn()
const mockStop = vi.fn()
const mockReset = vi.fn()
const mockApproveToolCall = vi.fn()
const mockRejectToolCall = vi.fn()

let mockAgentState = {
  messages: [] as any[],
  status: 'ready' as const,
  error: undefined as Error | undefined,
  send: mockSend,
  stop: mockStop,
  reset: mockReset,
  approveToolCall: mockApproveToolCall,
  rejectToolCall: mockRejectToolCall,
}

vi.mock('@/ai/useAgent', () => ({
  useAgent: () => mockAgentState,
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()
window.HTMLElement.prototype.setPointerCapture = vi.fn()
window.HTMLElement.prototype.releasePointerCapture = vi.fn()

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  mockSend.mockClear()
  mockStop.mockClear()
  mockReset.mockClear()
  mockApproveToolCall.mockClear()
  mockRejectToolCall.mockClear()
  sessionStorage.clear()
  mockAgentState = {
    messages: [],
    status: 'ready',
    error: undefined,
    send: mockSend,
    stop: mockStop,
    reset: mockReset,
    approveToolCall: mockApproveToolCall,
    rejectToolCall: mockRejectToolCall,
  }
  usePreferencesStore.setState({
    activeProvider: 'openai',
    configs: createDefaultProviderConfigs(),
  })
  useSessionStore.setState({ showAgentPanel: false, showAgentBar: false, code: '' })
  useEphemeralStore.setState({ diffPreview: null })
})

function renderAgentPanel() {
  return render(
    <TooltipProvider>
      <AgentPanel />
    </TooltipProvider>,
  )
}

describe('AgentPanel', () => {
  it('renders approval UI for static tool parts', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({ showAgentPanel: true })
    useSessionStore.setState({ code: 'class Student {}' })
    useEphemeralStore.setState({ diffPreview: null })

    mockAgentState = {
      ...mockAgentState,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-editCode',
              toolCallId: 'call-1',
              state: 'approval-requested',
              input: {
                explanation: 'Rename Student to Person',
                edits: [{ oldText: 'Student', newText: 'Person' }],
              },
              approval: { id: 'approval-1' },
            },
          ],
        },
      ],
    }

    renderAgentPanel()

    expect(screen.getByText('Edit proposed')).toBeDefined()
    expect(screen.getByText('Rename Student to Person')).toBeDefined()
    expect(screen.getByText('Preview shown in the editor above.')).toBeDefined()
    expect(useEphemeralStore.getState().diffPreview?.proposedCode).toBe('class Person {}')

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(mockApproveToolCall).toHaveBeenCalledWith(
      'approval-1',
      'call-1',
      'editCode',
      expect.objectContaining({
        explanation: 'Rename Student to Person',
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(mockRejectToolCall).toHaveBeenCalledWith('approval-1', 'call-1', 'editCode')
  })

  it('renders tool output in an expanded wrapped block', () => {
    useSessionStore.setState({ showAgentPanel: true })

    mockAgentState = {
      ...mockAgentState,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-readEditorCode',
              toolCallId: 'call-1',
              state: 'output-available',
              input: {},
              output: 'class Student {\n  name;\n}',
            },
          ],
        },
      ],
    }

    renderAgentPanel()

    const output = screen.getByText((content, element) => {
      return element?.tagName === 'PRE' && content.includes('class Student {') && content.includes('name;')
    })
    const pre = output.closest('pre')

    expect(screen.getByText('Read code')).toBeDefined()
    expect(pre).not.toBeNull()
    expect(pre?.className).toContain('whitespace-pre-wrap')
    expect(pre?.className).toContain('break-words')
  })

  it('renders verifyCode output with a structured verification card', () => {
    useSessionStore.setState({
      showAgentPanel: true,
      activeTabId: 'main',
      tabs: [
        { id: 'main', name: 'Model.ump', code: 'class Person {}', dirty: false, savedCode: 'class Person {}', undoStack: [], redoStack: [] },
        { id: 'support', name: 'Main.ump', code: 'class Order {}', dirty: false, savedCode: 'class Order {}', undoStack: [], redoStack: [] },
      ],
    })
    useEphemeralStore.setState({ pendingEditorJump: null })

    mockAgentState = {
      ...mockAgentState,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-verifyCode',
              toolCallId: 'call-verify',
              state: 'output-available',
              input: {},
              output: {
                success: false,
                modelId: 'model-123',
                errors: [
                  JSON.stringify({
                    results: [
                      {
                        severity: 1,
                        errorCode: 'E001',
                        message: 'Missing semicolon',
                        line: 3,
                        filename: 'Main.ump',
                        url: 'https://example.com/error/E001',
                      },
                      {
                        severity: 3,
                        errorCode: 'W010',
                        message: 'Unused attribute',
                        line: 7,
                        filename: 'Main.ump',
                        url: 'https://example.com/error/W010',
                      },
                    ],
                  }),
                ].join('\n'),
              },
            },
          ],
        },
      ],
    }

    renderAgentPanel()

    expect(screen.getByText('Verified code')).toBeDefined()
    expect(screen.getByText('Verification found issues')).toBeDefined()
    expect(screen.getByText('1 error and 1 warning.')).toBeDefined()
    expect(
      screen.getByText((_, element) =>
        (element?.tagName === 'P' &&
          (element.textContent?.includes('Error on line 3 in Main.ump: Missing semicolon') ?? false)) ||
        false,
      ),
    ).toBeDefined()
    expect(
      screen.getByText((_, element) =>
        (element?.tagName === 'P' &&
          (element.textContent?.includes('Warning on line 7 in Main.ump: Unused attribute') ?? false)) ||
        false,
      ),
    ).toBeDefined()
    expect(screen.getByText('model-123')).toBeDefined()
    expect(screen.getAllByText('Main.ump')).toHaveLength(2)
  })

  it('clicks verifyCode line numbers to jump the editor to the matching tab', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      showAgentPanel: true,
      activeTabId: 'main',
      tabs: [
        { id: 'main', name: 'Model.ump', code: 'class Person {}', dirty: false, savedCode: 'class Person {}', undoStack: [], redoStack: [] },
        { id: 'support', name: 'Main.ump', code: 'class Order {}', dirty: false, savedCode: 'class Order {}', undoStack: [], redoStack: [] },
      ],
    })
    useEphemeralStore.setState({ pendingEditorJump: null })

    mockAgentState = {
      ...mockAgentState,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-verifyCode',
              toolCallId: 'call-verify',
              state: 'output-available',
              input: {},
              output: {
                success: false,
                modelId: 'model-123',
                errors: JSON.stringify({
                  results: [
                    {
                      severity: 1,
                      errorCode: 'E001',
                      message: 'Missing semicolon',
                      line: 3,
                      filename: 'Main.ump',
                      url: 'https://example.com/error/E001',
                    },
                  ],
                }),
              },
            },
          ],
        },
      ],
    }

    renderAgentPanel()

    await user.click(screen.getByRole('button', { name: /line 3/i }))

    expect(useSessionStore.getState().activeTabId).toBe('support')
    expect(useEphemeralStore.getState().pendingEditorJump).toEqual({
      tabId: 'support',
      line: 3,
    })
  })

  it('starts minimized with the launcher visible', () => {
    renderAgentPanel()

    expect(screen.getByTestId('agent-panel-launcher')).toBeDefined()
    expect(screen.queryByTestId('agent-panel-collapsed')).toBeNull()
    expect(screen.queryByTestId('agent-panel')).toBeNull()
  })

  it('keeps the panel collapsed after drag-fold release', () => {
    useSessionStore.setState({ showAgentPanel: true })

    mockAgentState = {
      ...mockAgentState,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ],
    }

    renderAgentPanel()

    const panel = screen.getByTestId('agent-panel')
    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      get: () => 200,
    })

    const handle = screen.getByRole('separator', { name: 'Resize chat panel' })
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 190 })

    const collapsed = screen.getByTestId('agent-panel-collapsed')
    fireEvent.click(collapsed)

    expect(screen.queryByTestId('agent-panel')).toBeNull()
    expect(screen.getByTestId('agent-panel-collapsed')).toBeDefined()

    fireEvent.pointerDown(screen.getByTestId('agent-panel-collapsed'))
    fireEvent.click(screen.getByTestId('agent-panel-collapsed'))
    expect(screen.getByTestId('agent-panel')).toBeDefined()
  })

  it('keeps focus on the input when expanding from the collapsed textarea', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({ showAgentBar: true })

    mockAgentState = {
      ...mockAgentState,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ],
    }

    renderAgentPanel()

    await user.click(screen.getByRole('textbox'))

    expect(screen.getByTestId('agent-panel')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBe(document.activeElement)
    })
  })

  it('minimizes the collapsed bar into a launcher and restores focus when reopened', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({ showAgentBar: true })

    renderAgentPanel()

    await user.click(screen.getByRole('button', { name: 'Hide AI assistant' }))

    expect(screen.queryByTestId('agent-panel-collapsed')).toBeNull()
    expect(screen.getByTestId('agent-panel-launcher')).toBeDefined()

    await user.click(screen.getByTestId('agent-panel-launcher'))

    expect(screen.getByTestId('agent-panel-collapsed')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBe(document.activeElement)
    })
  })

  it('hides the expanded panel into the launcher', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({ showAgentPanel: true })

    renderAgentPanel()

    await user.click(screen.getByRole('button', { name: 'Hide AI assistant' }))

    expect(screen.queryByTestId('agent-panel')).toBeNull()
    expect(screen.queryByTestId('agent-panel-collapsed')).toBeNull()
    expect(screen.getByTestId('agent-panel-launcher')).toBeDefined()
  })

  it('reopens the expanded panel from the launcher when conversation history exists', async () => {
    const user = userEvent.setup()

    mockAgentState = {
      ...mockAgentState,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hello again' }],
        },
      ],
    }

    renderAgentPanel()

    await user.click(screen.getByTestId('agent-panel-launcher'))

    expect(screen.getByTestId('agent-panel')).toBeDefined()
    expect(screen.queryByTestId('agent-panel-collapsed')).toBeNull()
  })
})

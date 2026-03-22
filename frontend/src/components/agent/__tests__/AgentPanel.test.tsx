// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentPanel from '../AgentPanel'
import { createDefaultProviderConfigs, useAiConfigStore } from '@/stores/aiConfigStore'
import { useEditorStore } from '@/stores/editorStore'
import { useUiStore } from '@/stores/uiStore'

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
  useAiConfigStore.setState({
    activeProvider: 'openai',
    configs: createDefaultProviderConfigs(),
  })
  useUiStore.setState({ showAgentPanel: false })
  useEditorStore.setState({
    code: '',
    diffPreview: null,
  })
})

describe('AgentPanel', () => {
  it('renders approval UI for static tool parts', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ showAgentPanel: true })
    useEditorStore.setState({ code: 'class Student {}', diffPreview: null })

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

    render(<AgentPanel />)

    expect(screen.getByText('Edit proposed')).toBeDefined()
    expect(screen.getByText('Rename Student to Person')).toBeDefined()
    expect(screen.getByText('Preview shown in the editor above.')).toBeDefined()
    expect(useEditorStore.getState().diffPreview?.proposedCode).toBe('class Person {}')

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

  it('keeps the panel collapsed after drag-fold release', () => {
    useUiStore.setState({ showAgentPanel: true })

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

    render(<AgentPanel />)

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

  it('ignores the synthetic release click after drag-folding', () => {
    useUiStore.setState({ showAgentPanel: true })

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

    render(<AgentPanel />)

    const panel = screen.getByTestId('agent-panel')
    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      get: () => 200,
    })

    const handle = screen.getByRole('separator', { name: 'Resize chat panel' })
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 190 })

    fireEvent.click(screen.getByTestId('agent-panel-collapsed'))

    expect(screen.queryByTestId('agent-panel')).toBeNull()
  })

  it('keeps focus on the input when expanding from the collapsed textarea', async () => {
    const user = userEvent.setup()

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

    render(<AgentPanel />)

    await user.click(screen.getByRole('textbox'))

    expect(screen.getByTestId('agent-panel')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBe(document.activeElement)
    })
  })
})

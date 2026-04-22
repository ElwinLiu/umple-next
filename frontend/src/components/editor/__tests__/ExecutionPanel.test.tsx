// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OutputPanel } from '../ExecutionPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { useSessionStore } from '@/stores/sessionStore'

function resetExecutionState() {
  useEphemeralStore.setState({
    executing: false,
    executionOutput: '',
    executionErrors: null,
    parsedIssues: [],
    rawErrorText: '',
    outputErrorCount: 0,
    outputWarningCount: 0,
    pendingEditorJump: null,
  })
}

describe('ExecutionPanel', () => {
  beforeEach(() => {
    useSessionStore.setState({
      code: 'class Person {}\nclass Order {}',
      activeTabId: 'main',
      tabs: [
        { id: 'main', name: 'Model.ump', code: 'class Person {}', dirty: false, savedCode: 'class Person {}', undoStack: [], redoStack: [] },
        { id: 'support', name: 'Support.ump', code: 'class Order {}', dirty: false, savedCode: 'class Order {}', undoStack: [], redoStack: [] },
      ],
    })
  })

  afterEach(() => {
    cleanup()
    resetExecutionState()
  })

  it('renders execution headings as structured text instead of raw html', () => {
    useEphemeralStore.setState({
      executionOutput: '<strong>For main method in class Shape2D:</strong>\n\nJava result:\nhello world\n',
    })

    render(
      <TooltipProvider>
        <OutputPanel />
      </TooltipProvider>,
    )

    expect(screen.getByText('For main method in class Shape2D:')).toBeTruthy()
    expect(screen.getByText(/Java result:/)).toBeTruthy()
    expect(screen.queryByText(/<strong>For main method in class Shape2D:/)).toBeNull()
  })

  it('renders more information link and clicking line requests an editor jump on the correct tab', async () => {
    const user = userEvent.setup()
    useEphemeralStore.setState({
      parsedIssues: [
        {
          severity: 1,
          errorCode: 'E1',
          message: 'Parsing error: namespce, did you mean namespace',
          line: 9,
          filename: 'Support.ump',
          url: 'https://cruise.umple.org/umple/UmpleReference/Namespace.html',
        },
      ],
      outputErrorCount: 1,
    })

    render(
      <TooltipProvider>
        <OutputPanel />
      </TooltipProvider>,
    )

    expect(screen.getByText('error')).toBeTruthy()
    expect(screen.getByText(/: Parsing error: namespce, did you mean namespace/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'More information (E1)' }).getAttribute('href')).toBe(
      'https://cruise.umple.org/umple/UmpleReference/Namespace.html',
    )
    expect(screen.getByText('Support.ump')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /line 9/i }))

    expect(useSessionStore.getState().activeTabId).toBe('support')
    expect(useEphemeralStore.getState().pendingEditorJump).toEqual({
      tabId: 'support',
      line: 9,
    })
  })
})

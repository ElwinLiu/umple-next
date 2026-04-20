// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { OutputPanel } from '../ExecutionPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useEphemeralStore } from '@/stores/ephemeralStore'

function resetExecutionState() {
  useEphemeralStore.setState({
    executing: false,
    executionOutput: '',
    executionErrors: null,
    parsedIssues: [],
    rawErrorText: '',
    outputErrorCount: 0,
    outputWarningCount: 0,
  })
}

describe('ExecutionPanel', () => {
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
})

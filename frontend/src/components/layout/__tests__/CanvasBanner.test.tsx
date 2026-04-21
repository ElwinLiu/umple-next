// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CanvasBanner } from '../CanvasBanner'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { useSessionStore } from '@/stores/sessionStore'

vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  cleanup()
  useEphemeralStore.setState({
    diagramOnly: false,
    outputView: 'hidden',
    rightPanelView: 'diagram',
    generationRequested: false,
    generatingCode: false,
    generatedTargetId: 'Java',
  })
  useSessionStore.setState({
    viewMode: 'class',
    generateTargetId: 'classDiagram',
  })
})

describe('CanvasBanner', () => {
  it('shows the current rendered output label', () => {
    useEphemeralStore.setState({
      rightPanelView: 'generated',
      generatedTargetId: 'Java',
    })

    render(<CanvasBanner />)

    expect(screen.getByText('Java Code')).toBeDefined()
  })

  it('switches the fullscreen control copy for generated output', () => {
    useEphemeralStore.setState({
      rightPanelView: 'generated',
      generatedTargetId: 'Java',
    })

    render(<CanvasBanner />)

    const button = screen.getByRole('button', { name: 'Output only' })
    fireEvent.click(button)

    expect(useEphemeralStore.getState().diagramOnly).toBe(true)
    expect(screen.getByRole('button', { name: 'Show editor' })).toBeDefined()
  })

  it("keeps Ctrl+' bound to the output panel toggle", () => {
    render(<CanvasBanner />)

    fireEvent.keyDown(window, { key: "'", ctrlKey: true })
    expect(useEphemeralStore.getState().outputView).toBe('panel')

    fireEvent.keyDown(window, { key: "'", ctrlKey: true })
    expect(useEphemeralStore.getState().outputView).toBe('hidden')
  })

  it('renders centered operations content while keeping the label separate', () => {
    render(<CanvasBanner operationsContent={<div>Toolbar</div>} />)

    expect(screen.getByText('GraphViz Class Diagram')).toBeDefined()
    expect(screen.getByText('Toolbar')).toBeDefined()
    expect(screen.getByTestId('canvas-banner-leading')).toBeDefined()
    expect(screen.getByTestId('canvas-banner-operations')).toBeDefined()
    expect(screen.getByTestId('canvas-banner-operations-content')).toBeDefined()
  })
})

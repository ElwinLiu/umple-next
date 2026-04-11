// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { CanvasBanner } from '../CanvasBanner'
import { useEphemeralStore } from '@/stores/ephemeralStore'

vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/combobox', () => ({
  Combobox: () => <button type="button">Change language</button>,
}))

vi.mock('@/hooks/useGenerate', () => ({
  useGenerate: () => vi.fn(),
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
})

describe('CanvasBanner', () => {
  it('does not switch canvas tabs with Ctrl+number', () => {
    useEphemeralStore.setState({
      rightPanelView: 'generated',
      generationRequested: true,
      generatedTargetId: 'Java',
    })

    render(<CanvasBanner />)

    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    expect(useEphemeralStore.getState().rightPanelView).toBe('generated')

    useEphemeralStore.setState({ rightPanelView: 'diagram' })
    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    expect(useEphemeralStore.getState().rightPanelView).toBe('diagram')
  })

  it("keeps Ctrl+' bound to the output panel toggle", () => {
    render(<CanvasBanner />)

    fireEvent.keyDown(window, { key: "'", ctrlKey: true })
    expect(useEphemeralStore.getState().outputView).toBe('panel')

    fireEvent.keyDown(window, { key: "'", ctrlKey: true })
    expect(useEphemeralStore.getState().outputView).toBe('hidden')
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DiagramPanel } from '../DiagramPanel'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { useSessionStore } from '@/stores/sessionStore'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('../CanvasToolbar', () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar" />,
}))

vi.mock('../UmpleDiagram', () => ({
  UmpleDiagram: () => <div data-testid="umple-diagram" />,
}))

vi.mock('../SmartSvgView', () => ({
  SmartSvgView: () => <div data-testid="smart-svg-view" />,
}))

vi.mock('../HtmlDiagramView', () => ({
  HtmlDiagramView: () => <div data-testid="html-diagram-view" />,
}))

vi.mock('../../layout/CanvasBanner', () => ({
  CanvasBanner: () => <div data-testid="canvas-banner" />,
}))

vi.mock('../../generation/GeneratedOutputView', () => ({
  GeneratedOutputView: () => <div data-testid="generated-output-view" />,
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  useSessionStore.setState({
    code: '',
    modelId: null,
    viewMode: 'class',
    svgCache: {},
    htmlCache: {},
    umpleModel: null,
    classLayout: null,
  })
  useEphemeralStore.setState({
    rightPanelView: 'diagram',
    renderMode: 'editable',
    generatedCode: '',
    generatedHtml: '',
    generatedKind: 'text',
    generatedIframeUrl: null,
    generatedDownloads: [],
    generatedLanguage: 'Java',
    generatingCode: false,
    generatedError: null,
    generationRequested: false,
    lastError: null,
  })
})

describe('DiagramPanel', () => {
  it('shows and dismisses the diagram reminder banner', () => {
    useEphemeralStore.setState({
      lastError: 'Methods cannot be added to association classes from the diagram.',
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByText('Methods cannot be added to association classes from the diagram.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss diagram reminder' }))

    expect(useEphemeralStore.getState().lastError).toBeNull()
  })
})

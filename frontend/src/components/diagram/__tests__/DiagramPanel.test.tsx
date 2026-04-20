// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DiagramPanel } from '../DiagramPanel'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { useSessionStore } from '@/stores/sessionStore'
import { TooltipProvider } from '@/components/ui/tooltip'

const rendererProps = vi.hoisted(() => ({
  umpleEditable: [] as boolean[],
}))

vi.mock('../CanvasToolbar', () => ({
  CanvasToolbar: ({ hasDiagram, canToggleRenderer, renderMode, onRenderModeChange }: any) => {
    if (!hasDiagram) return null

    return (
      <div data-testid="canvas-toolbar">
        {canToggleRenderer && (
          <button
            role="switch"
            aria-checked={renderMode === 'graphviz'}
            onClick={() => onRenderModeChange(renderMode === 'graphviz' ? 'editable' : 'graphviz')}
          />
        )}
      </div>
    )
  },
}))

vi.mock('../UmpleDiagram', () => ({
  UmpleDiagram: ({ editable = true }: { editable?: boolean }) => {
    rendererProps.umpleEditable.push(editable)
    return <div data-testid="umple-diagram" data-editable={String(editable)} />
  },
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
  window.localStorage?.clear?.()
  rendererProps.umpleEditable.length = 0
  useSessionStore.setState({
    code: '',
    modelId: null,
    viewMode: 'class',
    diagramData: {},
    svgCache: {},
    htmlCache: {},
    umpleModel: null,
    classLayout: null,
    storedLayout: null,
  })
  useEphemeralStore.setState({
    rightPanelView: 'diagram',
    renderMode: 'graphviz',
    generatingOutput: false,
    generatedCode: '',
    generatedHtml: '',
    generatedKind: 'text',
    generatedIframeUrl: null,
    generatedDownloads: [],
    generatedLanguage: 'Java',
    generatingCode: false,
    generatedError: null,
    generationRequested: false,
  })
})

describe('DiagramPanel', () => {
  it('keeps both class renderers mounted while disabling edit interactions in GV mode', () => {
    useSessionStore.setState({
      viewMode: 'class',
      svgCache: {
        class: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
      },
      umpleModel: {
        umpleClasses: [{ name: 'Account' }],
      } as any,
      storedLayout: null,
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    const umpleDiagram = screen.getByTestId('umple-diagram')
    const smartSvgView = screen.getByTestId('smart-svg-view')
    const switchControl = screen.getByRole('switch')

    expect(umpleDiagram.getAttribute('data-editable')).toBe('false')
    expect(smartSvgView).toBeDefined()

    fireEvent.click(switchControl)

    expect(screen.getByTestId('umple-diagram').getAttribute('data-editable')).toBe('true')
    expect(screen.getByTestId('smart-svg-view')).toBeDefined()

    fireEvent.click(switchControl)

    expect(screen.getByTestId('umple-diagram').getAttribute('data-editable')).toBe('false')
    expect(screen.getByTestId('smart-svg-view')).toBeDefined()
    expect(rendererProps.umpleEditable).toEqual([false, true, false])
  })

  it('does not show the class loading state unless a compile is active', () => {
    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.queryByText('Loading diagram...')).toBeNull()
  })

  it('hides the toolbar when the active view has no rendered diagram', () => {
    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.queryByTestId('canvas-toolbar')).toBeNull()
  })

  it('shows the toolbar for graphviz-only views with SVG output', () => {
    useSessionStore.setState({
      viewMode: 'state',
      svgCache: {
        state: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
      },
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('canvas-toolbar')).toBeDefined()
  })

  it('shows the toolbar for html views with rendered output', () => {
    useSessionStore.setState({
      viewMode: 'structure',
      htmlCache: {
        structure: '<div>diagram</div>',
      },
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('canvas-toolbar')).toBeDefined()
  })

  it('shows the class loading state while generating without an editable model', () => {
    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    // Simulate: user was in editable mode, then a regenerate starts
    act(() => {
      useEphemeralStore.setState({ renderMode: 'editable', generatingOutput: true })
    })

    expect(screen.getByText('Loading diagram...')).toBeDefined()
  })

  it('shows an open examples action on an empty canvas', () => {
    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('empty-canvas-open-examples')).toBeDefined()
  })
})

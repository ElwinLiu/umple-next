// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DiagramPanel } from '../DiagramPanel'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useSessionStore } from '@/stores/sessionStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { buildCompileSourceSignature } from '@/lib/compileSource'

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
  CanvasBanner: ({ operationsContent }: any) => <div data-testid="canvas-banner">{operationsContent}</div>,
}))

vi.mock('../../generation/GeneratedOutputView', () => ({
  GeneratedOutputView: () => <div data-testid="generated-output-view" />,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

afterEach(() => {
  cleanup()
  window.localStorage?.clear?.()
  rendererProps.umpleEditable.length = 0
  useSessionStore.setState({
    code: '',
    modelId: null,
    activeTabId: 'main',
    tabs: [{ id: 'main', name: 'Model.ump', code: '', dirty: false, savedCode: '', undoStack: [], redoStack: [] }],
    tabsVersion: 0,
    generateTargetId: 'classDiagram',
    viewMode: 'class',
    diagramData: {},
    svgCache: {},
    htmlCache: {},
    umpleModel: null,
    classLayout: null,
    storedLayout: null,
  })
  useEphemeralStore.setState({
    diagramOnly: false,
    rightPanelView: 'diagram',
    renderMode: 'graphviz',
    generatingOutput: false,
    generatedCode: '',
    generatedHtml: '',
    generatedKind: 'text',
    generatedIframeUrl: null,
    generatedDownloads: [],
    generatedFiles: [],
    generatedLanguage: 'Java',
    generatedSourceCode: null,
    generatedSourceTabId: null,
    generatedSourceSignature: null,
    generatingCode: false,
    generatedError: null,
    generationRequested: false,
    generationSuspendedByError: false,
    generationErrorSourceCode: null,
    generationErrorSourceTabId: null,
    generationErrorSourceSignature: null,
    diagramSourceCode: null,
    diagramSourceTabId: null,
    diagramSourceSignature: null,
    diagramTargetId: null,
  })
  usePreferencesStore.setState({ dynamicGeneration: true })
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

  it('greys and freezes generated output when manual generation becomes stale', () => {
    usePreferencesStore.setState({ dynamicGeneration: false })
    const staleSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class Invoice { number; }' }],
      'main',
    )
    useSessionStore.setState({
      code: 'class UpdatedInvoice { number; }',
      activeTabId: 'main',
    })
    useEphemeralStore.setState({
      rightPanelView: 'generated',
      generatedCode: 'class InvoiceGenerated {}',
      generatedSourceCode: 'class Invoice { number; }',
      generatedSourceTabId: 'main',
      generatedSourceSignature: staleSignature,
      generationRequested: true,
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('generated-output-view')).toBeDefined()
    expect(screen.getByTestId('generated-output-stale-overlay')).toBeDefined()
    expect(screen.getByText('Output is out of date. Use Regenerate above to refresh it.')).toBeDefined()
  })

  it('treats fullscreen generated output like manual mode for staleness', () => {
    usePreferencesStore.setState({ dynamicGeneration: true })
    const staleSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class Invoice { number; }' }],
      'main',
    )
    useSessionStore.setState({
      code: 'class UpdatedInvoice { number; }',
      activeTabId: 'main',
    })
    useEphemeralStore.setState({
      diagramOnly: true,
      rightPanelView: 'generated',
      generatedCode: 'class InvoiceGenerated {}',
      generatedSourceCode: 'class Invoice { number; }',
      generatedSourceTabId: 'main',
      generatedSourceSignature: staleSignature,
      generationRequested: true,
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('generated-output-view')).toBeDefined()
    expect(screen.getByTestId('generated-output-stale-overlay')).toBeDefined()
    expect(screen.getByText('Output is out of date. Use Regenerate above to refresh it.')).toBeDefined()
  })

  it('greys and freezes diagram output when manual generation becomes stale', () => {
    usePreferencesStore.setState({ dynamicGeneration: false })
    const staleSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class Invoice { number; }' }],
      'main',
    )
    useSessionStore.setState({
      code: 'class UpdatedInvoice { number; }',
      activeTabId: 'main',
      viewMode: 'class',
      generateTargetId: 'classDiagram',
      svgCache: {
        class: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
      },
    })
    useEphemeralStore.setState({
      rightPanelView: 'diagram',
      diagramSourceCode: 'class Invoice { number; }',
      diagramSourceTabId: 'main',
      diagramSourceSignature: staleSignature,
      diagramTargetId: 'classDiagram',
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('smart-svg-view')).toBeDefined()
    expect(screen.getByTestId('diagram-output-stale-overlay')).toBeDefined()
    expect(screen.getByText('Diagram is out of date.')).toBeDefined()
    expect(screen.getByText('Use Regenerate above to refresh it.')).toBeDefined()
  })

  it('keeps diagram output stale in dynamic mode after a compile error', () => {
    usePreferencesStore.setState({ dynamicGeneration: true })
    const freshSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class Invoice { number; }' }],
      'main',
    )
    const erroredSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class Invoice { number }' }],
      'main',
    )
    useSessionStore.setState({
      code: 'class Invoice { number }',
      activeTabId: 'main',
      viewMode: 'class',
      generateTargetId: 'classDiagram',
      svgCache: {
        class: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
      },
    })
    useEphemeralStore.setState({
      rightPanelView: 'diagram',
      diagramSourceCode: 'class Invoice { number; }',
      diagramSourceTabId: 'main',
      diagramSourceSignature: freshSignature,
      diagramTargetId: 'classDiagram',
      generationSuspendedByError: true,
      generationErrorSourceCode: 'class Invoice { number }',
      generationErrorSourceTabId: 'main',
      generationErrorSourceSignature: erroredSignature,
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('smart-svg-view')).toBeDefined()
    expect(screen.getByTestId('diagram-output-stale-overlay')).toBeDefined()
    expect(screen.getByText('Diagram is out of date.')).toBeDefined()
    expect(screen.getByText('Fix the error in the code.')).toBeDefined()
  })

  it('does not freeze the current dynamic output because another input failed to compile', () => {
    usePreferencesStore.setState({ dynamicGeneration: true })
    const currentSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class UpdatedInvoice { number; }' }],
      'main',
    )
    const otherSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class Broken { number }' }],
      'other-tab',
    )
    useSessionStore.setState({
      code: 'class UpdatedInvoice { number; }',
      activeTabId: 'main',
      viewMode: 'class',
      generateTargetId: 'classDiagram',
      svgCache: {
        class: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
      },
    })
    useEphemeralStore.setState({
      rightPanelView: 'diagram',
      diagramSourceCode: 'class Invoice { number; }',
      diagramSourceTabId: 'main',
      diagramSourceSignature: currentSignature,
      diagramTargetId: 'classDiagram',
      generationSuspendedByError: true,
      generationErrorSourceCode: 'class Broken { number }',
      generationErrorSourceTabId: 'other-tab',
      generationErrorSourceSignature: otherSignature,
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('smart-svg-view')).toBeDefined()
    expect(screen.queryByTestId('diagram-output-stale-overlay')).toBeNull()
  })

  it('keeps the current diagram visible and stale after a manual-mode target switch', () => {
    usePreferencesStore.setState({ dynamicGeneration: false })
    const currentSignature = buildCompileSourceSignature(
      [{ id: 'main', name: 'Model.ump', code: 'class Invoice { number; }' }],
      'main',
    )
    useSessionStore.setState({
      code: 'class Invoice { number; }',
      activeTabId: 'main',
      viewMode: 'class',
      generateTargetId: 'stateDiagram',
      svgCache: {
        class: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
      },
    })
    useEphemeralStore.setState({
      rightPanelView: 'diagram',
      diagramSourceCode: 'class Invoice { number; }',
      diagramSourceTabId: 'main',
      diagramSourceSignature: currentSignature,
      diagramTargetId: 'classDiagram',
    })

    render(
      <TooltipProvider>
        <DiagramPanel />
      </TooltipProvider>
    )

    expect(screen.getByTestId('smart-svg-view')).toBeDefined()
    expect(screen.getByTestId('diagram-output-stale-overlay')).toBeDefined()
    expect(screen.getByText('Diagram is out of date.')).toBeDefined()
  })
})

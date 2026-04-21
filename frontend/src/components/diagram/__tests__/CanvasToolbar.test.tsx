// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useSessionStore } from '@/stores/sessionStore'
import { CanvasToolbar } from '../CanvasToolbar'

describe('CanvasToolbar', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    usePreferencesStore.setState({
      showAttributes: true,
      showMethods: false,
      showOrthogonalEdges: false,
      showTraits: false,
      showActions: true,
      showTransitionLabels: false,
      showGuards: true,
      showGuardLabels: false,
      showNaturalLanguage: true,
      showFeatureDependency: false,
      layoutAlgorithm: 'dot',
    })
    useSessionStore.setState({
      code: '',
      viewMode: 'class',
      classFilterQuery: '*',
      activeNamedFilters: [],
      activeMixsets: [],
      activeTabId: 'main',
      tabsVersion: 0,
      tabs: [{ id: 'main', name: 'Model.ump', code: '', dirty: false, savedCode: '', undoStack: [], redoStack: [] }],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the restored class filter controls only in class view', () => {
    const { rerender } = render(
      <TooltipProvider>
        <CanvasToolbar
          hasDiagram
          onExport={() => {}}
          canToggleRenderer={false}
          renderMode="graphviz"
          onRenderModeChange={() => {}}
          variant="banner"
        />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByTestId('canvas-display-options-button'))
    expect(screen.getByTestId('class-filter-group')).toBeDefined()
    expect(screen.getByTestId('class-filter-input')).toBeDefined()

    useSessionStore.setState({ viewMode: 'state' })
    rerender(
      <TooltipProvider>
        <CanvasToolbar
          hasDiagram
          onExport={() => {}}
          canToggleRenderer={false}
          renderMode="graphviz"
          onRenderModeChange={() => {}}
          variant="banner"
        />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByTestId('canvas-display-options-button'))
    expect(screen.queryByTestId('class-filter-group')).toBeNull()
  })

  it('commits the class filter query on blur', () => {
    render(
      <TooltipProvider>
        <CanvasToolbar
          hasDiagram
          onExport={() => {}}
          canToggleRenderer={false}
          renderMode="graphviz"
          onRenderModeChange={() => {}}
          variant="banner"
        />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByTestId('canvas-display-options-button'))
    const input = screen.getByTestId('class-filter-input')
    fireEvent.change(input, { target: { value: 'Invoice 2' } })
    fireEvent.blur(input)

    expect(useSessionStore.getState().classFilterQuery).toBe('Invoice 2')
  })

  it('shows named filter and mixset controls only when the code declares them', () => {
    const { unmount } = render(
      <TooltipProvider>
        <CanvasToolbar
          hasDiagram
          onExport={() => {}}
          canToggleRenderer={false}
          renderMode="graphviz"
          onRenderModeChange={() => {}}
          variant="banner"
        />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByTestId('canvas-display-options-button'))
    expect(screen.queryByText('Named Filters')).toBeNull()
    expect(screen.queryByText('Mixsets')).toBeNull()
    expect(screen.queryByTestId('class-filter-options-count')).toBeNull()

    useSessionStore.setState({
      code: 'filter Focus { include Invoice; }\nmixset Metrics { }\n',
      tabs: [{
        id: 'main',
        name: 'Model.ump',
        code: 'filter Focus { include Invoice; }\nmixset Metrics { }\n',
        dirty: false,
        savedCode: '',
        undoStack: [],
        redoStack: [],
      }],
    })

    unmount()
    render(
      <TooltipProvider>
        <CanvasToolbar
          hasDiagram
          onExport={() => {}}
          canToggleRenderer={false}
          renderMode="graphviz"
          onRenderModeChange={() => {}}
          variant="banner"
        />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByTestId('canvas-display-options-button'))
    expect(screen.getByText('Named Filters')).toBeDefined()
    expect(screen.getByText('Mixsets')).toBeDefined()
    expect(screen.getByTestId('class-filter-options-count').textContent).toContain('2 available')
  })
})

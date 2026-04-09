// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { TabBar } from '../TabBar'
import { useSessionStore } from '@/stores/sessionStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('../ExecutionPanel', () => ({
  OutputBadges: () => null,
}))

class MockIntersectionObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
}

describe('TabBar', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    localStorage.clear()
    usePreferencesStore.setState({ showSidebar: true })
    useSessionStore.setState({
      code: '',
      activeTabId: 'main',
      tabs: [{ id: 'main', name: 'model.ump', code: '', dirty: false, savedCode: '', undoStack: [], redoStack: [] }],
      tabsVersion: 0,
    })
  })

  it('focuses the rename input immediately after selecting Rename from the context menu', async () => {
    usePreferencesStore.setState({ showSidebar: true })
    useSessionStore.setState({
      code: 'class Student {}',
      activeTabId: 'main',
      tabs: [{ id: 'main', name: 'model.ump', code: 'class Student {}', dirty: false, savedCode: 'class Student {}', undoStack: [], redoStack: [] }],
      tabsVersion: 0,
    })

    render(<TooltipProvider><TabBar /></TooltipProvider>)

    // Tab display strips .ump extension
    fireEvent.contextMenu(screen.getByText('model'))

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))

    const input = await screen.findByRole('textbox', { name: 'Rename model.ump' })

    await waitFor(() => {
      expect(document.activeElement).toBe(input)
    })
    // Rename input shows display name (without .ump)
    expect((input as HTMLInputElement).value).toBe('model')
  })

  it('does not bump tabsVersion when rename is blurred without an actual name change', async () => {
    usePreferencesStore.setState({ showSidebar: true })
    useSessionStore.setState({
      code: 'class Student {}',
      activeTabId: 'main',
      tabs: [{ id: 'main', name: 'model.ump', code: 'class Student {}', dirty: false, savedCode: 'class Student {}', undoStack: [], redoStack: [] }],
      tabsVersion: 0,
    })

    render(<TooltipProvider><TabBar /></TooltipProvider>)

    fireEvent.contextMenu(screen.getByText('model'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))

    const input = await screen.findByRole('textbox', { name: 'Rename model.ump' })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Rename model.ump' })).toBeNull()
    })

    const state = useSessionStore.getState()
    expect(state.tabsVersion).toBe(0)
    expect(state.tabs[0]?.name).toBe('model.ump')
  })

})

// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { TabBar } from '../TabBar'
import { useSessionStore } from '@/stores/sessionStore'
import { usePreferencesStore } from '@/stores/preferencesStore'

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
      tabs: [{ id: 'main', name: 'model.ump', code: '', dirty: false, savedCode: '' }],
      tabsVersion: 0,
    })
  })

  it('focuses the rename input immediately after selecting Rename from the context menu', async () => {
    usePreferencesStore.setState({ showSidebar: true })
    useSessionStore.setState({
      code: 'class Student {}',
      activeTabId: 'main',
      tabs: [{ id: 'main', name: 'model.ump', code: 'class Student {}', dirty: false, savedCode: 'class Student {}' }],
      tabsVersion: 0,
    })

    render(<TabBar />)

    fireEvent.contextMenu(screen.getByText('model.ump'))

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))

    const input = await screen.findByRole('textbox', { name: 'Rename model.ump' })

    await waitFor(() => {
      expect(document.activeElement).toBe(input)
    })
    expect((input as HTMLInputElement).value).toBe('model.ump')
  })

  it('does not bump tabsVersion when rename is blurred without an actual name change', async () => {
    usePreferencesStore.setState({ showSidebar: true })
    useSessionStore.setState({
      code: 'class Student {}',
      activeTabId: 'main',
      tabs: [{ id: 'main', name: 'model.ump', code: 'class Student {}', dirty: false, savedCode: 'class Student {}' }],
      tabsVersion: 0,
    })

    render(<TabBar />)

    fireEvent.contextMenu(screen.getByText('model.ump'))
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

  it('keeps the rename field as wide as the existing tab', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.textContent?.includes('long-model-name.ump')) {
        return {
          width: 176,
          height: 30,
          top: 0,
          left: 0,
          right: 176,
          bottom: 30,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect
      }

      return originalGetBoundingClientRect.call(this)
    })

    usePreferencesStore.setState({ showSidebar: true })
    useSessionStore.setState({
      code: 'class Student {}',
      activeTabId: 'main',
      tabs: [{ id: 'main', name: 'long-model-name.ump', code: 'class Student {}', dirty: false, savedCode: 'class Student {}' }],
      tabsVersion: 0,
    })

    render(<TabBar />)

    fireEvent.contextMenu(screen.getByText('long-model-name.ump'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))

    const input = await screen.findByRole('textbox', { name: 'Rename long-model-name.ump' })
    expect((input.parentElement as HTMLElement).style.width).toBe('176px')

    rectSpy.mockRestore()
  })
})

// @vitest-environment jsdom
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'

import { UmpleEditor, type UmpleEditorHandle } from '../UmpleEditor'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useSessionStore } from '@/stores/sessionStore'

const originalMatchMedia = window.matchMedia

describe('UmpleEditor', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: () => { },
        removeEventListener: () => { },
        addListener: () => { },
        removeListener: () => { },
        dispatchEvent: () => false,
      }),
    })

    usePreferencesStore.setState({ theme: 'light' })
    useSessionStore.setState({
      code: 'class Person {}',
      activeTabId: 'tab-a',
      tabs: [
        {
          id: 'tab-a',
          name: 'Person.ump',
          code: 'class Person {}',
          dirty: false,
          savedCode: 'class Person {}',
          undoStack: [],
          redoStack: [],
        },
        {
          id: 'tab-b',
          name: 'Order.ump',
          code: 'class Order {}',
          dirty: false,
          savedCode: 'class Order {}',
          undoStack: [],
          redoStack: [],
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
  })

  it('does not overwrite the shared tab document when switching back with stale code props in collab mode', async () => {
    const doc = new Y.Doc()
    const awareness = new Awareness(doc)
    const personText = doc.getText('tab:tab-a')
    personText.insert(0, 'class Person {}')
    const orderText = doc.getText('tab:tab-b')
    orderText.insert(0, 'class Order {}')

    const ref = createRef<UmpleEditorHandle>()
    const { rerender } = render(
      <UmpleEditor
        ref={ref}
        code="class Person {}"
        activeTabId="tab-a"
        onChange={() => { }}
        collabConfig={{ ytext: personText, awareness }}
      />,
    )

    await waitFor(() => {
      expect(ref.current?.view?.state.doc.toString()).toBe('class Person {}')
    })

    useSessionStore.setState({ code: 'class Person {}', activeTabId: 'tab-b' })
    rerender(
      <UmpleEditor
        ref={ref}
        code="class Person {}"
        activeTabId="tab-b"
        onChange={() => { }}
        collabConfig={{ ytext: orderText, awareness }}
      />,
    )

    await waitFor(() => {
      expect(ref.current?.view?.state.doc.toString()).toBe('class Order {}')
    })

    useSessionStore.setState({ code: 'class Order {}', activeTabId: 'tab-a' })
    rerender(
      <UmpleEditor
        ref={ref}
        code="class Order {}"
        activeTabId="tab-a"
        onChange={() => { }}
        collabConfig={{ ytext: personText, awareness }}
      />,
    )

    await waitFor(() => {
      expect(ref.current?.view?.state.doc.toString()).toBe('class Person {}')
    })
    expect(personText.toString()).toBe('class Person {}')
  })
})

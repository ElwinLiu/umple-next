// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'

import { jumpEditorViewToLine, resolveIssueTab } from '../issueNavigation'
import type { Tab } from '@/stores/sessionStore'

const tabs: Tab[] = [
  { id: 'main', name: 'Model.ump', code: '', dirty: false, savedCode: '', undoStack: [], redoStack: [] },
  { id: 'support', name: 'Support.ump', code: '', dirty: false, savedCode: '', undoStack: [], redoStack: [] },
]

describe('issueNavigation', () => {
  it('resolves issue filenames to the matching tab', () => {
    expect(resolveIssueTab(tabs, 'main', 'Support.ump')?.id).toBe('support')
  })

  it('resolves issue paths by basename and falls back to the active tab', () => {
    expect(resolveIssueTab(tabs, 'main', 'nested/Support.ump')?.id).toBe('support')
    expect(resolveIssueTab(tabs, 'main', 'missing.ump')?.id).toBe('main')
  })

  it('jumps the editor view to the requested line', () => {
    const state = EditorState.create({
      doc: 'first\nsecond\nthird',
    })
    const focus = vi.fn()
    const dispatch = vi.fn()
    const view = {
      state,
      focus,
      dispatch,
    } as unknown as EditorView

    jumpEditorViewToLine(view, 2)

    expect(focus).toHaveBeenCalledOnce()
    const transaction = dispatch.mock.calls[0]?.[0]
    expect(transaction.selection.anchor).toBe(state.doc.line(2).from)
    expect(transaction.selection.head).toBe(state.doc.line(2).from)
  })
})

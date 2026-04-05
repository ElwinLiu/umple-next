import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { EditorView, ViewUpdate, scrollPastEnd } from '@codemirror/view'
import { EditorState, Compartment, Transaction } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { umple } from '../../codemirror/lang-umple'
import { getEditorTheme } from '../../codemirror/theme'
import { useIsDark } from '../../hooks/useIsDark'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { yCollab } from 'y-codemirror.next'
import * as Y from 'yjs'
import type { CollabConfig } from '../../hooks/useCollabEditor'

export interface UmpleEditorHandle {
  view: EditorView | null
}

interface UmpleEditorProps {
  code: string
  onChange: (code: string) => void
  readOnly?: boolean
  collabConfig?: CollabConfig | null
  onViewReady?: (view: EditorView) => void
}

export const UmpleEditor = forwardRef<UmpleEditorHandle, UmpleEditorProps>(function UmpleEditor({ code, onChange, readOnly = false, collabConfig, onViewReady }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onViewReadyRef = useRef(onViewReady)
  onViewReadyRef.current = onViewReady
  const themeCompartment = useRef(new Compartment())
  const collabCompartment = useRef(new Compartment())
  const isDark = useIsDark()

  useImperativeHandle(ref, () => ({
    get view() { return viewRef.current },
  }), [])

  // Track whether the last change was external (from props) to avoid echo
  const isExternalUpdate = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChangeRef.current(update.state.doc.toString())
      }
      isExternalUpdate.current = false

      if (update.selectionSet) {
        const { from, to } = update.state.selection.main
        if (from === to) {
          useEphemeralStore.getState().setSelection(null)
        } else {
          const fromLine = update.state.doc.lineAt(from).number
          const toLine = update.state.doc.lineAt(to).number
          const text = update.state.sliceDoc(from, to)
          const fromCoords = update.view.coordsAtPos(from)
          const toCoords = update.view.coordsAtPos(to)
          const coords = fromCoords && toCoords
            ? { x: toCoords.left, yTop: fromCoords.top, yBottom: toCoords.bottom }
            : undefined
          useEphemeralStore.getState().setSelection({ fromLine, toLine, text, coords })
        }
      }
    })

    const state = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        themeCompartment.current.of(getEditorTheme(isDark)),
        collabCompartment.current.of([]),
        umple(),
        updateListener,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
        scrollPastEnd(),
        ...(readOnly ? [EditorState.readOnly.of(true)] : []),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view
    onViewReadyRef.current?.(view)

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reconfigure theme when dark mode changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(getEditorTheme(isDark)),
    })
  }, [isDark])

  // Reconfigure collab extensions when collabConfig changes
  const undoManagerRef = useRef<Y.UndoManager | null>(null)

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    // Clean up previous UndoManager
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy()
      undoManagerRef.current = null
    }

    if (collabConfig) {
      // yCollab's YSyncPlugin does NOT do an initial content sync — it only
      // observes future changes. We must replace the editor content with
      // Y.Text content BEFORE installing yCollab so they start in sync.
      const ytextContent = collabConfig.ytext.toString()
      const currentDoc = view.state.doc.toString()
      if (currentDoc !== ytextContent) {
        isExternalUpdate.current = true
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: ytextContent },
          annotations: [Transaction.addToHistory.of(false)],
        })
        // Also update sessionStore.code so useCompiler sees Y.Text content.
        onChangeRef.current(ytextContent)
      }

      undoManagerRef.current = new Y.UndoManager(collabConfig.ytext)
      view.dispatch({
        effects: collabCompartment.current.reconfigure(
          yCollab(collabConfig.ytext, collabConfig.awareness, { undoManager: undoManagerRef.current })
        ),
      })
    } else {
      view.dispatch({
        effects: collabCompartment.current.reconfigure([]),
      })
    }
  }, [collabConfig])

  // Sync external code changes into the editor.
  // In collab mode, write to Y.Text (e.g., loading an example) so the change
  // propagates via yCollab to the editor and to other clients.
  // Without collab, dispatch directly to the editor.
  useEffect(() => {
    if (collabConfig) {
      const currentYText = collabConfig.ytext.toString()
      if (currentYText !== code) {
        collabConfig.ytext.doc?.transact(() => {
          collabConfig.ytext.delete(0, collabConfig.ytext.length)
          collabConfig.ytext.insert(0, code)
        })
      }
      return
    }

    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== code) {
      isExternalUpdate.current = true
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: code },
        annotations: [Transaction.addToHistory.of(false)],
      })
    }
  }, [code, collabConfig])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      data-testid="umple-editor"
    />
  )
})

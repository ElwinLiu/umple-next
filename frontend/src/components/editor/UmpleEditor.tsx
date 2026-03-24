import { useEffect, useRef, useCallback } from 'react'
import { EditorView, ViewUpdate, scrollPastEnd } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { umple } from '../../codemirror/lang-umple'
import { getEditorTheme } from '../../codemirror/theme'
import { useIsDark } from '../../hooks/useIsDark'
import { useEphemeralStore } from '../../stores/ephemeralStore'

interface UmpleEditorProps {
  code: string
  onChange: (code: string) => void
  readOnly?: boolean
}

export function UmpleEditor({ code, onChange, readOnly = false }: UmpleEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const themeCompartment = useRef(new Compartment())
  const isDark = useIsDark()

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

  // Sync external code changes into the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== code) {
      isExternalUpdate.current = true
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: code },
      })
    }
  }, [code])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      data-testid="umple-editor"
    />
  )
}

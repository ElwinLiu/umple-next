import { useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { TabBar } from './TabBar'
import { UmpleEditor, type UmpleEditorHandle } from './UmpleEditor'
import { UmpleDiffEditor } from './UmpleDiffEditor'
import { SelectionToolbar } from './SelectionToolbar'
import { EditorContextMenu } from './EditorContextMenu'
import { useSessionStore, getActiveTabName } from '../../stores/sessionStore'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useCollabEditor } from '../../hooks/useCollabEditor'
import { useCollabTabs } from '../../hooks/useCollabTabs'
import { useLsp } from '../../hooks/useLsp'
import { attachLspToView } from '../../codemirror/lsp'

interface DiagramSelectDetail {
  name: string
  kind: 'node' | 'edge'
}

const AgentPanel = lazy(() => import('../agent/AgentPanel'))

/**
 * Find the character range of a top-level class/interface/trait definition in Umple source.
 * Matches brace depth to find the full block extent.
 */
function findClassRange(code: string, className: string): { from: number; to: number } | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(associationClass|class|interface|trait)\\s+${escaped}(\\s|\\{|$)`)
  const match = pattern.exec(code)
  if (!match) return null

  const from = match.index
  let braceCount = 0
  let foundOpen = false
  for (let i = from; i < code.length; i++) {
    if (code[i] === '{') { braceCount++; foundOpen = true }
    else if (code[i] === '}') {
      braceCount--
      if (foundOpen && braceCount === 0) return { from, to: i + 1 }
    }
  }
  // No braces — select to end of line
  const eol = code.indexOf('\n', from)
  return { from, to: eol === -1 ? code.length : eol }
}

export function EditorPanel() {
  const code = useSessionStore((s) => s.code)
  const setCode = useSessionStore((s) => s.setCode)
  const collabConfig = useCollabEditor()
  useCollabTabs()
  const diffPreview = useEphemeralStore((s) => s.diffPreview)
  const readOnly = useEphemeralStore((s) => s.readOnly)
  const isAiConfigured = usePreferencesStore(
    (s) => {
      const activeConfig = s.configs[s.activeProvider]
      return !!(activeConfig.apiKey.trim() && activeConfig.model.trim())
    },
  )

  const editorRef = useRef<UmpleEditorHandle>(null)
  // Stable ref wrapper that useLsp can poll for the current EditorView
  const editorViewRef = useRef<EditorView | null>(null)
  // Keep editorViewRef in sync via a layout effect after each render
  useEffect(() => {
    editorViewRef.current = editorRef.current?.view ?? null
  })
  useLsp(editorViewRef)

  // When UmpleEditor mounts, attach LSP to the view.
  const handleViewReady = useCallback((view: EditorView) => {
    editorViewRef.current = view
    attachLspToView(view, getActiveTabName())
  }, [])

  // When a diagram node/edge is clicked, select the corresponding source text.
  // Uses a native DOM CustomEvent so delivery is synchronous and framework-independent.
  useEffect(() => {
    const handler = (e: Event) => {
      const { name, kind } = (e as CustomEvent<DiagramSelectDetail>).detail
      const view = editorRef.current?.view
      if (!view) return

      const doc = view.state.doc.toString()
      const className = kind === 'edge'
        ? name.split(/->|--/)[0].trim()
        : name

      const range = findClassRange(doc, className)
      if (!range) return

      view.dispatch({
        selection: EditorSelection.create([
          EditorSelection.range(range.to, range.from),
        ]),
        effects: EditorView.scrollIntoView(range.from, { y: 'center' }),
      })
    }

    window.addEventListener('umple:diagram-select', handler)
    return () => window.removeEventListener('umple:diagram-select', handler)
  }, [])

  const handleChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [setCode])

  return (
    <div className="relative flex h-full flex-col" data-testid="editor-panel">
      <TabBar />
      <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-0">
        {diffPreview ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-border bg-surface-1 px-4 py-2">
              <p className="text-xs font-medium text-ink">{diffPreview.title}</p>
              <p className="text-xxs text-ink-muted">{diffPreview.description}</p>
            </div>
            <div className="min-h-0 flex-1">
              <UmpleDiffEditor
                key={diffPreview.toolCallId}
                originalCode={diffPreview.originalCode}
                proposedCode={diffPreview.proposedCode}
              />
            </div>
          </div>
        ) : (
          <EditorContextMenu editorRef={editorRef}>
            <div className="h-full w-full">
              <UmpleEditor
                ref={editorRef}
                code={code}
                onChange={handleChange}
                readOnly={readOnly}
                collabConfig={collabConfig}
                onViewReady={handleViewReady}
              />
            </div>
          </EditorContextMenu>
        )}
        {isAiConfigured && (
          <>
            <SelectionToolbar />
            <Suspense>
              <AgentPanel />
            </Suspense>
          </>
        )}
      </div>
    </div>
  )
}

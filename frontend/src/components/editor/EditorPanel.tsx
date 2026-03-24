import { useCallback, lazy, Suspense } from 'react'
import { TabBar } from './TabBar'
import { UmpleEditor } from './UmpleEditor'
import { UmpleDiffEditor } from './UmpleDiffEditor'
import { SelectionToolbar } from './SelectionToolbar'
import { useSessionStore } from '../../stores/sessionStore'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { usePreferencesStore } from '@/stores/preferencesStore'

const AgentPanel = lazy(() => import('../agent/AgentPanel'))

export function EditorPanel() {
  const code = useSessionStore((s) => s.code)
  const setCode = useSessionStore((s) => s.setCode)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const diffPreview = useEphemeralStore((s) => s.diffPreview)
  const isAiConfigured = usePreferencesStore(
    (s) => {
      const activeConfig = s.configs[s.activeProvider]
      return !!(activeConfig.apiKey.trim() && activeConfig.model.trim())
    },
  )

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
          <UmpleEditor key={activeTabId} code={code} onChange={handleChange} />
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

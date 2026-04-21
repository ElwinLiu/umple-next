import { useEffect } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useSessionStore } from '../../stores/sessionStore'
import { getGenerateTarget, getGenerateTargetIdForView } from '../../generation/targets'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function CanvasBanner() {
  const diagramOnly = useEphemeralStore((s) => s.diagramOnly)
  const setDiagramOnly = useEphemeralStore((s) => s.setDiagramOnly)
  const rightPanelView = useEphemeralStore((s) => s.rightPanelView)
  const generateTargetId = useSessionStore((s) => s.generateTargetId)
  const viewMode = useSessionStore((s) => s.viewMode)
  const generatedTargetId = useEphemeralStore((s) => s.generatedTargetId)
  const diagramTargetId = useEphemeralStore((s) => s.diagramTargetId)
  const currentOutputTargetId = rightPanelView === 'generated'
    ? generatedTargetId
    : diagramTargetId ?? getGenerateTargetIdForView(viewMode) ?? generateTargetId
  const currentOutputLabel = getGenerateTarget(currentOutputTargetId)?.label ?? 'Output'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault()
        e.stopPropagation()
        useEphemeralStore.getState().toggleOutputPanel()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center h-[var(--toolbar-h)] px-3 shrink-0 border-b border-border" data-testid="canvas-banner">
      <div />
      <div className="flex items-center justify-center gap-1.5 min-w-0 overflow-hidden">
        <span className="truncate rounded-full border border-border bg-surface-0 px-2.5 py-1 text-xs text-ink-muted">
          {currentOutputLabel}
        </span>
      </div>

      <div className="flex items-center justify-end gap-1">
        <Tip content={diagramOnly ? 'Show editor' : 'Diagram only'} side="bottom">
          <button
            onClick={() => setDiagramOnly(!diagramOnly)}
            className={cn(
              'p-1.5 transition-colors cursor-pointer rounded-md',
              diagramOnly ? 'text-brand bg-brand-light' : 'text-ink-muted hover:text-ink hover:bg-surface-1'
            )}
            aria-label={diagramOnly ? 'Show editor' : 'Diagram only'}
          >
            {diagramOnly ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </Tip>
      </div>
    </div>
  )
}

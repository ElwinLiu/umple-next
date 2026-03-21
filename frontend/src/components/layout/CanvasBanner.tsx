import { useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { useExecute } from '../../hooks/useExecute'
import { Play, Loader2, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'

const VIEW_MODES: { value: DiagramView; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'state', label: 'State' },
  { value: 'feature', label: 'Feature' },
  { value: 'structure', label: 'Structure' },
]

export function CanvasBanner() {
  const { diagramOnly, setDiagramOnly } = useUiStore()
  const { compiling, lastError, viewMode, setViewMode } = useDiagramStore()
  const { execute, running } = useExecute()

  // Ctrl+' shortcut to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault()
        e.stopPropagation()
        execute()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [execute])

  return (
    <div className="flex items-center justify-between h-[38px] px-3 shrink-0 bg-surface-2 border-b border-border" data-testid="canvas-banner">
      {/* Left: Status + Run + Diagram dropdown */}
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        {compiling ? (
          <span className="flex items-center gap-1.5 text-status-warning text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />
            Compiling
          </span>
        ) : lastError ? (
          <Tip content={lastError} side="bottom">
            <span className="flex items-center gap-1.5 text-status-error text-[11px] max-w-[200px] truncate cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-status-error shrink-0" />
              {lastError}
            </span>
          </Tip>
        ) : null}

        {/* Run button */}
        <Tip content="Run (Ctrl+')" side="bottom">
          <button
            onClick={execute}
            disabled={running}
            aria-label={running ? 'Running code' : "Run code (Ctrl+')"}
            data-testid="run-code-button"
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer rounded-md hover:bg-border text-ink disabled:cursor-not-allowed bg-surface-0/60"
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin text-ink-muted" />
            ) : (
              <Play className="size-3 text-ink-muted" />
            )}
            {running ? 'Running...' : 'Run'}
          </button>
        </Tip>

        {/* Diagram view mode dropdown */}
        <DropdownMenu>
          <Tip content="Diagram view" side="bottom">
            <DropdownMenuTrigger className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-ink-muted rounded-md hover:text-ink hover:bg-surface-0/60 transition-colors cursor-pointer outline-none" aria-label="Diagram view">
              {VIEW_MODES.find((m) => m.value === viewMode)?.label ?? 'Class'}
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="start" className="w-32">
            <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => setViewMode(v as DiagramView)}>
              {VIEW_MODES.map((m) => (
                <DropdownMenuRadioItem key={m.value} value={m.value} data-testid={`diagram-view-${m.value}`}>
                  {m.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Fullscreen toggle */}
      <div className="flex items-center gap-1">
        <Tip content={diagramOnly ? 'Show editor' : 'Diagram only'} side="bottom">
          <button
            onClick={() => setDiagramOnly(!diagramOnly)}
            className={`p-1.5 transition-colors cursor-pointer rounded-md ${
              diagramOnly ? 'text-brand bg-brand-light' : 'text-ink-muted hover:text-ink hover:bg-surface-0/60'
            }`}
            aria-label={diagramOnly ? 'Show editor' : 'Diagram only'}
          >
            {diagramOnly ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </Tip>
      </div>
    </div>
  )
}

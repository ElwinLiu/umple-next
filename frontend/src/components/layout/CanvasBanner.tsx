import { useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { useExecute } from '../../hooks/useExecute'
import { useGenerate } from '../../hooks/useGenerate'
import { UMPLE_TARGETS } from '../../api/types'
import { Play, Loader2, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  const {
    diagramOnly, setDiagramOnly,
    rightPanelView, setRightPanelView,
    generatedLanguage, generatingCode,
    generationRequested,
  } = useUiStore()
  const { viewMode, setViewMode } = useDiagramStore()
  const { execute, running } = useExecute()
  const handleGenerate = useGenerate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault()
        e.stopPropagation()
        execute()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        e.stopPropagation()
        useUiStore.getState().setRightPanelView('diagram')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        if (useUiStore.getState().generationRequested) {
          e.preventDefault()
          e.stopPropagation()
          useUiStore.getState().setRightPanelView('generated')
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [execute])

  return (
    <div className="relative flex items-center justify-between h-[38px] px-3 shrink-0 bg-surface-2 border-b border-border" data-testid="canvas-banner">
      <div className="flex items-center gap-2">
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

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5">
        <Tip content="Diagram (Ctrl+1)" side="bottom">
          <button
            onClick={() => setRightPanelView('diagram')}
            className={`text-[11px] px-2.5 py-1 cursor-pointer transition-colors ${
              rightPanelView === 'diagram'
                ? 'text-brand font-semibold border-b-2 border-brand'
                : 'text-ink-muted font-medium hover:text-ink'
            }`}
          >
            Diagram
          </button>
        </Tip>
        {generationRequested && (
          <div className="flex items-center">
            <Tip content="Generated code (Ctrl+2)" side="bottom">
              <button
                onClick={() => setRightPanelView('generated')}
                className={`text-[11px] px-2.5 py-1 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  rightPanelView === 'generated'
                    ? 'text-brand font-semibold border-b-2 border-brand'
                    : 'text-ink-muted font-medium hover:text-ink'
                }`}
              >
                {generatingCode && <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />}
                {generatedLanguage}
              </button>
            </Tip>
            <DropdownMenu>
              <Tip content="Change language" side="bottom">
                <DropdownMenuTrigger
                  className="px-1 py-0.5 text-[11px] transition-colors cursor-pointer outline-none text-ink-faint hover:text-ink-muted"
                  aria-label="Change language"
                >
                  <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="start" className="w-40 max-h-52">
                {UMPLE_TARGETS.map((target) => (
                  <DropdownMenuItem
                    key={target}
                    onSelect={() => handleGenerate(target)}
                    className={`text-xs ${target === generatedLanguage ? 'bg-brand-light text-brand font-semibold' : ''}`}
                  >
                    {target}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

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

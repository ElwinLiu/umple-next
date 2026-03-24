import { useEffect, useRef, useState } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useSessionStore, type DiagramView } from '../../stores/sessionStore'
import { useCompile } from '../../hooks/useExecute'
import { useGenerate } from '../../hooks/useGenerate'
import { GENERATE_TARGETS } from '../../generation/targets'
import { Hammer, Loader2, Check, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { lineTabClasses } from '@/components/ui/line-tab'
import { cn } from '@/lib/utils'
import { VIEW_MODE_GROUPS, ALL_VIEW_MODES, PINNED_VIEW_MODES } from '../../constants/diagram'
import { getGenerateTarget } from '../../generation/targets'

export function CanvasBanner() {
  const {
    diagramOnly, setDiagramOnly,
    rightPanelView, setRightPanelView,
    generatedTargetId, generatingCode,
    generationRequested, executing,
  } = useEphemeralStore()
  const viewMode = useSessionStore((s) => s.viewMode)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const { compile } = useCompile()
  const compiling = useEphemeralStore((s) => s.compiling)
  const errorCount = useEphemeralStore((s) => s.outputErrorCount)
  const handleGenerate = useGenerate()

  // Compile success micro-interaction
  const prevCompilingRef = useRef(compiling)
  const [justCompiled, setJustCompiled] = useState(false)

  useEffect(() => {
    if (prevCompilingRef.current && !compiling && errorCount === 0) {
      setJustCompiled(true)
      const timer = setTimeout(() => setJustCompiled(false), 1200)
      return () => clearTimeout(timer)
    }
    prevCompilingRef.current = compiling
  }, [compiling, errorCount])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        compile()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        e.stopPropagation()
        useEphemeralStore.getState().setRightPanelView('diagram')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        if (useEphemeralStore.getState().generationRequested) {
          e.preventDefault()
          e.stopPropagation()
          useEphemeralStore.getState().setRightPanelView('generated')
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault()
        e.stopPropagation()
        useEphemeralStore.getState().toggleOutputPanel()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [compile])

  return (
    <div className="relative flex items-center justify-between h-[38px] px-3 shrink-0 border-b border-border" data-testid="canvas-banner">
      <div className="flex items-center gap-2">
        <Tip content="Compile (Ctrl+Enter)" side="bottom">
          <button
            onClick={compile}
            disabled={compiling}
            aria-label={compiling ? 'Compiling' : 'Compile (Ctrl+Enter)'}
            data-testid="compile-button"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer rounded-md text-ink-muted hover:text-ink hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {compiling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : justCompiled ? (
              <Check className="size-3.5 text-status-success animate-fade-in" />
            ) : (
              <Hammer className="size-3.5" />
            )}
            {compiling ? 'Compiling...' : justCompiled ? <span className="text-status-success animate-fade-in">Compiled</span> : 'Compile'}
          </button>
        </Tip>

        <DropdownMenu>
          <Tip content="Diagram view" side="bottom">
            <DropdownMenuTrigger data-tour="diagram-view" className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-muted rounded-md hover:text-ink hover:bg-surface-1 transition-colors cursor-pointer outline-none" aria-label="Diagram view">
              {ALL_VIEW_MODES.find((m) => m.value === viewMode)?.label ?? 'Class'}
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => setViewMode(v as DiagramView)}>
              {PINNED_VIEW_MODES.map((pv) => {
                const m = ALL_VIEW_MODES.find((v) => v.value === pv)
                if (!m) return null
                return (
                  <DropdownMenuRadioItem key={m.value} value={m.value} data-testid={`diagram-view-${m.value}`}>
                    {m.label}
                  </DropdownMenuRadioItem>
                )
              })}
              {VIEW_MODE_GROUPS.map((group, gi) => (
                <DropdownMenuGroup key={group.label}>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                  {group.modes.filter((m) => !PINNED_VIEW_MODES.includes(m.value)).map((m) => (
                    <DropdownMenuRadioItem key={m.value} value={m.value} data-testid={`diagram-view-${m.value}`}>
                      {m.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5">
        <Tip content="Diagram (Ctrl+1)" side="bottom">
          <button
            onClick={() => setRightPanelView('diagram')}
            className={cn(lineTabClasses({ active: rightPanelView === 'diagram' }), 'text-xs px-2.5 py-1')}
          >
            Diagram
          </button>
        </Tip>
        {generationRequested && (
          <div className="flex items-center">
            <Tip content="Generated code (Ctrl+2)" side="bottom">
              <button
                onClick={() => setRightPanelView('generated')}
                className={cn(lineTabClasses({ active: rightPanelView === 'generated' }), 'text-xs px-2.5 py-1 flex items-center gap-1.5')}
              >
                {generatingCode && <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />}
                {getGenerateTarget(generatedTargetId)?.label ?? generatedTargetId}
              </button>
            </Tip>
            <DropdownMenu>
              <Tip content="Change language" side="bottom">
                <DropdownMenuTrigger
                  className="px-1 py-0.5 text-xs transition-colors cursor-pointer outline-none text-ink-faint hover:text-ink-muted"
                  aria-label="Change language"
                >
                  <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="start" className="w-40 max-h-52">
                {GENERATE_TARGETS.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onSelect={() => handleGenerate(target.id)}
                    className={`text-xs ${target.id === generatedTargetId ? 'bg-brand-light text-brand font-semibold' : ''}`}
                  >
                    {target.label}
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
      {/* Indeterminate progress bar */}
      {(compiling || generatingCode || executing) && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/4 bg-brand animate-progress-indeterminate" />
        </div>
      )}
    </div>
  )
}

import { useEffect } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useGenerate } from '../../hooks/useGenerate'
import { GENERATE_ONLY_TARGET_GROUPS, getGenerateTarget } from '../../generation/targets'
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { lineTabClasses } from '@/components/ui/line-tab'
import { cn } from '@/lib/utils'

export function CanvasBanner() {
  const diagramOnly = useEphemeralStore((s) => s.diagramOnly)
  const setDiagramOnly = useEphemeralStore((s) => s.setDiagramOnly)
  const rightPanelView = useEphemeralStore((s) => s.rightPanelView)
  const setRightPanelView = useEphemeralStore((s) => s.setRightPanelView)
  const generatedTargetId = useEphemeralStore((s) => s.generatedTargetId)
  const generatingCode = useEphemeralStore((s) => s.generatingCode)
  const generationRequested = useEphemeralStore((s) => s.generationRequested)
  const handleGenerate = useGenerate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        e.stopPropagation()
        const state = useEphemeralStore.getState()
        if (state.rightPanelView === 'generated') {
          state.setRightPanelView('diagram')
        }
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
  }, [])

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center h-[var(--toolbar-h)] px-3 shrink-0 border-b border-border" data-testid="canvas-banner">
      <div />
      <div className="flex items-center justify-center gap-0.5 min-w-0 overflow-hidden">
        <Tip content="Diagram (Ctrl+1)" side="bottom">
          <button
            onClick={() => {
              if (rightPanelView === 'generated') {
                setRightPanelView('diagram')
              }
            }}
            className={cn(lineTabClasses({ active: rightPanelView === 'diagram' }), 'text-xs px-2.5 py-1 shrink-0')}
          >
            Diagram
          </button>
        </Tip>
        {generationRequested && (
          <div className="flex items-center min-w-0">
            <Tip content="Generated code (Ctrl+2)" side="bottom">
              <button
                onClick={() => setRightPanelView('generated')}
                className={cn(lineTabClasses({ active: rightPanelView === 'generated' }), 'text-xs px-2.5 py-1 flex items-center gap-1.5 min-w-0 max-w-48')}
              >
                {generatingCode && <><span className="w-1.5 h-1.5 shrink-0 rounded-full bg-status-warning animate-pulse" aria-hidden="true" /><span className="sr-only">Generating</span></>}
                <span className="truncate">{getGenerateTarget(generatedTargetId)?.label ?? generatedTargetId}</span>
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
              <DropdownMenuContent align="start" className="w-52 max-h-64">
                {GENERATE_ONLY_TARGET_GROUPS.map((group, gi) => (
                  <DropdownMenuGroup key={group.label}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-xxs">{group.label}</DropdownMenuLabel>
                    {group.targets.map((target) => (
                      <DropdownMenuItem
                        key={target.id}
                        onSelect={() => handleGenerate(target.id)}
                        className={`text-xs ${target.id === generatedTargetId ? 'bg-brand-light text-brand font-semibold' : ''}`}
                      >
                        {target.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
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

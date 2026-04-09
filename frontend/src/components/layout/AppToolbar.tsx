import { useEffect, useRef, useState } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useSessionStore, type DiagramView } from '../../stores/sessionStore'
import { useCompile } from '../../hooks/useExecute'
import { useGenerate } from '../../hooks/useGenerate'
import { useExamples } from '../../hooks/useExamples'
import { GENERATE_TARGET_GROUPS } from '../../generation/targets'
import { AiConfigForm } from '@/components/sidebar/AiConfigForm'
import { useTaskStore } from '../../stores/taskStore'
import { ToolbarDivider } from '@/components/diagram/CanvasToolbar'
import { Hammer, Loader2, Check, ChevronDown, Code, Sparkles, ClipboardList, Plus, Search, BookOpen } from 'lucide-react'
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { VIEW_MODE_GROUPS, ALL_VIEW_MODES, PINNED_VIEW_MODES } from '../../constants/diagram'

const pillBase = 'flex items-center bg-surface-0 rounded-lg border border-border shadow-sm px-1 py-1'
const toolbarBtn = 'flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer'

export function AppToolbar() {
  const { compile } = useCompile()
  const compiling = useEphemeralStore((s) => s.compiling)
  const generatingCode = useEphemeralStore((s) => s.generatingCode)
  const executing = useEphemeralStore((s) => s.executing)
  const errorCount = useEphemeralStore((s) => s.outputErrorCount)
  const viewMode = useSessionStore((s) => s.viewMode)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const handleGenerate = useGenerate()
  const { categories: exampleCategories, loadExample } = useExamples()

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
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [compile])

  return (
    <div className="relative flex items-center justify-center h-[var(--toolbar-h)] px-3 shrink-0" data-testid="app-toolbar">
      <div className={cn(pillBase, 'absolute left-3 top-1/2 -translate-y-1/2')}>
        <DropdownMenu>
          <Tip content="Tasks" side="bottom">
            <DropdownMenuTrigger asChild>
              <button className={toolbarBtn} aria-label="Tasks">
                <ClipboardList className="size-3.5" />
                Tasks
                <ChevronDown className="size-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => useTaskStore.getState().openSheet('create')}>
              <Plus className="size-3.5" />
              Create Task
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useTaskStore.getState().openSheet('manage')}>
              <Search className="size-3.5" />
              Manage Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarDivider />

        <DropdownMenu>
          <Tip content="Load example" side="bottom">
            <DropdownMenuTrigger asChild>
              <button className={toolbarBtn} aria-label="Examples">
                <BookOpen className="size-3.5" />
                Examples
                <ChevronDown className="size-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="start" className="w-48">
            {exampleCategories.length === 0 ? (
              <DropdownMenuItem disabled>Loading examples...</DropdownMenuItem>
            ) : (
              exampleCategories.map((cat) => (
                <DropdownMenuSub key={cat.name}>
                  <DropdownMenuSubTrigger>{cat.name}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56 max-h-72">
                    {cat.examples.map((ex) => (
                      <DropdownMenuItem key={ex.name} onSelect={() => loadExample(ex.name, cat.name)}>
                        {ex.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(pillBase, 'gap-0.5')}>
        <Tip content="Compile (Ctrl+Enter)" side="bottom">
          <button
            onClick={compile}
            disabled={compiling}
            aria-label={compiling ? 'Compiling' : 'Compile (Ctrl+Enter)'}
            data-testid="compile-button"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {compiling ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : justCompiled ? (
              <Check className="size-3.5 shrink-0 text-status-success animate-fade-in" />
            ) : (
              <Hammer className="size-3.5 shrink-0" />
            )}
            <span className="truncate">
              {compiling ? 'Compiling...' : justCompiled ? (
                <span className="text-status-success animate-fade-in">Compiled</span>
              ) : 'Compile'}
            </span>
          </button>
        </Tip>

        <DropdownMenu>
          <Tip content="Diagram view" side="bottom">
            <DropdownMenuTrigger
              data-tour="diagram-view"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-muted rounded-md hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer outline-none"
              aria-label="Diagram view"
            >
              <span className="truncate">{ALL_VIEW_MODES.find((m) => m.value === viewMode)?.label ?? 'Class'}</span>
              <ChevronDown className="size-3 shrink-0" />
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
              {VIEW_MODE_GROUPS.map((group) => (
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

        <ToolbarDivider />

        <DropdownMenu>
          <Tip content="Generate code" side="bottom">
            <DropdownMenuTrigger
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-muted rounded-md hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-70"
              aria-label="Generate"
              disabled={generatingCode}
            >
              {generatingCode ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <Code className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{generatingCode ? 'Generating...' : 'Generate'}</span>
              <ChevronDown className="size-3 shrink-0" />
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end" className="w-52 max-h-80">
            {GENERATE_TARGET_GROUPS.map((group, gi) => (
              <DropdownMenuGroup key={group.label}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xxs">{group.label}</DropdownMenuLabel>
                {group.targets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onSelect={() => handleGenerate(target.id)}
                  >
                    {target.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(pillBase, 'absolute right-3 top-1/2 -translate-y-1/2')}>
        <Popover>
          <Tip content="Umple AI" side="bottom">
            <PopoverTrigger asChild>
              <button className={toolbarBtn} aria-label="Umple AI configuration">
                <Sparkles className="size-3.5" />
                AI
              </button>
            </PopoverTrigger>
          </Tip>
          <PopoverContent align="end" className="w-72">
            <p className="text-xs font-medium mb-2">Umple AI</p>
            <AiConfigForm />
          </PopoverContent>
        </Popover>
      </div>

      {(compiling || generatingCode || executing) && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/4 bg-brand animate-progress-indeterminate" />
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useSessionStore, type DiagramView } from '../../stores/sessionStore'
import { useCompile } from '../../hooks/useExecute'
import { useGenerate } from '../../hooks/useGenerate'
import { useExamples } from '../../hooks/useExamples'
import { GENERATE_ONLY_TARGET_GROUPS } from '../../generation/targets'
import { AiConfigForm } from '@/components/sidebar/AiConfigForm'
import { useTaskStore } from '../../stores/taskStore'
import { ToolbarDivider } from '@/components/diagram/CanvasToolbar'
import { Hammer, Loader2, Check, ChevronDown, Code, Sparkles, ClipboardList, Plus, Search, BookOpen } from 'lucide-react'
import { Combobox, type ComboboxGroup } from '@/components/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { VIEW_MODE_GROUPS } from '../../constants/diagram'

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
  const { categories: exampleCategories, loadExample, loading: loadingExamples } = useExamples()

  const viewModeGroups = useMemo<ComboboxGroup[]>(
    () => VIEW_MODE_GROUPS.map((group) => ({
      label: group.label,
      options: group.modes.map((mode) => ({
        value: mode.value,
        label: mode.longLabel ?? mode.label,
        triggerLabel: mode.label,
        testId: `diagram-view-${mode.value}`,
        keywords: [mode.label, mode.longLabel, group.label].filter(Boolean) as string[],
      })),
    })),
    [],
  )

  const exampleGroups = useMemo<ComboboxGroup[]>(
    () => exampleCategories.map((category) => ({
      label: category.name,
      options: category.examples.map((example) => ({
        value: JSON.stringify({ name: example.name, category: category.name }),
        label: example.label || example.name,
        keywords: [example.name, category.name],
      })),
    })),
    [exampleCategories],
  )

  const generateGroups = useMemo<ComboboxGroup[]>(
    () => GENERATE_ONLY_TARGET_GROUPS.map((group) => ({
      label: group.label,
      options: group.targets.map((target) => ({
        value: target.id,
        label: target.label,
        keywords: [target.id, group.label],
      })),
    })),
    [],
  )

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

        <Combobox
          groups={exampleGroups}
          onSelect={(selection) => {
            const parsed = JSON.parse(selection) as { name: string; category: string }
            void loadExample(parsed.name, parsed.category)
          }}
          placeholder="Examples"
          searchPlaceholder="Search examples..."
          emptyText={loadingExamples ? 'Loading examples...' : 'No examples.'}
          disabled={loadingExamples && exampleGroups.length === 0}
          className={cn(toolbarBtn, 'w-auto h-auto border-0 bg-transparent px-1.5 py-0.5 focus:border-transparent focus:ring-0')}
          contentClassName="w-64 min-w-[16rem]"
          listClassName="max-h-72"
          triggerChildren={(
            <>
              <BookOpen className="size-3.5" />
              Examples
              <ChevronDown className="size-3 shrink-0" />
            </>
          )}
          ariaLabel="Examples"
        />
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

        <Combobox
          groups={viewModeGroups}
          value={viewMode}
          onSelect={(value) => setViewMode(value as DiagramView)}
          searchPlaceholder="Search views..."
          className="w-auto h-auto border-0 bg-transparent px-2 py-1 font-medium text-ink-muted hover:text-ink hover:bg-surface-2 focus:border-transparent focus:ring-0"
          contentClassName="w-64 min-w-[16rem]"
          listClassName="max-h-80"
          ariaLabel="Diagram view"
          data-tour="diagram-view"
        />

        <ToolbarDivider />

        <Combobox
          groups={generateGroups}
          onSelect={(targetId) => {
            void handleGenerate(targetId)
          }}
          placeholder="Generate"
          searchPlaceholder="Search targets..."
          disabled={generatingCode}
          className="w-auto h-auto border-0 bg-transparent px-2 py-1 font-medium text-ink-muted hover:text-ink hover:bg-surface-2 focus:border-transparent focus:ring-0"
          contentClassName="w-72 min-w-[18rem]"
          listClassName="max-h-80"
          triggerChildren={(
            <>
              {generatingCode ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <Code className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{generatingCode ? 'Generating...' : 'Generate'}</span>
              <ChevronDown className="size-3 shrink-0" />
            </>
          )}
          ariaLabel="Generate"
        />
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

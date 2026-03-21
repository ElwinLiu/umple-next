import { useState, useCallback, useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { useEditorStore } from '../../stores/editorStore'
import { api } from '../../api/client'
import { Play, Loader2, ChevronDown, Settings, Maximize2, Minimize2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const VIEW_MODES: { value: DiagramView; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'state', label: 'State' },
  { value: 'feature', label: 'Feature' },
  { value: 'structure', label: 'Structure' },
]

export function Header() {
  const { openCommandPalette, diagramOnly, setDiagramOnly, showExecutionPanel, toggleExecutionPanel } = useUiStore()
  const { compiling, lastError, viewMode, setViewMode } = useDiagramStore()
  const code = useEditorStore((s) => s.code)
  const [running, setRunning] = useState(false)

  const handleRun = useCallback(async () => {
    if (running) return
    setRunning(true)
    if (!showExecutionPanel) toggleExecutionPanel()
    try {
      await api.execute({ code, language: 'Java' })
    } catch {
      // handled in ExecutionPanel
    } finally {
      setRunning(false)
    }
  }, [running, code, showExecutionPanel, toggleExecutionPanel])

  // Ctrl+' shortcut to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault()
        e.stopPropagation()
        handleRun()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [handleRun])

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-surface-1 text-sm shrink-0" data-testid="app-header">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 no-underline text-ink" aria-label="UmpleOnline home">
          <img src="/umple-logo.svg" alt="" className="h-8 w-auto" />
          <span className="font-semibold text-[17px] tracking-tight">UmpleOnline</span>
        </a>
        <span className="text-ink-faint text-[10px] font-semibold uppercase tracking-widest">next</span>
      </div>

      {/* Center: Run button + diagram view dropdown */}
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        {compiling ? (
          <span className="flex items-center gap-1.5 text-status-warning text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />
            Compiling
          </span>
        ) : lastError ? (
          <span
            className="flex items-center gap-1.5 text-status-error text-xs max-w-[300px] truncate cursor-default"
            title={lastError}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-status-error shrink-0" />
            {lastError}
          </span>
        ) : null}

        {/* Run button */}
        <div className="flex items-center rounded-lg bg-surface-2 overflow-hidden">
          <button
            onClick={handleRun}
            disabled={running}
            aria-label={running ? 'Running code' : "Run code (Ctrl+')"}
            data-testid="run-code-button"
            title="Ctrl+'"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer hover:bg-border text-ink disabled:cursor-not-allowed"
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin text-ink-muted" />
            ) : (
              <Play className="size-3 text-ink-muted" />
            )}
            {running ? 'Running...' : ''}
          </button>
        </div>

        {/* Diagram view mode dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted bg-surface-1 rounded-lg hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer outline-none" title="Diagram view">
            {VIEW_MODES.find((m) => m.value === viewMode)?.label ?? 'Class'}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
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

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* Command palette trigger */}
        <button
          onClick={openCommandPalette}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-ink-muted bg-surface-1 rounded-lg hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          title="Command palette"
        >
          <kbd className="text-[10px] font-mono">Ctrl K</kbd>
        </button>

        {/* Settings gear */}
        <SettingsDropdown />

        {/* Diagram-only toggle */}
        <button
          onClick={() => setDiagramOnly(!diagramOnly)}
          className={`p-1.5 transition-colors cursor-pointer rounded-lg ${
            diagramOnly ? 'text-brand bg-brand-light' : 'text-ink-muted hover:text-ink hover:bg-surface-1'
          }`}
          title={diagramOnly ? 'Show editor' : 'Diagram only'}
        >
          {diagramOnly ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>
    </header>
  )
}

function SettingsDropdown() {
  const { showAttributes, showMethods, showActions, showTraits, theme, togglePreference, setTheme } = useUiStore()

  const diagramToggles = [
    { key: 'showAttributes' as const, label: 'Attributes' },
    { key: 'showMethods' as const, label: 'Methods' },
    { key: 'showActions' as const, label: 'Actions' },
    { key: 'showTraits' as const, label: 'Traits' },
  ]

  const values = { showAttributes, showMethods, showActions, showTraits }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="p-1.5 transition-colors cursor-pointer rounded-lg text-ink-muted hover:text-ink hover:bg-surface-1 outline-none data-[state=open]:text-ink data-[state=open]:bg-surface-2"
        title="Settings"
      >
        <Settings className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
          Diagram Display
        </DropdownMenuLabel>
        {diagramToggles.map(({ key, label }) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={values[key]}
            onCheckedChange={() => togglePreference(key)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
          Theme
        </DropdownMenuLabel>
        <div className="px-2 py-1.5 flex gap-1">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-2.5 py-1 text-[11px] rounded-lg cursor-pointer transition-colors capitalize ${
                theme === t
                  ? 'bg-brand text-ink-inverse'
                  : 'bg-surface-1 text-ink-muted hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

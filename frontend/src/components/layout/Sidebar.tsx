import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useEditorStore } from '../../stores/editorStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { api } from '../../api/client'
import { useExecute } from '../../hooks/useExecute'
import { UMPLE_TARGETS, type ExampleEntry } from '../../api/types'
import { Combobox } from '@/components/ui/combobox'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  Settings,
  Code,
  Columns2,
  Play,
  Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'

const DIAGRAM_TOGGLES = [
  { key: 'showAttributes' as const, label: 'Attributes' },
  { key: 'showMethods' as const, label: 'Methods' },
  { key: 'showTraits' as const, label: 'Traits' },
  { key: 'showActions' as const, label: 'Actions' },
]

// ── Collapsible section wrapper ──

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-ink-muted shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-ink-muted shrink-0" />
        )}
        {title}
      </button>
      {open && (
        <div className="px-4 pb-2 pt-1 ml-5.5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Sidebar content (shared between pinned and floating) ──

const SECTION_KEYS = ['diagramType', 'diagramDisplay', 'generateCode'] as const
type SectionKey = (typeof SECTION_KEYS)[number]

function SidebarContent() {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette)
  const [allExpanded, setAllExpanded] = useState(true)
  const [overrides, setOverrides] = useState<Partial<Record<SectionKey, boolean>>>({})

  const isOpen = (key: SectionKey) => overrides[key] ?? allExpanded

  const toggleSection = useCallback((key: SectionKey) => {
    setOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? allExpanded) }))
  }, [allExpanded])

  const toggleAll = useCallback(() => {
    setAllExpanded((prev) => !prev)
    setOverrides({})
  }, [])

  const anyOpen = SECTION_KEYS.some((k) => isOpen(k))

  return (
    <>
      {/* Row 1: logo + title left, layout right */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <a href="/" className="flex items-center gap-2.5 no-underline text-ink" aria-label="UmpleOnline home">
          <img src="/umple-logo.svg" alt="" className="h-6 w-auto" />
          <span className="text-[17px] font-semibold tracking-tight">UmpleOnline</span>
        </a>

        <LayoutToggle />
      </div>

      {/* Row 2: fold/expand all left, search + settings right */}
      <div className="flex items-center justify-between px-4 pb-2.5 shrink-0 border-b border-border">
        <Tip content={anyOpen ? 'Collapse all' : 'Expand all'} side="bottom">
          <button
            onClick={toggleAll}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
            aria-label={anyOpen ? 'Collapse all sections' : 'Expand all sections'}
          >
            {anyOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
          </button>
        </Tip>
        <div className="flex items-center gap-0.5">
          <Tip content="Search (Ctrl K)" side="bottom">
            <button
              onClick={openCommandPalette}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
              aria-label="Command palette"
            >
              <Search className="size-4" />
            </button>
          </Tip>
          <SettingsDropdown />
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pt-1">
        <DiagramTypeSection open={isOpen('diagramType')} onToggle={() => toggleSection('diagramType')} />
        <ShowHideSection open={isOpen('diagramDisplay')} onToggle={() => toggleSection('diagramDisplay')} />
        <GenerateCodeSection open={isOpen('generateCode')} onToggle={() => toggleSection('generateCode')} />
      </div>
    </>
  )
}

// ── Main Sidebar ──

export function Sidebar() {
  const { showSidebar, sidebarWidth } = useUiStore()
  const [peekState, setPeekState] = useState<'hidden' | 'open' | 'closing'>('hidden')
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPeekTimeout = useCallback(() => {
    if (peekTimeoutRef.current) { clearTimeout(peekTimeoutRef.current); peekTimeoutRef.current = null }
  }, [])

  const handlePeekEnter = useCallback(() => {
    clearPeekTimeout()
    setPeekState('open')
  }, [clearPeekTimeout])

  const handlePeekLeave = useCallback(() => {
    peekTimeoutRef.current = setTimeout(() => setPeekState('closing'), 300)
  }, [])

  const handlePeekStay = useCallback(() => {
    clearPeekTimeout()
    // If we were closing, reopen
    setPeekState((s) => s === 'hidden' ? s : 'open')
  }, [clearPeekTimeout])

  const handleAnimationEnd = useCallback(() => {
    setPeekState((s) => s === 'closing' ? 'hidden' : s)
  }, [])

  useEffect(() => {
    return clearPeekTimeout
  }, [clearPeekTimeout])

  // Close peek when sidebar is toggled open
  useEffect(() => {
    if (showSidebar) setPeekState('hidden')
  }, [showSidebar])

  // ── Pinned sidebar (open) ──
  if (showSidebar) {
    return (
      <div
        className="relative flex flex-col h-full shrink-0"
        style={{ width: sidebarWidth }}
        data-testid="sidebar"
      >
        <SidebarContent />
        <ResizeHandle />
      </div>
    )
  }

  // ── Collapsed: hover zone + floating peek ──
  return (
    <>
      {/* Invisible hover trigger zone on left edge */}
      <div
        className="h-full w-2 shrink-0"
        onMouseEnter={handlePeekEnter}
      />

      {/* Floating sidebar overlay with slide animation */}
      {peekState !== 'hidden' && (
        <div
          className={`fixed top-0 left-0 h-full z-40 flex ${
            peekState === 'closing' ? 'animate-sidebar-peek-out' : 'animate-sidebar-peek-in'
          }`}
          onMouseLeave={handlePeekLeave}
          onMouseEnter={handlePeekStay}
          onAnimationEnd={handleAnimationEnd}
        >
          <div
            className="flex flex-col h-full bg-surface-1 shadow-2xl border-r border-border"
            style={{ width: sidebarWidth }}
            data-testid="sidebar-peek"
          >
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  )
}

// ── Resize handle (right edge of sidebar) ──

function ResizeHandle() {
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = useUiStore.getState().sidebarWidth

    const handleMouseMove = (e: MouseEvent) => {
      setSidebarWidth(startWidth + (e.clientX - startX))
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [setSidebarWidth])

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand active:bg-brand transition-colors z-10"
    />
  )
}

// ── SECTION: Diagram Type ──

function DiagramTypeSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { viewMode, setViewMode, renderMode, setRenderMode } = useDiagramStore()
  const [allExamples, setAllExamples] = useState<ExampleEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const setCode = useEditorStore((s) => s.setCode)

  const views: { value: DiagramView; label: string }[] = [
    { value: 'class', label: 'Editable Class Diagram' },
    { value: 'state', label: 'State Diagram' },
    { value: 'feature', label: 'Feature Diagram' },
    { value: 'structure', label: 'Structure Diagram' },
  ]

  useEffect(() => {
    if (!loaded) {
      setLoaded(true)
      api.listExamples().then(setAllExamples).catch(() => {})
    }
  }, [loaded])

  const exampleOptions = useMemo(
    () => allExamples
      .filter((ex) => getExampleCategory(ex.name) === viewMode)
      .map((ex) => ({ value: ex.name, label: ex.name })),
    [allExamples, viewMode]
  )

  const handleLoadExample = useCallback(async (name: string) => {
    try {
      const res = await api.getExample(name)
      setCode(res.code)
    } catch { /* ignore */ }
  }, [setCode])

  return (
    <Section title="Diagram Type" open={open} onToggle={onToggle}>
      <div className="space-y-1">
        {views.map((v) => (
          <label key={v.value} className="flex items-center gap-2 py-0.5 text-[12px] text-ink cursor-pointer hover:text-ink-muted transition-colors">
            <input
              type="radio"
              name="diagramType"
              checked={viewMode === v.value}
              onChange={() => setViewMode(v.value)}
              className="accent-brand"
            />
            {v.label}
          </label>
        ))}
        <div className="border-t border-border mt-2 pt-2">
          <label className="flex items-center gap-2 py-0.5 text-[12px] text-ink cursor-pointer hover:text-ink-muted transition-colors">
            <input
              type="checkbox"
              checked={renderMode === 'graphviz'}
              onChange={() => setRenderMode(renderMode === 'graphviz' ? 'reactflow' : 'graphviz')}
              className="accent-brand"
            />
            Use GraphViz Rendering
          </label>
        </div>
        {exampleOptions.length > 0 && (
          <div className="border-t border-border mt-2 pt-2">
            <Combobox
              key={viewMode}
              options={exampleOptions}
              onSelect={handleLoadExample}
              placeholder="Load an example..."
              searchPlaceholder="Search examples..."
            />
          </div>
        )}
      </div>
    </Section>
  )
}

// ── SECTION: Show & Hide ──

function ShowHideSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { showAttributes, showMethods, showActions, showTraits, togglePreference } = useUiStore()

  const values = { showAttributes, showMethods, showActions, showTraits }

  return (
    <Section title="Diagram Display" open={open} onToggle={onToggle}>
      <div className="space-y-1">
        {DIAGRAM_TOGGLES.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 py-0.5 text-[12px] text-ink cursor-pointer hover:text-ink-muted transition-colors">
            <input
              type="checkbox"
              checked={values[key]}
              onChange={() => togglePreference(key)}
              className="accent-brand"
            />
            {label}
          </label>
        ))}
      </div>
    </Section>
  )
}

// ── SECTION: Generate Code ──

function GenerateCodeSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const code = useEditorStore((s) => s.code)
  const modelId = useEditorStore((s) => s.modelId)
  const {
    setGeneratedOutput, setGeneratingCode, setGeneratedError,
    generatingCode,
  } = useUiStore()
  const { execute, running } = useExecute()

  const [language, setLanguage] = useState('Java')

  const languageOptions = useMemo(
    () => UMPLE_TARGETS.map((t) => ({ value: t, label: t })),
    []
  )

  const handleGenerate = useCallback(async () => {
    if (!code.trim() || generatingCode) return
    setGeneratingCode(true)
    setGeneratedError(null)
    try {
      const res = await api.generate({ code, language, modelId: modelId ?? undefined })
      setGeneratedOutput(res.output, language)
      if (res.errors) setGeneratedError(res.errors)
    } catch (err: any) {
      setGeneratedError(err.message || 'Generation failed')
    } finally {
      setGeneratingCode(false)
    }
  }, [code, language, modelId, generatingCode, setGeneratedOutput, setGeneratingCode, setGeneratedError])

  return (
    <Section title="Generate Code" open={open} onToggle={onToggle}>
      <div className="space-y-2">
        <Combobox
          options={languageOptions}
          value={language}
          onSelect={setLanguage}
          placeholder="Select language..."
          searchable={false}
        />
        <div className="flex gap-1.5">
          <button
            onClick={handleGenerate}
            disabled={generatingCode}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md bg-brand text-ink-inverse hover:bg-brand-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingCode ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Code className="size-3" />
            )}
            Generate
          </button>
          <button
            onClick={execute}
            disabled={running}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md bg-surface-2 text-ink hover:bg-border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Execute
          </button>
        </div>
      </div>
    </Section>
  )
}

// ── Example category mapping (matches original UmpleOnline) ──

const STATE_EXAMPLES = new Set([
  'AgentsCommunication', 'ApplicationProcessing', 'Auction', 'Booking',
  'CanalLockStateMachine', 'CarTransmission', 'CollisionAvoidance',
  'CollisionAvoidanceA1', 'CollisionAvoidanceA2', 'CollisionAvoidanceA3',
  'ComplexStateMachine', 'CoordinationStateMachine', 'CourseSectionFlat',
  'CourseSectionNested', 'DVD_Player', 'DigitalWatchFlat', 'DigitalWatchNested',
  'Dishwasher', 'Elevator_State_Machine', 'GarageDoor', 'HomeHeater',
  'LibraryLoanStateMachine', 'Lights', 'MicrowaveOven2', 'Ovens',
  'ParliamentBill', 'Phone', 'Runway', 'SecurityLight', 'SpecificFlight',
  'SpecificFlightFlat', 'TcpIpSimulation', 'TelephoneSystem2', 'TicTacToe',
  'TimedCommands', 'TollBooth', 'TrafficLightsA', 'TrafficLightsB',
])

const FEATURE_EXAMPLES = new Set([
  'BerkeleyDB_SPL', 'BerkeleyDB_SP_featureDepend', 'HelloWorld_SPL',
])

const STRUCTURE_EXAMPLES = new Set([
  'PingPong',
])

function getExampleCategory(name: string): DiagramView {
  if (STATE_EXAMPLES.has(name)) return 'state'
  if (FEATURE_EXAMPLES.has(name)) return 'feature'
  if (STRUCTURE_EXAMPLES.has(name)) return 'structure'
  return 'class'
}

// ── Settings dropdown ──

function SettingsDropdown() {
  const { theme, setTheme } = useUiStore()

  return (
    <DropdownMenu>
      <Tip content="Settings" side="bottom">
        <DropdownMenuTrigger
          className="p-1.5 transition-colors cursor-pointer rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 outline-none data-[state=open]:text-ink data-[state=open]:bg-surface-2"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Layout toggle button (toggles sidebar) ──

function LayoutToggle({ side = 'bottom' }: { side?: 'bottom' | 'right' }) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <Tip content="Toggle sidebar" side={side}>
      <button
        onClick={toggleSidebar}
        className="p-1.5 transition-colors cursor-pointer rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2"
        aria-label="Toggle sidebar"
      >
        <Columns2 className="size-4" />
      </button>
    </Tip>
  )
}

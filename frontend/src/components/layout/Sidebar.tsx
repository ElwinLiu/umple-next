import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useEditorStore } from '../../stores/editorStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { api } from '../../api/client'
import { useExecute } from '../../hooks/useExecute'
import { UMPLE_TARGETS, type ExampleCategory } from '../../api/types'
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
  BookOpen,
  MessageCircleQuestion,
  Github,
  Bug,
  Globe,
  GraduationCap,
  Shield,
  ExternalLink,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

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
        className="flex items-center gap-2 w-full px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer text-left"
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
          <span className="text-lg font-semibold tracking-tight">UmpleOnline</span>
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

      {/* Footer */}
      <SidebarFooter />
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
      className="group absolute right-0 top-0 bottom-0 w-2.5 -mr-1 cursor-col-resize z-10"
    >
      {/* Full-height line (visible on hover/active) */}
      <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 rounded-full bg-transparent group-hover:bg-brand group-active:bg-brand transition-colors pointer-events-none" />
      {/* Grip indicator (always visible) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-8 rounded-full bg-border group-hover:bg-brand group-active:bg-brand transition-colors pointer-events-none" />
    </div>
  )
}

// ── SECTION: Diagram Type ──

function DiagramTypeSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { viewMode, setViewMode, renderMode, setRenderMode } = useDiagramStore()
  const [allCategories, setAllCategories] = useState<ExampleCategory[]>([])
  const [loaded, setLoaded] = useState(false)
  const loadExample = useEditorStore((s) => s.loadExample)

  const views: { value: DiagramView; label: string }[] = [
    { value: 'class', label: 'Editable Class Diagram' },
    { value: 'state', label: 'State Diagram' },
    { value: 'feature', label: 'Feature Diagram' },
    { value: 'structure', label: 'Structure Diagram' },
  ]

  useEffect(() => {
    if (!loaded) {
      setLoaded(true)
      api.listExamples().then(setAllCategories).catch(() => {})
    }
  }, [loaded])

  const exampleOptions = useMemo(
    () => allCategories
      .filter((cat) => (CATEGORY_TO_VIEW[cat.name] ?? 'class') === viewMode)
      .flatMap((cat) => cat.examples)
      .map((ex) => ({ value: ex.name, label: ex.name })),
    [allCategories, viewMode]
  )

  const handleLoadExample = useCallback(async (name: string) => {
    try {
      const res = await api.getExample(name)
      loadExample(res.name, res.code)
    } catch { /* ignore */ }
  }, [loadExample])

  return (
    <Section title="Diagram Type" open={open} onToggle={onToggle}>
      <div className="space-y-1">
        {views.map((v) => (
          <label key={v.value} className="flex items-center gap-2 py-0.5 text-xs text-ink cursor-pointer hover:text-ink-muted transition-colors">
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
          <label className="flex items-center gap-2 py-0.5 text-xs text-ink cursor-pointer hover:text-ink-muted transition-colors">
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
          <label key={key} className="flex items-center gap-2 py-0.5 text-xs text-ink cursor-pointer hover:text-ink-muted transition-colors">
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
          <Button
            onClick={handleGenerate}
            disabled={generatingCode}
            size="xs"
            className="flex-1 text-xs"
          >
            {generatingCode ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Code className="size-3" />
            )}
            Generate
          </Button>
          <Button
            onClick={execute}
            disabled={running}
            variant="secondary"
            size="xs"
            className="text-xs"
          >
            {running ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Execute
          </Button>
        </div>
      </div>
    </Section>
  )
}

// ── Map API category names to diagram view modes ──

const CATEGORY_TO_VIEW: Record<string, DiagramView> = {
  'Class Diagrams': 'class',
  'State Machines': 'state',
  'Composite Structure': 'structure',
  'Feature Diagrams': 'feature',
}

// ── Footer links data ──

const FOOTER_LINKS = [
  {
    items: [
      { label: 'User Manual', href: 'https://manual.umple.org', icon: BookOpen },
      { label: 'Ask a Question', href: 'https://umple.org/questions', icon: MessageCircleQuestion },
    ],
  },
  {
    items: [
      { label: 'GitHub Repository', href: 'https://github.com/umple/umple', icon: Github },
      { label: 'Report an Issue', href: 'https://github.com/umple/umple/issues/new', icon: Bug },
      { label: 'Umple Website', href: 'https://umple.org', icon: Globe },
    ],
  },
  {
    items: [
      { label: 'University of Ottawa', href: 'https://www.uottawa.ca', icon: GraduationCap },
      { label: 'Privacy Policy', href: 'https://umple.org/privacy', icon: Shield },
    ],
  },
]

// ── Sidebar footer ──

function SidebarFooter() {
  return (
    <div className="shrink-0 border-t border-border p-2" data-testid="sidebar-footer">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer hover:bg-surface-2 data-[state=open]:bg-surface-2"
          aria-label="University of Ottawa resources"
          data-testid="sidebar-footer-menu"
        >
          <img src="/uottawa-logo.svg" alt="" className="h-8 w-auto shrink-0 dark:invert" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-ink truncate">University of Ottawa</div>
            <div className="text-xxs text-ink-muted">Resources & help</div>
          </div>
          <ChevronsUpDown className="size-3.5 text-ink-faint shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          {FOOTER_LINKS.map((group, gi) => (
            <DropdownMenuGroup key={gi}>
              {gi > 0 && <DropdownMenuSeparator />}
              {group.items.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  onSelect={() => window.open(item.href, '_blank', 'noopener,noreferrer')}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                  <ExternalLink className="ml-auto size-3 text-ink-faint" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
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
        <DropdownMenuLabel className="text-xxs uppercase tracking-wider text-ink-muted font-semibold">
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

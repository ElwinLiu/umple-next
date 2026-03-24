import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useEditorStore } from '../../stores/editorStore'
import { useDiagramStore, VIEW_OUTPUT_KIND, type GvLayoutAlgorithm } from '../../stores/diagramStore'
import { api } from '../../api/client'
import { useExecute } from '../../hooks/useExecute'
import { useGenerate } from '../../hooks/useGenerate'
import type { ExampleCategory } from '../../api/types'
import { GENERATE_TARGETS, getGenerateTarget } from '../../generation/targets'
import { LAYOUT_OPTIONS, ALL_VIEW_MODES, PINNED_VIEW_MODES, getViewForExampleCategory } from '../../constants/diagram'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Search,
  Code,
  Play,
  Loader2,
  Columns2,
  BookOpen,
  MessageCircleQuestion,
  Github,
  Bug,
  Globe,
  GraduationCap,
  Shield,
  ExternalLink,
} from 'lucide-react'
import { AiConfigSection } from '@/components/sidebar/AiConfigSection'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'

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
        className="flex items-center gap-2 w-full px-4 pt-2.5 pb-1.5 text-[13px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-ink-faint shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-ink-faint shrink-0" />
        )}
        {title}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0.5 ml-5.5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Sidebar content (shared between pinned and floating) ──

function SidebarContent() {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette)
  const [toolsOpen, setToolsOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <>
      {/* Header: logo + title left, search + layout right */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 border-b border-border/60">
        <a href="/" className="flex items-center gap-2.5 no-underline text-ink" aria-label="UmpleOnline home">
          <img src="/umple-logo.svg" alt="" className="h-6 w-auto" />
          <span className="text-lg font-semibold tracking-tight">UmpleOnline</span>
        </a>
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
          <LayoutToggle />
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin py-1 space-y-1">
        <ToolsSection open={toolsOpen} onToggle={() => setToolsOpen((v) => !v)} />
        <AiConfigSection open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />
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

// ── SECTION: Tools (Examples + Generate Code + Layout) ──

function ToolsSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { viewMode, setViewMode, layoutAlgorithm, setLayoutAlgorithm } = useDiagramStore()
  const code = useEditorStore((s) => s.code)
  const generatingCode = useUiStore((s) => s.generatingCode)
  const { execute } = useExecute()
  const running = useUiStore((s) => s.executing)
  const generate = useGenerate()
  const loadExample = useEditorStore((s) => s.loadExample)

  const [allCategories, setAllCategories] = useState<ExampleCategory[]>([])
  const [loaded, setLoaded] = useState(false)
  const [targetId, setTargetId] = useState('Java')
  const [selectedExample, setSelectedExample] = useState<string | undefined>(undefined)

  const viewLabel = ALL_VIEW_MODES.find((m) => m.value === viewMode)?.label ?? 'Class'
  const showLayout = VIEW_OUTPUT_KIND[viewMode] !== 'html'

  const selectedTarget = useMemo(
    () => getGenerateTarget(targetId) ?? GENERATE_TARGETS[0],
    [targetId],
  )

  const languageOptions = useMemo(
    () => GENERATE_TARGETS.map((target) => ({ value: target.id, label: target.label })),
    []
  )

  useEffect(() => {
    if (!loaded) {
      setLoaded(true)
      api.listExamples().then(setAllCategories).catch(() => {})
    }
  }, [loaded])

  const exampleOptions = useMemo(
    () => allCategories
      .filter((cat) => (getViewForExampleCategory(cat.name) ?? 'class') === viewMode)
      .flatMap((cat) => cat.examples)
      .map((ex) => ({ value: ex.name, label: ex.name })),
    [allCategories, viewMode]
  )

  const handleLoadExample = useCallback(async (name: string) => {
    try {
      const res = await api.getExample(name)
      loadExample(res.name, res.code)
      setSelectedExample(name)
      useUiStore.getState().setRightPanelView('diagram')
    } catch { /* ignore */ }
  }, [loadExample])

  const handleGenerate = useCallback(async () => {
    if (!code.trim() || generatingCode) return
    generate(targetId)
  }, [code, generatingCode, generate, targetId])

  return (
    <Section title="Tools" open={open} onToggle={onToggle}>
      <div className="space-y-4">
        {/* Examples */}
        <div>
          <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">Examples</div>
          <div className="space-y-1.5">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PINNED_VIEW_MODES.map((pv) => {
                  const m = ALL_VIEW_MODES.find((v) => v.value === pv)
                  if (!m) return null
                  return (
                    <SelectItem key={m.value} value={m.value}>
                      {m.longLabel ?? m.label}
                    </SelectItem>
                  )
                })}
                <SelectSeparator />
                {ALL_VIEW_MODES.filter((m) => !PINNED_VIEW_MODES.includes(m.value)).map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.longLabel ?? m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Combobox
              key={viewMode}
              options={exampleOptions}
              value={selectedExample}
              onSelect={handleLoadExample}
              placeholder={exampleOptions.length > 0 ? 'Load an example...' : 'No examples'}
              searchPlaceholder="Search examples..."
            />
          </div>
        </div>

        {/* Generate Code */}
        <div>
          <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">Generate Code</div>
          <div className="space-y-2">
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                onClick={() => execute(selectedTarget.id)}
                disabled={running || !selectedTarget.executable}
                variant="secondary"
                size="xs"
                className="text-xs"
                title={selectedTarget.executable ? 'Execute generated code' : 'Execution is only supported for Java and Python'}
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
        </div>

        {/* Layout Algorithm */}
        {showLayout && (
          <div>
            <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">Layout Algorithm</div>
            <Select value={layoutAlgorithm} onValueChange={(v) => setLayoutAlgorithm(v as GvLayoutAlgorithm)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </Section>
  )
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
    <div className="shrink-0 border-t border-border/60 px-3 py-2 flex items-center justify-between gap-2" data-testid="sidebar-footer">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-1.5 rounded-lg p-1.5 transition-colors cursor-pointer hover:bg-surface-2 data-[state=open]:bg-surface-2"
          aria-label="University of Ottawa resources"
          data-testid="sidebar-footer-menu"
        >
          <img src="/uottawa-logo.svg" alt="University of Ottawa" className="h-8 w-auto shrink-0 dark:invert" />
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
      <ThemeToggle />
    </div>
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

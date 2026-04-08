import { useState, useCallback, useEffect, useMemo } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useSessionStore, VIEW_OUTPUT_KIND } from '../../stores/sessionStore'
import { usePreferencesStore, type GvLayoutAlgorithm } from '../../stores/preferencesStore'
import { useCollabStore } from '../../stores/collabStore'
import { collabLoadExample } from '../../hooks/useCollabTabs'
import { api } from '../../api/client'
import { useExecute } from '../../hooks/useExecute'
import { useGenerate } from '../../hooks/useGenerate'
import type { ExampleCategory } from '../../api/types'
import { GENERATE_TARGETS, GENERATE_TARGET_GROUPS, getGenerateTarget } from '../../generation/targets'
import { LAYOUT_OPTIONS, ALL_VIEW_MODES, PINNED_VIEW_MODES, getViewForExampleCategory } from '../../constants/diagram'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronsUpDown,
  Search,
  Code,
  Play,
  Loader2,
  BookOpen,
  MessageCircleQuestion,
  GitBranch,
  Bug,
  Globe,
  GraduationCap,
  Shield,
  ExternalLink,
  ClipboardList,
  Sun,
  Moon,
  Monitor,
  Wrench,
  Sparkles,
} from 'lucide-react'
import { AiConfigSection } from '@/components/sidebar/AiConfigSection'
import { TaskSidebarSection } from '@/components/task/TaskSidebarSection'
import { useTaskStore } from '@/stores/taskStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter as SidebarFooterPrimitive,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/sidebar/collapsible'

// ── Icon nav (visible only when sidebar is collapsed to icon mode) ──

function IconNav() {
  const { toggleSidebar } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Tools" onClick={toggleSidebar}>
            <Wrench />
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Tasks" onClick={toggleSidebar}>
            <ClipboardList />
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Umple AI" onClick={toggleSidebar}>
            <Sparkles />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

// ── SECTION: Tools (Examples + Generate Code + Layout) ──

function ToolsSection() {
  const { viewMode, setViewMode } = useSessionStore()
  const { layoutAlgorithm, setLayoutAlgorithm } = usePreferencesStore()
  const code = useSessionStore((s) => s.code)
  const generatingCode = useEphemeralStore((s) => s.generatingCode)
  const { execute } = useExecute()
  const running = useEphemeralStore((s) => s.executing)
  const generate = useGenerate()
  const localLoadExample = useSessionStore((s) => s.loadExample)
  const isCollaborating = useCollabStore((s) => s.isCollaborating)

  const [allCategories, setAllCategories] = useState<ExampleCategory[]>([])
  const [loaded, setLoaded] = useState(false)
  const targetId = useSessionStore((s) => s.generateTargetId)
  const setTargetId = useSessionStore((s) => s.setGenerateTargetId)
  const selectedExample = useSessionStore((s) => s.selectedExample)

  const showLayout = VIEW_OUTPUT_KIND[viewMode] !== 'html'

  const selectedTarget = useMemo(
    () => getGenerateTarget(targetId) ?? GENERATE_TARGETS[0],
    [targetId],
  )

  const generateGroups = useMemo(
    () => GENERATE_TARGET_GROUPS.map((g) => ({
      label: g.label,
      options: g.targets.map((t) => ({ value: t.id, label: t.label })),
    })),
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
      .map((ex) => ({ value: ex.name, label: ex.label })),
    [allCategories, viewMode]
  )

  const handleLoadExample = useCallback(async (name: string) => {
    try {
      const res = await api.getExample(name)
      if (isCollaborating) {
        collabLoadExample(res.name, res.code, res.modelId)
      } else {
        localLoadExample(res.name, res.code, res.modelId)
      }
      useEphemeralStore.getState().setRightPanelView('diagram')
    } catch { /* ignore */ }
  }, [localLoadExample, isCollaborating])

  const handleGenerate = useCallback(async () => {
    if (!code.trim() || generatingCode) return
    generate(targetId)
  }, [code, generatingCode, generate, targetId])

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="cursor-pointer">
            <Wrench />
            Tools
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-0 group-data-[state=closed]/collapsible:-rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            {/* Examples */}
            <SidebarGroup className="p-0" data-tour="examples">
              <SidebarGroupLabel>Examples</SidebarGroupLabel>
              <SidebarGroupContent className="flex flex-col gap-1.5">
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
                  value={selectedExample ?? undefined}
                  onSelect={handleLoadExample}
                  placeholder={exampleOptions.length > 0 ? 'Load an example...' : 'No examples'}
                  searchPlaceholder="Search examples..."
                />
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Generate */}
            <SidebarGroup className="p-0" data-tour="generate">
              <SidebarGroupLabel>Generate</SidebarGroupLabel>
              <SidebarGroupContent className="flex flex-col gap-2">
                <Combobox
                  groups={generateGroups}
                  value={targetId}
                  onSelect={setTargetId}
                  placeholder="Select target..."
                  searchPlaceholder="Search targets..."
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
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Layout Algorithm */}
            {showLayout && (
              <SidebarGroup className="p-0" data-tour="layout-algorithm">
                <SidebarGroupLabel>Layout Algorithm</SidebarGroupLabel>
                <SidebarGroupContent>
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
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

// ── SECTION: Tasks (Create + Manage) ──

function TasksSection() {
  return (
    <Collapsible className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="cursor-pointer">
            <ClipboardList />
            Tasks
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-0 group-data-[state=closed]/collapsible:-rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => useTaskStore.getState().openSheet('create')}
                  size="sm"
                >
                  <div className="flex items-center justify-center size-6 rounded-md bg-sidebar-primary/8 text-sidebar-primary">
                    <ClipboardList className="size-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium leading-tight">Create Task</span>
                    <span className="text-xxs text-sidebar-foreground/50">New assignment from current model</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => useTaskStore.getState().openSheet('manage')}
                  size="sm"
                >
                  <div className="flex items-center justify-center size-6 rounded-md bg-sidebar-primary/8 text-sidebar-primary">
                    <Search className="size-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium leading-tight">Manage Task</span>
                    <span className="text-xxs text-sidebar-foreground/50">Edit, view responses, share</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
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
      { label: 'GitHub Repository', href: 'https://github.com/umple/umple', icon: GitBranch },
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

// ── Theme menu items (embedded in footer dropdown) ──

const THEME_OPTIONS = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
]

function ThemeMenuItems() {
  const theme = usePreferencesStore((s) => s.theme)
  const setTheme = usePreferencesStore((s) => s.setTheme)

  function handleSwitch(value: (typeof THEME_OPTIONS)[number]['value']) {
    document.documentElement.classList.add('disable-transitions')
    setTheme(value)
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('disable-transitions')
    })
  }

  return (
    <>
      {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
        <DropdownMenuItem key={value} onSelect={() => handleSwitch(value)}>
          <Icon className="size-3.5" />
          {label}
          {theme === value && (
            <span className="ml-auto text-xs text-sidebar-foreground/60">&#10003;</span>
          )}
        </DropdownMenuItem>
      ))}
    </>
  )
}

// ── Sidebar footer ──

function AppSidebarFooter() {
  return (
    <SidebarFooterPrimitive data-testid="sidebar-footer">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                data-testid="sidebar-footer-menu"
              >
                <img src="/uottawa-logo.svg" alt="University of Ottawa" className="h-8 w-auto shrink-0 dark:invert" />
                <div className="flex flex-col flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">UmpleOnline</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">University of Ottawa</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
            >
              {FOOTER_LINKS.map((group, gi) => (
                <DropdownMenuGroup key={gi}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  {group.items.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      onSelect={() => window.open(item.href, '_blank', 'noopener,noreferrer')}
                    >
                      <item.icon className="size-3.5" />
                      <span>{item.label}<span className="sr-only"> (opens in new window)</span></span>
                      <ExternalLink className="ml-auto size-3 text-sidebar-foreground/50" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <ThemeMenuItems />
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterPrimitive>
  )
}

// ── Main exported sidebar ──

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const openCommandPalette = useEphemeralStore((s) => s.openCommandPalette)

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
      data-testid="sidebar"
    >
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <a href="/" className="flex items-center gap-2.5 no-underline text-sidebar-foreground min-w-0" aria-label="UmpleOnline home">
            <img src="/umple-logo.svg" alt="" className="h-6 w-auto shrink-0" />
            <span className="text-lg font-semibold tracking-tight truncate group-data-[collapsible=icon]:hidden">UmpleOnline</span>
          </a>
          <div className="flex items-center gap-0.5 shrink-0 group-data-[collapsible=icon]:hidden">
            <Tip content="Search (Ctrl K)" side="bottom">
              <button
                onClick={openCommandPalette}
                className="p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors cursor-pointer"
                aria-label="Command palette"
              >
                <Search className="size-4" />
              </button>
            </Tip>
            <SidebarTrigger className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
          </div>
        </div>
      </SidebarHeader>

      {/* Task section (hidden in icon mode) */}
      {!collapsed && <TaskSidebarSection />}

      <SidebarContent className="scrollbar-thin">
        {collapsed ? (
          <IconNav />
        ) : (
          <>
            <ToolsSection />
            <TasksSection />
            <AiConfigSection />
          </>
        )}
      </SidebarContent>

      <AppSidebarFooter />
      <SidebarRail />
    </Sidebar>
  )
}

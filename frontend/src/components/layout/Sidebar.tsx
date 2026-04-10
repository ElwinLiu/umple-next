import { useMemo } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useSessionStore, VIEW_OUTPUT_KIND } from '../../stores/sessionStore'
import { usePreferencesStore, type GvLayoutAlgorithm } from '../../stores/preferencesStore'
import { useExamples } from '../../hooks/useExamples'
import { useExecute } from '../../hooks/useExecute'
import { useGenerate } from '../../hooks/useGenerate'
import { GENERATE_ONLY_TARGETS, GENERATE_ONLY_TARGET_GROUPS, getGenerateTarget } from '../../generation/targets'
import { LAYOUT_OPTIONS, VIEW_MODE_GROUPS, getLayoutOption } from '../../constants/diagram'
import { canViewUseExampleCategory } from '../../constants/examples'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar/sidebar'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/sidebar/collapsible'
import {
  ChevronsUpDown,
  ChevronRight,
  Search,
  Code,
  Play,
  Loader2,
  Columns2,
  BookOpen,
  MessageCircleQuestion,
  GitFork,
  Bug,
  Globe,
  GraduationCap,
  Shield,
  ExternalLink,
  ClipboardList,
  Wrench,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { AiConfigForm } from '@/components/sidebar/AiConfigForm'
import { TaskSidebarSection } from '@/components/task/TaskSidebarSection'
import { useTaskStore } from '@/stores/taskStore'
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

// ── Main sidebar component ──

export function AppSidebar() {
  return (
    <Sidebar collapsible="offcanvas" data-testid="sidebar">
      <SidebarHeader className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5 text-ink min-w-0">
          <img src="/umple-logo.svg" alt="" className="h-6 w-auto shrink-0" />
          <span className="text-lg font-semibold tracking-tight truncate">UmpleOnline</span>
        </div>
        <HeaderActions />
      </SidebarHeader>

      <TaskSidebarSection />

      <SidebarContent className="scrollbar-thin py-1">
        <ToolsGroup />
        <TasksGroup />
        <AiGroup />
      </SidebarContent>

      <AppSidebarFooter />
      <SidebarRail />
    </Sidebar>
  )
}

// ── Header action buttons ──

function HeaderActions() {
  const openCommandPalette = useEphemeralStore((s) => s.openCommandPalette)
  const { toggleSidebar } = useSidebar()

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Tip content="Search (Ctrl K)" side="bottom">
        <button
          onClick={openCommandPalette}
          className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
          aria-label="Command palette"
        >
          <Search className="size-4" />
        </button>
      </Tip>
      <Tip content="Toggle sidebar (Ctrl B)" side="bottom">
        <button
          onClick={toggleSidebar}
          data-tour="sidebar-toggle"
          className="p-1.5 transition-colors cursor-pointer rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2"
          aria-label="Toggle sidebar"
        >
          <Columns2 className="size-4" />
        </button>
      </Tip>
    </div>
  )
}

// ── Collapsible group wrapper (shared pattern) ──

function CollapsibleGroup({
  title,
  icon: Icon,
  defaultOpen = false,
  'data-tour': dataTour,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  defaultOpen?: boolean
  'data-tour'?: string
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup data-tour={dataTour}>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="cursor-pointer">
            <Icon className="size-4" />
            {title}
            <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <SidebarGroupContent>
            <div className="relative px-2 pb-2 pt-1 ml-4">
              <div className="absolute left-2 top-0 bottom-1 w-px bg-border/50" />
              <div className="pl-3">
                {children}
              </div>
            </div>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

// ── Sub-label (Examples, Generate, etc.) ──

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xxs font-semibold text-ink-faint uppercase tracking-wider mb-1.5">
      {children}
    </div>
  )
}

// ── GROUP: Tools (Examples + Generate Code + Layout) ──

function ToolsGroup() {
  const { viewMode, setViewMode } = useSessionStore()
  const { layoutAlgorithm, setLayoutAlgorithm } = usePreferencesStore()
  const code = useSessionStore((s) => s.code)
  const generatingCode = useEphemeralStore((s) => s.generatingCode)
  const { execute } = useExecute()
  const running = useEphemeralStore((s) => s.executing)
  const generate = useGenerate()
  const { categories: allCategories, loadExample } = useExamples()
  const targetId = useSessionStore((s) => s.generateTargetId)
  const setTargetId = useSessionStore((s) => s.setGenerateTargetId)
  const selectedExample = useSessionStore((s) => s.selectedExample)

  const showLayout = VIEW_OUTPUT_KIND[viewMode] !== 'html'

  const selectedTarget = useMemo(
    () => getGenerateTarget(targetId) ?? GENERATE_ONLY_TARGETS[0],
    [targetId],
  )

  const generateGroups = useMemo(
    () => GENERATE_ONLY_TARGET_GROUPS.map((g) => ({
      label: g.label,
      options: g.targets.map((t) => ({ value: t.id, label: t.label })),
    })),
    []
  )

  const exampleOptions = useMemo(
    () => allCategories
      .filter((cat) => canViewUseExampleCategory(viewMode, cat.id))
      .flatMap((cat) => cat.examples)
      .map((ex) => ({ value: ex.name, label: ex.label || ex.name })),
    [allCategories, viewMode]
  )

  function handleGenerate() {
    if (!code.trim() || generatingCode) return
    generate(targetId)
  }

  return (
    <CollapsibleGroup title="Tools" icon={Wrench} defaultOpen>
      <div className="space-y-4">
        {/* Examples */}
        <div data-tour="examples">
          <SubLabel>Examples</SubLabel>
          <div className="space-y-1.5">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_MODE_GROUPS.map((group, index) => (
                  <SelectGroup key={group.label}>
                    {index > 0 && <SelectSeparator />}
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.modes.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.longLabel ?? m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Combobox
              key={viewMode}
              options={exampleOptions}
              value={selectedExample ?? undefined}
              onSelect={loadExample}
              placeholder={exampleOptions.length > 0 ? 'Load an example...' : 'No examples'}
              searchPlaceholder="Search examples..."
            />
          </div>
        </div>

        {/* Generate */}
        <div data-tour="generate">
          <SubLabel>Generate</SubLabel>
          <div className="space-y-2">
            <Combobox
              groups={generateGroups}
              value={targetId}
              onSelect={(id) => {
                setTargetId(id)
                if (code.trim() && !generatingCode) generate(id)
              }}
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
          </div>
        </div>

        {/* Layout Algorithm */}
        {showLayout && (
          <div data-tour="layout-algorithm">
            <SubLabel>Layout Algorithm</SubLabel>
            <Select value={layoutAlgorithm} onValueChange={(v) => setLayoutAlgorithm(v as GvLayoutAlgorithm)}>
              <SelectTrigger>
                <SelectValue>{getLayoutOption(layoutAlgorithm)?.label}</SelectValue>
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
    </CollapsibleGroup>
  )
}

// ── GROUP: Tasks (Create + Manage) ──

const TASK_ACTIONS = [
  { action: 'create' as const, icon: ClipboardList, label: 'Create Task', desc: 'New assignment from current model' },
  { action: 'manage' as const, icon: Search, label: 'Manage Task', desc: 'Edit, view responses, share' },
]

function TasksGroup() {
  return (
    <CollapsibleGroup title="Tasks" icon={ListChecks}>
      <div className="space-y-3">
        <p className="text-xs text-ink-muted leading-relaxed">
          Create assignments for students or manage existing ones.
        </p>
        <div className="space-y-1">
          {TASK_ACTIONS.map(({ action, icon: Icon, label, desc }) => (
            <button
              key={action}
              onClick={() => useTaskStore.getState().openSheet(action)}
              className="group flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer w-full text-left"
            >
              <div className="flex items-center justify-center size-6 rounded-md bg-brand/8 text-brand group-hover:bg-brand/12 transition-colors">
                <Icon className="size-3.5" />
              </div>
              <div>
                <span className="font-medium text-ink block leading-tight">{label}</span>
                <span className="text-xxs text-ink-faint">{desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </CollapsibleGroup>
  )
}

// ── GROUP: Umple AI ──

function AiGroup() {
  return (
    <CollapsibleGroup title="Umple AI" icon={Sparkles} data-tour="ai-config">
      <AiConfigForm />
    </CollapsibleGroup>
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
      { label: 'GitHub Repository', href: 'https://github.com/umple/umple', icon: GitFork },
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

function AppSidebarFooter() {
  return (
    <SidebarFooter className="flex-row items-center gap-2 h-12 px-4 border-t border-border/60" data-testid="sidebar-footer">
      <div className="min-w-0 flex-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-9 max-w-full min-w-0 items-center gap-1.5 pl-1 pr-1.5 cursor-pointer rounded-full hover:bg-surface-2 data-[state=open]:bg-surface-2 transition-colors group"
            aria-label="University of Ottawa resources"
            data-testid="sidebar-footer-menu"
          >
            <div className="rounded-full shrink-0 flex items-center justify-center size-7 bg-surface-2 overflow-hidden">
              <img src="/umple-logo.svg" alt="UmpleOnline" className="size-4 shrink-0" />
            </div>
            <span className="min-w-0 flex-1 text-sm text-ink truncate">Umple</span>
            <ChevronsUpDown className="size-3.5 text-ink-faint shrink-0 group-hover:text-ink transition-colors" />
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
                    <span>{item.label}<span className="sr-only"> (opens in new window)</span></span>
                    <ExternalLink className="ml-auto size-3 text-ink-faint" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ThemeToggle />
    </SidebarFooter>
  )
}

import { Eye, ChevronDown, Download, LayoutGrid } from 'lucide-react'
import { useSessionStore } from '../../stores/sessionStore'
import { usePreferencesStore, type DisplayPrefKey, type GvLayoutAlgorithm } from '../../stores/preferencesStore'
import { DISPLAY_TOGGLES, LAYOUT_OPTIONS } from '../../constants/diagram'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'

const btnBase =
  'px-1.5 py-0.5 text-xs cursor-pointer transition-colors rounded focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1 text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center gap-1'

interface CanvasToolbarProps {
  onExport: (format: string) => void
  canToggleRenderer: boolean
  renderMode: 'editable' | 'graphviz'
  onRenderModeChange: (mode: 'editable' | 'graphviz') => void
  showDisplayOptions?: boolean
}

export function CanvasToolbar({
  onExport,
  canToggleRenderer,
  renderMode,
  onRenderModeChange,
  showDisplayOptions = true,
}: CanvasToolbarProps) {
  const viewMode = useSessionStore((s) => s.viewMode)
  const nodeCount = useSessionStore((s) => s.diagramData[viewMode]?.nodes.length ?? 0)
  const toggles = DISPLAY_TOGGLES[viewMode]
  const hasToggles = showDisplayOptions && toggles.length > 0

  if (nodeCount === 0) return null

  return (
    <div
      className="pointer-events-auto flex items-center bg-surface-0/90 backdrop-blur-sm border border-border rounded-lg px-1 py-1 shadow-sm"
      data-testid="canvas-toolbar"
    >
      {canToggleRenderer && (
        <>
          <RendererToggle renderMode={renderMode} onRenderModeChange={onRenderModeChange} />
          <ToolbarDivider />
        </>
      )}

      <LayoutGroup />

      {hasToggles && (
        <>
          <ToolbarDivider />
          <DisplayOptionsGroup toggles={toggles} />
        </>
      )}

      <ToolbarDivider />

      <ExportGroup onExport={onExport} />
    </div>
  )
}

export function ToolbarDivider() {
  return <div className="w-px self-stretch bg-border/60 mx-0.5" />
}

function DisplayOptionsGroup({ toggles }: { toggles: { key: DisplayPrefKey; label: string }[] }) {
  return (
    <Popover>
      <Tip content="Display options" side="bottom">
        <PopoverTrigger asChild>
          <button className={btnBase}>
            <Eye className="size-3" />
            <ChevronDown className="size-2.5 text-ink-faint" />
          </button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex flex-col gap-1">
          {toggles.map(({ key, label }) => (
            <ToggleItem key={key} prefKey={key} label={label} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function LayoutGroup() {
  const layoutAlgorithm = usePreferencesStore((s) => s.layoutAlgorithm)
  const setLayoutAlgorithm = usePreferencesStore((s) => s.setLayoutAlgorithm)
  const current = LAYOUT_OPTIONS.find((o) => o.value === layoutAlgorithm)

  return (
    <DropdownMenu>
      <Tip content="Layout algorithm" side="bottom">
        <DropdownMenuTrigger asChild>
          <button className={btnBase}>
            <LayoutGrid className="size-3" />
            {current?.label ?? 'Dot'}
            <ChevronDown className="size-2.5 text-ink-faint" />
          </button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="center">
        <DropdownMenuRadioGroup value={layoutAlgorithm} onValueChange={(v) => setLayoutAlgorithm(v as GvLayoutAlgorithm)}>
          {LAYOUT_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExportGroup({ onExport }: { onExport: (format: string) => void }) {
  return (
    <DropdownMenu>
      <Tip content="Export" side="bottom">
        <DropdownMenuTrigger asChild>
          <button className={btnBase}>
            <Download className="size-3" />
          </button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="center">
        <DropdownMenuLabel>Diagram</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onExport('svg')}>SVG</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('png')}>PNG</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Model</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onExport('ump')}>Umple Code (.ump)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RendererToggle({
  renderMode,
  onRenderModeChange,
}: {
  renderMode: 'editable' | 'graphviz'
  onRenderModeChange: (mode: 'editable' | 'graphviz') => void
}) {
  return (
    <Tip content={`Renderer: ${renderMode === 'editable' ? 'Editable' : 'Graphviz'}`} side="bottom">
      <label className="flex items-center gap-1.5 cursor-pointer px-1">
        <span className={`text-xs ${renderMode === 'editable' ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
          Edit
        </span>
        <Switch
          size="sm"
          checked={renderMode === 'graphviz'}
          onCheckedChange={(checked) => onRenderModeChange(checked ? 'graphviz' : 'editable')}
        />
        <span className={`text-xs ${renderMode === 'graphviz' ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
          GV
        </span>
      </label>
    </Tip>
  )
}

function ToggleItem({ prefKey, label }: { prefKey: DisplayPrefKey; label: string }) {
  const checked = usePreferencesStore((s) => s[prefKey])
  const toggleDisplayPref = usePreferencesStore((s) => s.toggleDisplayPref)

  return (
    <label
      className="flex items-center justify-between gap-3 py-0.5 cursor-pointer min-w-[120px]"
      data-testid={`canvas-toggle-${prefKey}`}
    >
      <span className={`text-xxs transition-colors ${checked ? 'text-ink font-medium' : 'text-ink-muted'}`}>
        {label}
      </span>
      <Switch size="sm" checked={checked} onCheckedChange={() => toggleDisplayPref(prefKey)} />
    </label>
  )
}

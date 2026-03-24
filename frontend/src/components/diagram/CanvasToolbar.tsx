import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { usePreferencesStore, type DisplayPrefKey } from '../../stores/preferencesStore'
import { DISPLAY_TOGGLES } from '../../constants/diagram'
import { Switch } from '@/components/ui/switch'
import { Eye, ChevronDown } from 'lucide-react'

export function CanvasToolbar() {
  const viewMode = useSessionStore((s) => s.viewMode)
  const [expanded, setExpanded] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [expanded])

  const toggles = DISPLAY_TOGGLES[viewMode]
  if (toggles.length === 0) return null

  return (
    <div className="absolute top-2 left-2 z-10" ref={containerRef}>
      <div className="bg-surface-0/90 backdrop-blur-sm border border-border rounded-lg shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer hover:bg-surface-1 transition-colors"
        >
          <Eye className="size-3 text-ink-faint" />
          <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Display Options</span>
          <ChevronDown className={`size-3 text-ink-faint ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && (
          <div className="px-2 py-1.5 flex flex-col gap-1 border-t border-border/60 animate-fade-in">
            {toggles.map(({ key, label }) => (
              <CanvasToggleItem key={key} prefKey={key} label={label} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CanvasToggleItem({
  prefKey,
  label,
}: {
  prefKey: DisplayPrefKey
  label: string
}) {
  const checked = usePreferencesStore((s) => s[prefKey])
  const toggleDisplayPref = usePreferencesStore((s) => s.toggleDisplayPref)

  return (
    <label
      className="flex items-center justify-between gap-3 py-0.5 cursor-pointer group min-w-[120px]"
      data-testid={`canvas-toggle-${prefKey}`}
    >
      <span className={`text-[11px] transition-colors ${checked ? 'text-ink font-medium' : 'text-ink-muted'}`}>
        {label}
      </span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={() => toggleDisplayPref(prefKey)}
      />
    </label>
  )
}

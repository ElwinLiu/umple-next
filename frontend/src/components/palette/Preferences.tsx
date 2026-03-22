import { useUiStore } from '../../stores/uiStore'
import {
  useDiagramStore,
  type DiagramView,
  type DisplayPrefKey,
  type GvLayoutAlgorithm,
} from '../../stores/diagramStore'
import { Combobox } from '@/components/ui/combobox'
import { Switch } from '@/components/ui/switch'

const DISPLAY_TOGGLES: Record<DiagramView, { key: DisplayPrefKey; label: string }[]> = {
  class: [
    { key: 'showAttributes', label: 'Attributes' },
    { key: 'showMethods', label: 'Methods' },
    { key: 'showTraits', label: 'Traits' },
  ],
  state: [
    { key: 'showActions', label: 'Actions' },
    { key: 'showTransitionLabels', label: 'Transition Labels' },
    { key: 'showGuards', label: 'Guards' },
    { key: 'showGuardLabels', label: 'Guard Labels' },
    { key: 'showNaturalLanguage', label: 'Natural Language' },
  ],
  feature: [
    { key: 'showFeatureDependency', label: 'Feature Dependency' },
  ],
  structure: [],
}

const LAYOUT_OPTIONS = [
  { value: 'dot', label: 'Dot (default)' },
  { value: 'sfdp', label: 'SFDP' },
  { value: 'circo', label: 'Circo' },
  { value: 'neato', label: 'Neato' },
  { value: 'fdp', label: 'FDP' },
  { value: 'twopi', label: 'Twopi' },
]

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function PrefToggle({ prefKey, label }: { prefKey: DisplayPrefKey; label: string }) {
  const checked = useDiagramStore((s) => s[prefKey])
  const toggleDisplayPref = useDiagramStore((s) => s.toggleDisplayPref)

  return (
    <label className="flex items-center justify-between py-0.5 text-xs text-ink cursor-pointer hover:text-ink-muted transition-colors">
      {label}
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={() => toggleDisplayPref(prefKey)}
      />
    </label>
  )
}

export function Preferences() {
  const { theme, setTheme } = useUiStore()
  const viewMode = useDiagramStore((s) => s.viewMode)
  const layoutAlgorithm = useDiagramStore((s) => s.layoutAlgorithm)
  const setLayoutAlgorithm = useDiagramStore((s) => s.setLayoutAlgorithm)

  const toggles = DISPLAY_TOGGLES[viewMode]

  return (
    <div className="p-3">
      <div className="mb-4">
        <div className="text-xs font-semibold text-ink-muted mb-2">
          Diagram Display
        </div>
        {toggles.length > 0 ? (
          <div className="space-y-1.5">
            {toggles.map(({ key, label }) => (
              <PrefToggle key={key} prefKey={key} label={label} />
            ))}
          </div>
        ) : (
          <p className="text-xxs text-ink-faint">No display options for this diagram type.</p>
        )}
        <div className="mt-3">
          <div className="text-xxs font-medium text-ink-muted mb-1.5">Layout Algorithm</div>
          <Combobox
            options={LAYOUT_OPTIONS}
            value={layoutAlgorithm}
            onSelect={(v) => setLayoutAlgorithm(v as GvLayoutAlgorithm)}
            searchable={false}
          />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-ink-muted mb-2">
          Theme
        </div>
        <Combobox
          options={THEME_OPTIONS}
          value={theme}
          onSelect={(v) => setTheme(v as 'light' | 'dark' | 'system')}
          searchable={false}
        />
      </div>
    </div>
  )
}

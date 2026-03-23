import { useUiStore } from '../../stores/uiStore'
import {
  useDiagramStore,
  VIEW_OUTPUT_KIND,
  type GvLayoutAlgorithm,
} from '../../stores/diagramStore'
import { Combobox } from '@/components/ui/combobox'
import { DISPLAY_TOGGLES, LAYOUT_OPTIONS } from '../../constants/diagram'
import { DisplayToggle } from '../layout/Sidebar'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

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
              <DisplayToggle key={key} prefKey={key} label={label} />
            ))}
          </div>
        ) : (
          <p className="text-xxs text-ink-faint">No display options for this diagram type.</p>
        )}
        {VIEW_OUTPUT_KIND[viewMode] !== 'html' && (
          <div className="mt-3">
            <div className="text-xxs font-medium text-ink-muted mb-1.5">Layout Algorithm</div>
            <Combobox
              options={LAYOUT_OPTIONS}
              value={layoutAlgorithm}
              onSelect={(v) => setLayoutAlgorithm(v as GvLayoutAlgorithm)}
              searchable={false}
            />
          </div>
        )}
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

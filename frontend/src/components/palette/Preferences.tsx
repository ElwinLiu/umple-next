import { useUiStore } from '../../stores/uiStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function Preferences() {
  const {
    showAttributes,
    showMethods,
    showActions,
    showTraits,
    theme,
    togglePreference,
    setTheme,
  } = useUiStore()

  const toggles: { key: 'showAttributes' | 'showMethods' | 'showActions' | 'showTraits'; label: string }[] = [
    { key: 'showAttributes', label: 'Show Attributes' },
    { key: 'showMethods', label: 'Show Methods' },
    { key: 'showActions', label: 'Show Actions' },
    { key: 'showTraits', label: 'Show Traits' },
  ]

  return (
    <div className="p-3">
      <div className="mb-4">
        <div className="text-xs font-semibold text-ink-muted mb-2">
          Diagram Display
        </div>
        {toggles.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 py-1 text-xs text-ink cursor-pointer hover:text-ink transition-colors"
          >
            <input
              type="checkbox"
              checked={{ showAttributes, showMethods, showActions, showTraits }[key]}
              onChange={() => togglePreference(key)}
              className="m-0 accent-brand"
            />
            {label}
          </label>
        ))}
      </div>
      <div>
        <div className="text-xs font-semibold text-ink-muted mb-2">
          Theme
        </div>
        <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
          <SelectTrigger className="h-7 px-2 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light" className="text-xs">Light</SelectItem>
            <SelectItem value="dark" className="text-xs">Dark</SelectItem>
            <SelectItem value="system" className="text-xs">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

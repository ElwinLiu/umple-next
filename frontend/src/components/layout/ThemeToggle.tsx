import { Moon, Sun, Monitor } from 'lucide-react'
import { usePreferencesStore } from '../../stores/preferencesStore'

const options = [
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
]

export function ThemeToggle() {
  const theme = usePreferencesStore((s) => s.theme)
  const setTheme = usePreferencesStore((s) => s.setTheme)

  function handleSwitch(value: (typeof options)[number]['value']) {
    document.documentElement.classList.add('disable-transitions')
    setTheme(value)
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('disable-transitions')
    })
  }

  return (
    <div
      className="flex rounded-lg border border-border bg-surface-0 p-1 min-w-max"
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={`Switch to ${label} theme`}
            title={label}
            onClick={() => handleSwitch(value)}
            className={`flex items-center justify-center gap-1 rounded-md h-6 px-2 cursor-pointer transition-colors ${
              active ? 'bg-ink text-ink-inverse' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon className="size-[15px] shrink-0" />
            {active && (
              <span className="font-mono text-[12px] leading-none tracking-[-0.015rem] uppercase whitespace-nowrap">
                {label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

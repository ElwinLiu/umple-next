import { Moon, Sun, Monitor } from 'lucide-react'
import { useUiStore } from '../../stores/uiStore'
import { cn } from '@/lib/utils'

const options = [
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
]

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  return (
    <div
      className="flex rounded-lg border border-border bg-surface-0 p-1"
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
            onClick={() => setTheme(value)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 h-6 cursor-pointer transition-all duration-200',
              active
                ? 'bg-ink text-ink-inverse'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            <Icon className="size-[15px] shrink-0" />
            {active && (
              <span className="font-mono text-[12px] leading-none tracking-[-0.015rem] uppercase animate-in fade-in-0 duration-150">
                {label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

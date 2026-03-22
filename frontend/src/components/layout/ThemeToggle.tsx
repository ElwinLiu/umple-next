import { Moon, Sun, Monitor } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../../stores/uiStore'

const options = [
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
]

/** Must match the container's p-1 in the JSX below */
const CONTAINER_PAD = 4
/** Extra breathing room added to each expanded button's measured width */
const EXPAND_BUFFER = 8
/** Fallback if the collapsed measurement element is missing */
const COLLAPSED_FALLBACK = 28

const LABEL_CLASSES =
  'font-mono text-[12px] leading-none tracking-[-0.015rem] uppercase whitespace-nowrap'

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const measureRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isFirst = useRef(true)
  const resizeRaf = useRef(0)
  const [widths, setWidths] = useState<{
    collapsed: number
    expanded: Record<string, number>
  } | null>(null)

  // Measure all button widths once on mount from hidden elements
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const expanded: Record<string, number> = {}
    el.querySelectorAll<HTMLElement>('[data-value]').forEach((n) => {
      expanded[n.dataset.value!] = n.offsetWidth + EXPAND_BUFFER
    })
    const collapsed =
      el.querySelector<HTMLElement>('[data-collapsed]')?.offsetWidth ||
      COLLAPSED_FALLBACK
    setWidths({ collapsed, expanded })
  }, [])

  /** Apply indicator position — shared by theme-change and resize paths */
  function applyIndicator(pad: number, animate: boolean) {
    if (!widths || !theme) return
    const el = indicatorRef.current
    if (!el) return
    const activeIndex = options.findIndex((o) => o.value === theme)
    const x = pad + activeIndex * widths.collapsed
    const w = widths.expanded[theme] || widths.collapsed
    if (!animate) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${x}px)`
      el.style.width = `${w}px`
      el.offsetHeight // force reflow so "none" takes effect
      el.style.transition = ''
    } else {
      el.style.transform = `translateX(${x}px)`
      el.style.width = `${w}px`
    }
  }

  // Position indicator and re-enable page transitions after theme change
  useEffect(() => {
    if (!widths || !theme) return
    applyIndicator(CONTAINER_PAD, !isFirst.current)
    isFirst.current = false

    // Re-enable page transitions (only if they were disabled by handleSwitch)
    if (document.documentElement.classList.contains('disable-transitions')) {
      const id = requestAnimationFrame(() => {
        document.documentElement.classList.remove('disable-transitions')
      })
      return () => cancelAnimationFrame(id)
    }
  }, [widths, theme])

  // Recalculate on resize — rAF-debounced
  useEffect(() => {
    if (!widths) return
    const onResize = () => {
      cancelAnimationFrame(resizeRaf.current)
      resizeRaf.current = requestAnimationFrame(() => {
        const container = containerRef.current
        if (!container) return
        const pad = parseFloat(getComputedStyle(container).paddingLeft)
        applyIndicator(pad, false)
      })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(resizeRaf.current)
    }
  }, [widths, theme])

  function handleSwitch(value: (typeof options)[number]['value']) {
    document.documentElement.classList.add('disable-transitions')
    setTheme(value)
  }

  // Hidden measurement elements — removed once measured
  const measureEl = !widths && (
    <div
      ref={measureRef}
      className="pointer-events-none fixed -left-[9999px] -top-[9999px] flex"
      aria-hidden="true"
    >
      <button
        data-collapsed
        className="flex items-center justify-center px-2 h-6"
      >
        <span className="flex-shrink-0">
          <Moon className="size-[15px]" />
        </span>
      </button>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          data-value={value}
          className="flex items-center gap-1 px-2 h-6"
        >
          <span className="flex-shrink-0">
            <Icon className="size-[15px]" />
          </span>
          <span className={LABEL_CLASSES}>{label}</span>
        </button>
      ))}
    </div>
  )

  if (!widths || !theme) {
    return (
      <>
        {measureEl}
        <div className="h-8 w-[104px]" />
      </>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative flex rounded-lg border border-border bg-surface-0 p-1 min-w-max"
      role="radiogroup"
      aria-label="Theme"
    >
      <div
        ref={indicatorRef}
        className="theme-selector-indicator absolute left-0 top-1 rounded-md bg-ink h-6"
      />

      {options.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value
        return (
          <button
            key={value}
            role="radio"
            aria-checked={isActive}
            aria-label={`Switch to ${label} theme`}
            title={label}
            onClick={() => handleSwitch(value)}
            className={`theme-selector-button relative z-10 flex cursor-pointer items-center justify-center rounded-md h-6 gap-1 px-2 overflow-hidden ${
              isActive ? 'text-ink-inverse' : 'text-ink-muted hover:text-ink'
            }`}
            style={{
              width: isActive ? widths.expanded[value] : widths.collapsed,
            }}
          >
            <span className="flex-shrink-0">
              <Icon className="size-[15px]" />
            </span>
            {isActive && <span className={LABEL_CLASSES}>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}

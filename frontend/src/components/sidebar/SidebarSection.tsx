import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Collapsible sidebar section ──

interface SidebarSectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  /** Controlled open state. Omit to use internal state. */
  open?: boolean
  /** Controlled toggle. Required when `open` is provided. */
  onToggle?: () => void
  /** Default open state when uncontrolled. */
  defaultOpen?: boolean
  /** Extra elements rendered at the right end of the header (badges, action buttons). */
  actions?: React.ReactNode
  /** Data attribute for tour/test targeting. */
  'data-tour'?: string
  className?: string
  children: React.ReactNode
}

export function SidebarSection({
  title,
  icon: Icon,
  open: openProp,
  onToggle,
  defaultOpen = false,
  actions,
  className,
  children,
  ...rest
}: SidebarSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = openProp ?? internalOpen
  const toggle = onToggle ?? (() => setInternalOpen((v) => !v))

  // ── Animate content height ──
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(isOpen ? undefined : 0)
  const [isAnimating, setIsAnimating] = useState(false)
  const firstRender = useRef(true)

  const measureAndAnimate = useCallback((opening: boolean) => {
    const el = contentRef.current
    if (!el) return

    if (opening) {
      // Expanding: measure scroll height, animate from 0
      setHeight(0)
      setIsAnimating(true)
      requestAnimationFrame(() => {
        setHeight(el.scrollHeight)
      })
    } else {
      // Collapsing: lock to current height, then animate to 0
      setHeight(el.scrollHeight)
      setIsAnimating(true)
      requestAnimationFrame(() => {
        setHeight(0)
      })
    }
  }, [])

  useEffect(() => {
    // Skip animation on first render
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    measureAndAnimate(isOpen)
  }, [isOpen, measureAndAnimate])

  const handleTransitionEnd = () => {
    setIsAnimating(false)
    if (isOpen) {
      // After expanding, remove fixed height so content can reflow naturally
      setHeight(undefined)
    }
  }

  return (
    <div className={cn('group/section', className)} data-tour={rest['data-tour']}>
      {/* ── Header: Layer 1 — navigation/toggle ── */}
      <button
        onClick={toggle}
        className="flex items-center gap-2 w-full px-4 py-2 text-[13px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer text-left"
      >
        <Icon className="size-4 text-ink-muted shrink-0" />
        <span className="flex-1 text-left">{title}</span>
        {actions && (
          <span
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </span>
        )}
        <ChevronRight
          className={cn(
            'size-3.5 text-ink-faint shrink-0 transition-transform duration-200 ease-out',
            isOpen && 'rotate-90',
          )}
        />
      </button>

      {/* ── Content: Layer 2 — collapsible body ── */}
      <div
        ref={contentRef}
        className={cn(
          'overflow-hidden transition-[height,opacity] duration-200 ease-out',
          // When fully collapsed and not mid-animation, hide from DOM flow
          !isOpen && !isAnimating && 'h-0',
        )}
        style={height !== undefined ? { height } : undefined}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="relative px-4 pb-3 pt-1 ml-4">
          {/* Subtle left guide line connecting content to header icon */}
          <div className="absolute left-4 top-0 bottom-2 w-px bg-border/50" />
          <div className="pl-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section subtitle label ──

interface SidebarLabelProps {
  className?: string
  children: React.ReactNode
}

export function SidebarLabel({ className, children }: SidebarLabelProps) {
  return (
    <div className={cn('text-xxs font-semibold text-ink-faint uppercase tracking-wider mb-1.5', className)}>
      {children}
    </div>
  )
}

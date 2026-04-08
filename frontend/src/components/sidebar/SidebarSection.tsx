import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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

  return (
    <div className={className} data-tour={rest['data-tour']}>
      <button
        onClick={toggle}
        className="flex items-center gap-2 w-full px-4 pt-2.5 pb-1.5 text-[13px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer text-left"
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
        {isOpen ? (
          <ChevronDown className="size-3.5 text-ink-faint shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-ink-faint shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-3 pt-0.5 ml-6">
          {children}
        </div>
      )}
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

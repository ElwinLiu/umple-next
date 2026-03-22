import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidePanelProps {
  title: string
  open: boolean
  onClose: () => void
  width?: string
  children: React.ReactNode
}

export function SidePanel({ title, open, onClose, width = 'sm:w-[400px]', children }: SidePanelProps) {
  if (!open) return null

  return (
    <div className={cn('fixed top-14 right-0 w-full bottom-0 bg-surface-0 border-l border-border flex flex-col z-[100] text-ink', width)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1">
        <span className="font-semibold text-sm">{title}</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          aria-label={`Close ${title.toLowerCase()} panel`}
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </div>
  )
}

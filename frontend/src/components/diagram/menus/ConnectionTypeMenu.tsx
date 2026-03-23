import { useRef } from 'react'
import { ArrowRight, Triangle } from 'lucide-react'
import { useMenuClose } from '@/hooks/useMenuClose'

export type ConnectionChoice = 'association' | 'generalization'

interface ConnectionTypeMenuProps {
  position: { x: number; y: number } | null
  onSelect: (type: ConnectionChoice) => void
  onClose: () => void
}

export function ConnectionTypeMenu({ position, onSelect, onClose }: ConnectionTypeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useMenuClose(menuRef, position, onClose)

  if (!position) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[10rem] rounded-md border border-surface-2 bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Choose relationship type"
    >
      <button
        onClick={() => onSelect('association')}
        role="menuitem"
        className="relative flex w-full cursor-default items-center gap-1.5 rounded-sm px-2 py-1 text-xs outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      >
        <ArrowRight className="size-3.5 text-muted-foreground" />
        Association
      </button>
      <button
        onClick={() => onSelect('generalization')}
        role="menuitem"
        className="relative flex w-full cursor-default items-center gap-1.5 rounded-sm px-2 py-1 text-xs outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      >
        <Triangle className="size-3.5 text-muted-foreground" />
        Generalization
      </button>
    </div>
  )
}

import { useCallback, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { useSessionStore } from '@/stores/sessionStore'
import { useDiagramSync } from '@/hooks/useDiagramSync'
import { useMenuClose } from '@/hooks/useMenuClose'
import { edgeDeletionParams } from '@/lib/diagramHelpers'

interface EdgeContextMenuProps {
  position: { x: number; y: number } | null
  edgeId: string | null
  onClose: () => void
}

export function EdgeContextMenu({ position, edgeId, onClose }: EdgeContextMenuProps) {
  const { sync } = useDiagramSync()
  const menuRef = useRef<HTMLDivElement>(null)

  useMenuClose(menuRef, position, onClose)

  const handleDelete = useCallback(async () => {
    if (!edgeId) return
    const { getDiagramData, removeEdge } = useSessionStore.getState()
    const edges = getDiagramData('class').edges
    const edge = edges.find((e) => e.id === edgeId)
    if (!edge) { onClose(); return }

    const { action, params } = edgeDeletionParams(edge)
    removeEdge(edgeId)
    onClose()
    await sync(action, params)
  }, [edgeId, onClose, sync])

  if (!position || !edgeId) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[8rem] rounded-md border border-surface-2 bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Edge context menu"
    >
      <button
        onClick={handleDelete}
        role="menuitem"
        className="relative flex w-full cursor-default items-center gap-1.5 rounded-sm px-2 py-1 text-xs outline-hidden select-none text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
      >
        <Trash2 className="size-3.5" />
        Delete
      </button>
    </div>
  )
}

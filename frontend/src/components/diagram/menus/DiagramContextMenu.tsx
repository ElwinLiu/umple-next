import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Plus, Maximize } from 'lucide-react'
import { useDiagramStore } from '@/stores/diagramStore'
import { useDiagramSync } from '@/hooks/useDiagramSync'
import { useMenuClose } from '@/hooks/useMenuClose'
import { generateClassName } from '@/lib/diagramHelpers'
import { MenuItem } from './MenuItem'
import type { ClassNodeData } from '../nodes/ClassNode'

interface DiagramContextMenuProps {
  position: { x: number; y: number } | null
  flowPosition: { x: number; y: number } | null
  onClose: () => void
}

export function DiagramContextMenu({ position, flowPosition, onClose }: DiagramContextMenuProps) {
  const { fitView } = useReactFlow()
  const { sync } = useDiagramSync()
  const menuRef = useRef<HTMLDivElement>(null)

  useMenuClose(menuRef, position, onClose)

  const handleAddClass = useCallback(async () => {
    const { getDiagramData, addNode } = useDiagramStore.getState()
    const nodes = getDiagramData('class').nodes
    const className = generateClassName(nodes)
    const pos = flowPosition ?? { x: 100, y: 100 }

    addNode({
      id: `class-${className}`,
      type: 'classNode',
      position: pos,
      data: {
        name: className,
        attributes: [],
        methods: [],
        isAbstract: false,
        isInterface: false,
      } satisfies ClassNodeData,
    })

    onClose()

    await sync('addClass', {
      className,
      x: String(Math.round(pos.x)),
      y: String(Math.round(pos.y)),
    })
  }, [flowPosition, onClose, sync])

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 200, maxZoom: 1 })
    onClose()
  }, [fitView, onClose])

  if (!position) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[10rem] rounded-md border border-surface-2 bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Diagram context menu"
    >
      <MenuItem onClick={handleAddClass} icon={<Plus className="size-3.5" />}>
        Add Class Here
      </MenuItem>
      <div className="-mx-1 my-1 h-px bg-border" />
      <MenuItem onClick={handleFitView} icon={<Maximize className="size-3.5" />}>
        Fit View
      </MenuItem>
    </div>
  )
}

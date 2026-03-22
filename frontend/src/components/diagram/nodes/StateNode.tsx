import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useDiagramStore } from '@/stores/diagramStore'

export interface StateNodeData {
  name: string
  isInitial: boolean
  isFinal: boolean
  entryActions: string[]
  exitActions: string[]
  nestedStates: string[]
  isCollapsed: boolean
  [key: string]: unknown
}

export const StateNode = memo(function StateNode({ data }: NodeProps) {
  const d = data as StateNodeData
  const showActions = useDiagramStore((s) => s.showActions)

  const borderClasses = d.isFinal
    ? 'border-[3px] border-double'
    : d.isInitial
      ? 'border-[3px]'
      : 'border-2'

  const headerClasses = d.isInitial
    ? 'bg-node-initial-bg text-node-initial-fg'
    : d.isFinal
      ? 'bg-node-final-bg text-node-final-fg'
      : 'bg-node-class-bg text-node-class-fg'

  const hasActions = showActions && (d.entryActions.length > 0 || d.exitActions.length > 0)
  const hasNested = d.nestedStates.length > 0

  return (
    <div
      className={`bg-surface-0 rounded-2xl min-w-[140px] text-xs font-mono shadow-md overflow-hidden border-border-strong ${borderClasses}`}
    >
      {/* TB layout: forward edges go downward, source exits from bottom, target enters from top */}
      <Handle type="source" position={Position.Bottom} className="!invisible" />
      <Handle type="target" position={Position.Top} className="!invisible" />

      {/* Back-edge handles: source exits from top, target enters from bottom */}
      <Handle type="source" position={Position.Top} id="top-source" className="!invisible" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!invisible" />

      {/* Self-loop handles */}
      <Handle type="source" position={Position.Right} id="right-source" className="!invisible" style={{ top: '20%' }} />
      <Handle type="target" position={Position.Right} id="right-target" className="!invisible" style={{ top: '80%' }} />

      {/* State name header */}
      <div
        className={cn('px-3.5 py-1.5 font-bold text-center', headerClasses, (hasActions || hasNested) && 'border-b border-border')}
      >
        {d.isInitial && <span className="mr-1">&#9679;</span>}
        {d.name}
        {d.isFinal && <span className="ml-1">&#9673;</span>}
      </div>

      {/* Entry/Exit actions */}
      {hasActions && (
        <div
          className={cn('px-2.5 py-1 text-ink-muted text-xxs', hasNested && 'border-b border-border')}
        >
          {d.entryActions.map((action, i) => (
            <div key={`entry-${i}`} className="py-px">
              <span className="text-action-entry font-semibold">entry/</span> {action}
            </div>
          ))}
          {d.exitActions.map((action, i) => (
            <div key={`exit-${i}`} className="py-px">
              <span className="text-action-exit font-semibold">exit/</span> {action}
            </div>
          ))}
        </div>
      )}

      {/* Nested states (collapsed indicator) */}
      {hasNested && (
        <div className="px-2.5 py-1 text-ink-faint text-xxs italic">
          {d.isCollapsed
            ? `[${d.nestedStates.length} nested state${d.nestedStates.length > 1 ? 's' : ''}]`
            : d.nestedStates.map((ns, i) => (
                <div key={i} className="py-px">&#8627; {ns}</div>
              ))
          }
        </div>
      )}

    </div>
  )
})

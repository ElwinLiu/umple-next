import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

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

  const hasActions = d.entryActions.length > 0 || d.exitActions.length > 0
  const hasNested = d.nestedStates.length > 0

  return (
    <div
      className={`bg-surface-0 rounded-2xl min-w-[140px] text-xs font-mono shadow-md overflow-hidden border-border-strong ${borderClasses}`}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="target" position={Position.Left} id="left-target" className="!invisible" />

      {/* State name header */}
      <div
        className={`px-3.5 py-1.5 font-bold text-center ${headerClasses}`}
        style={{
          borderBottom: (hasActions || hasNested) ? '1px solid var(--color-border)' : 'none',
        }}
      >
        {d.isInitial && <span className="mr-1">&#9679;</span>}
        {d.name}
        {d.isFinal && <span className="ml-1">&#9673;</span>}
      </div>

      {/* Entry/Exit actions */}
      {hasActions && (
        <div
          className="px-2.5 py-1 text-ink-muted text-[10px]"
          style={{
            borderBottom: hasNested ? '1px solid var(--color-border)' : 'none',
          }}
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
        <div className="px-2.5 py-1 text-ink-faint text-[10px] italic">
          {d.isCollapsed
            ? `[${d.nestedStates.length} nested state${d.nestedStates.length > 1 ? 's' : ''}]`
            : d.nestedStates.map((ns, i) => (
                <div key={i} className="py-px">&#8627; {ns}</div>
              ))
          }
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!invisible" />
      <Handle type="source" position={Position.Right} id="right-source" className="!invisible" />
    </div>
  )
})

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

  const borderWidth = d.isInitial ? 3 : d.isFinal ? 3 : 2
  const borderStyle = d.isFinal ? 'double' : 'solid'
  const isDark = document.documentElement.classList.contains('dark')
  const headerBg = d.isInitial
    ? (isDark ? '#1b3a20' : '#e8f5e9')
    : d.isFinal
      ? (isDark ? '#3a1520' : '#fce4ec')
      : (isDark ? '#152a3e' : '#e3f2fd')
  const headerColor = d.isInitial
    ? (isDark ? '#6fcf76' : '#2e7d32')
    : d.isFinal
      ? (isDark ? '#f07080' : '#c62828')
      : (isDark ? '#6cb6ff' : '#1565c0')

  const hasActions = d.entryActions.length > 0 || d.exitActions.length > 0
  const hasNested = d.nestedStates.length > 0

  return (
    <div
      className="bg-surface-0 rounded-2xl min-w-[140px] text-xs font-mono shadow-md overflow-hidden"
      style={{
        border: `${borderWidth}px ${borderStyle} var(--color-border-strong)`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="target" position={Position.Left} id="left-target" className="!invisible" />

      {/* State name header */}
      <div
        className="px-3.5 py-1.5 font-bold text-center"
        style={{
          background: headerBg,
          borderBottom: (hasActions || hasNested) ? '1px solid var(--color-border)' : 'none',
          color: headerColor,
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
              <span className="text-green-800 font-semibold">entry/</span> {action}
            </div>
          ))}
          {d.exitActions.map((action, i) => (
            <div key={`exit-${i}`} className="py-px">
              <span className="text-red-800 font-semibold">exit/</span> {action}
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

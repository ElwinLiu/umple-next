import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export interface TransitionEdgeData {
  event: string
  guard: string
  action: string
  [key: string]: unknown
}

export const TransitionEdge = memo(function TransitionEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const d = data as TransitionEdgeData | undefined

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  // Build label: "event [guard] / action"
  const parts: string[] = []
  if (d?.event) parts.push(d.event)
  if (d?.guard) parts.push(`[${d.guard}]`)
  if (d?.action) parts.push(`/ ${d.action}`)
  const label = parts.join(' ')

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd="url(#state-arrow)"
        style={{ stroke: 'var(--color-border-strong)', strokeWidth: 1.5 }}
      />

      {label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-4}
            y={-12}
            width={label.length * 6.5 + 8}
            height={16}
            rx={3}
            fill="var(--color-surface-0)"
            fillOpacity={0.85}
            stroke="var(--color-border)"
            strokeWidth={0.5}
          />
          <text
            fontSize={10}
            fill="var(--color-ink)"
            fontFamily="monospace"
            dominantBaseline="central"
            textAnchor="start"
          >
            {label}
          </text>
        </g>
      )}
    </>
  )
})

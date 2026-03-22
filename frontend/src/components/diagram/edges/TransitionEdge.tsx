import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'

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
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(${labelX}px, ${labelY}px) translate(-50%, -50%)`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <div
              style={{
                background: 'color-mix(in srgb, var(--color-surface-0) 85%, transparent)',
                border: '0.5px solid var(--color-border)',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

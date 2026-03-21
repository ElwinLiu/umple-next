import { memo } from 'react'
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'

export type AssociationDecoration = 'none' | 'arrow' | 'triangle' | 'diamond-filled' | 'diamond'

export interface AssociationEdgeData {
  sourceMultiplicity: string
  targetMultiplicity: string
  sourceRole: string
  targetRole: string
  sourceDecoration?: AssociationDecoration
  targetDecoration?: AssociationDecoration
  type: 'association' | 'generalization' | 'composition' | 'aggregation' | 'unidirectional' | 'unidirectional-reverse'
  [key: string]: unknown
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function markerForDecoration(decoration: AssociationDecoration | undefined) {
  switch (decoration) {
    case 'triangle':
      return 'url(#triangle)'
    case 'diamond-filled':
      return 'url(#diamond-filled)'
    case 'diamond':
      return 'url(#diamond)'
    case 'arrow':
      return 'url(#arrow)'
    default:
      return undefined
  }
}

export const AssociationEdge = memo(function AssociationEdge(props: EdgeProps) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, data } = props
  const d = data as AssociationEdgeData | undefined

  let sourceDecoration = d?.sourceDecoration
  let targetDecoration = d?.targetDecoration

  if (!sourceDecoration && !targetDecoration) {
    switch (d?.type) {
      case 'generalization':
        targetDecoration = 'triangle'
        break
      case 'composition':
        sourceDecoration = 'diamond-filled'
        break
      case 'aggregation':
        sourceDecoration = 'diamond'
        break
      case 'unidirectional':
        targetDecoration = 'arrow'
        break
      case 'unidirectional-reverse':
        sourceDecoration = 'arrow'
        break
    }
  }

  const labelCommonProps = {
    dominantBaseline: 'central' as const,
    paintOrder: 'stroke' as const,
    pointerEvents: 'none' as const,
    stroke: 'var(--color-surface-0)',
    strokeWidth: 3,
  }

  // Self-loop: source and target are the same node
  if (source === target) {
    // Right-side handles: source at 20% (upper), target at 80% (lower)
    const midY = (sourceY + targetY) / 2
    const offset = 50
    // Smooth D-shaped bezier — no sharp corners
    const loopPath = `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY} ${targetX + offset} ${targetY} ${targetX} ${targetY}`
    const labelX = sourceX + offset * 0.55
    const labelY = midY

    return (
      <>
        <BaseEdge
          path={loopPath}
          markerEnd={markerForDecoration(targetDecoration)}
          markerStart={markerForDecoration(sourceDecoration)}
          style={{ stroke: 'var(--color-border-strong)', strokeWidth: 1.5 }}
        />
        {d?.sourceMultiplicity && (
          <text
            data-testid={`edge-label-${id}-source-multiplicity`}
            x={labelX} y={labelY - 10}
            fontSize={12} fontFamily="var(--font-sans)" fill="var(--color-ink-muted)"
            textAnchor="start" {...labelCommonProps}
          >{d.sourceMultiplicity}</text>
        )}
        {d?.targetMultiplicity && (
          <text
            data-testid={`edge-label-${id}-target-multiplicity`}
            x={labelX} y={labelY + 10}
            fontSize={12} fontFamily="var(--font-sans)" fill="var(--color-ink-muted)"
            textAnchor="start" {...labelCommonProps}
          >{d.targetMultiplicity}</text>
        )}
        {d?.sourceRole && (
          <text
            data-testid={`edge-label-${id}-source-role`}
            x={labelX} y={labelY - 24}
            fontSize={10} fontFamily="var(--font-sans)" fill="var(--color-ink-faint)"
            textAnchor="start" {...labelCommonProps}
          >{d.sourceRole}</text>
        )}
        {d?.targetRole && (
          <text
            data-testid={`edge-label-${id}-target-role`}
            x={labelX} y={labelY + 24}
            fontSize={10} fontFamily="var(--font-sans)" fill="var(--color-ink-faint)"
            textAnchor="start" {...labelCommonProps}
          >{d.targetRole}</text>
        )}
      </>
    )
  }

  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const length = Math.hypot(dx, dy) || 1
  const unitX = dx / length
  const unitY = dy / length
  let normalX = -unitY
  let normalY = unitX

  // Keep the label offset mostly upward so multiplicities stay clear of the edge.
  if (normalY > 0 || (Math.abs(normalY) < 0.15 && normalX > 0)) {
    normalX *= -1
    normalY *= -1
  }

  const alongOffset = Math.min(
    clamp(length * 0.18, 24, 44),
    Math.max(12, length / 2 - 10),
  )
  const sourceBaseX = sourceX + unitX * alongOffset
  const sourceBaseY = sourceY + unitY * alongOffset
  const targetBaseX = targetX - unitX * alongOffset
  const targetBaseY = targetY - unitY * alongOffset

  const sourceAnchor = Math.abs(dx) > Math.abs(dy)
    ? (unitX >= 0 ? 'start' : 'end')
    : 'middle'
  const targetAnchor = Math.abs(dx) > Math.abs(dy)
    ? (unitX >= 0 ? 'end' : 'start')
    : 'middle'

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerForDecoration(targetDecoration)}
        markerStart={markerForDecoration(sourceDecoration)}
        style={{ stroke: 'var(--color-border-strong)', strokeWidth: 1.5 }}
      />

      {/* Multiplicity labels */}
      {d?.sourceMultiplicity && (
        <text
          data-testid={`edge-label-${id}-source-multiplicity`}
          x={sourceBaseX + normalX * 12}
          y={sourceBaseY + normalY * 12}
          fontSize={12}
          fontFamily="var(--font-sans)"
          fill="var(--color-ink-muted)"
          textAnchor={sourceAnchor}
          {...labelCommonProps}
        >
          {d.sourceMultiplicity}
        </text>
      )}
      {d?.targetMultiplicity && (
        <text
          data-testid={`edge-label-${id}-target-multiplicity`}
          x={targetBaseX + normalX * 12}
          y={targetBaseY + normalY * 12}
          fontSize={12}
          fontFamily="var(--font-sans)"
          fill="var(--color-ink-muted)"
          textAnchor={targetAnchor}
          {...labelCommonProps}
        >
          {d.targetMultiplicity}
        </text>
      )}

      {/* Role labels */}
      {d?.sourceRole && (
        <text
          data-testid={`edge-label-${id}-source-role`}
          x={sourceBaseX + normalX * 28}
          y={sourceBaseY + normalY * 28}
          fontSize={10}
          fontFamily="var(--font-sans)"
          fill="var(--color-ink-faint)"
          textAnchor={sourceAnchor}
          {...labelCommonProps}
        >
          {d.sourceRole}
        </text>
      )}
      {d?.targetRole && (
        <text
          data-testid={`edge-label-${id}-target-role`}
          x={targetBaseX + normalX * 28}
          y={targetBaseY + normalY * 28}
          fontSize={10}
          fontFamily="var(--font-sans)"
          fill="var(--color-ink-faint)"
          textAnchor={targetAnchor}
          {...labelCommonProps}
        >
          {d.targetRole}
        </text>
      )}
    </>
  )
})

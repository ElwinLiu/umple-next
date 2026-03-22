import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react'

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

const haloShadow = [
  '-1px -1px 0 var(--color-surface-0)',
  ' 1px -1px 0 var(--color-surface-0)',
  '-1px  1px 0 var(--color-surface-0)',
  ' 1px  1px 0 var(--color-surface-0)',
  ' 0   -1px 0 var(--color-surface-0)',
  ' 0    1px 0 var(--color-surface-0)',
  '-1px  0   0 var(--color-surface-0)',
  ' 1px  0   0 var(--color-surface-0)',
].join(',')

function anchorToTranslateX(anchor: string): string {
  switch (anchor) {
    case 'end': return '-100%'
    case 'middle': return '-50%'
    default: return '0%'
  }
}

function EdgeLabel({ testId, x, y, fontSize, color, children, translateX = '0%' }: {
  testId: string
  x: number
  y: number
  fontSize: number
  color: string
  children: React.ReactNode
  translateX?: string
}) {
  return (
    <div
      data-testid={testId}
      className="nodrag nopan"
      style={{
        position: 'absolute',
        transform: `translate(${x}px, ${y}px) translateX(${translateX}) translateY(-50%)`,
        fontSize,
        fontFamily: 'var(--font-sans)',
        color,
        textShadow: haloShadow,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {children}
    </div>
  )
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
        <EdgeLabelRenderer>
          {d?.sourceMultiplicity && (
            <EdgeLabel testId={`edge-label-${id}-source-multiplicity`} x={labelX} y={labelY - 10} fontSize={12} color="var(--color-ink-muted)">{d.sourceMultiplicity}</EdgeLabel>
          )}
          {d?.targetMultiplicity && (
            <EdgeLabel testId={`edge-label-${id}-target-multiplicity`} x={labelX} y={labelY + 10} fontSize={12} color="var(--color-ink-muted)">{d.targetMultiplicity}</EdgeLabel>
          )}
          {d?.sourceRole && (
            <EdgeLabel testId={`edge-label-${id}-source-role`} x={labelX} y={labelY - 24} fontSize={10} color="var(--color-ink-faint)">{d.sourceRole}</EdgeLabel>
          )}
          {d?.targetRole && (
            <EdgeLabel testId={`edge-label-${id}-target-role`} x={labelX} y={labelY + 24} fontSize={10} color="var(--color-ink-faint)">{d.targetRole}</EdgeLabel>
          )}
        </EdgeLabelRenderer>
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

      <EdgeLabelRenderer>
        {d?.sourceMultiplicity && (
          <EdgeLabel testId={`edge-label-${id}-source-multiplicity`} x={sourceBaseX + normalX * 12} y={sourceBaseY + normalY * 12} fontSize={12} color="var(--color-ink-muted)" translateX={anchorToTranslateX(sourceAnchor)}>{d.sourceMultiplicity}</EdgeLabel>
        )}
        {d?.targetMultiplicity && (
          <EdgeLabel testId={`edge-label-${id}-target-multiplicity`} x={targetBaseX + normalX * 12} y={targetBaseY + normalY * 12} fontSize={12} color="var(--color-ink-muted)" translateX={anchorToTranslateX(targetAnchor)}>{d.targetMultiplicity}</EdgeLabel>
        )}
        {d?.sourceRole && (
          <EdgeLabel testId={`edge-label-${id}-source-role`} x={sourceBaseX + normalX * 28} y={sourceBaseY + normalY * 28} fontSize={10} color="var(--color-ink-faint)" translateX={anchorToTranslateX(sourceAnchor)}>{d.sourceRole}</EdgeLabel>
        )}
        {d?.targetRole && (
          <EdgeLabel testId={`edge-label-${id}-target-role`} x={targetBaseX + normalX * 28} y={targetBaseY + normalY * 28} fontSize={10} color="var(--color-ink-faint)" translateX={anchorToTranslateX(targetAnchor)}>{d.targetRole}</EdgeLabel>
        )}
      </EdgeLabelRenderer>
    </>
  )
})

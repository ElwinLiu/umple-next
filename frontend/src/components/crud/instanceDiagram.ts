import type { CrudSchema } from '@/api/types'
import { assocKey, toIdArray, type CrudInstance } from '@/stores/crudStore'

function escapeLabel(s: string): string {
  return s.replace(/[\\"{}<>|]/g, '\\$&')
}

function associationEdgeKey(srcNode: string, tgtNode: string, roleName: string, reverseRoleName: string): string {
  const nodeKey = [srcNode, tgtNode].sort().join('->')
  const roleKey = [roleName, reverseRoleName].filter(Boolean).sort().join('|')
  return `${nodeKey}::${roleKey}`
}

export function generateInstanceDiagramDot(
  schema: CrudSchema,
  instances: Record<string, CrudInstance[]>,
): string {
  const lines: string[] = [
    'digraph InstanceDiagram {',
    '  rankdir=TB;',
    '  node [shape=record, fontsize=10, fontname="Helvetica"];',
    '  edge [fontsize=8, fontname="Helvetica"];',
    '',
  ]

  for (const cls of schema.classes) {
    const list = instances[cls.name] ?? []
    for (const inst of list) {
      const nodeId = `${cls.name}_${inst._id}`
      const header = `${cls.name} #${inst._id}`
      const attrLines = cls.attributes
        .map((a) => {
          const val = inst[a.name]
          const display = val === undefined || val === null ? '-' : String(val)
          return `${escapeLabel(a.name)} = ${escapeLabel(display)}`
        })
        .join('\\l')
      const label = attrLines ? `{${escapeLabel(header)}|${attrLines}\\l}` : escapeLabel(header)
      lines.push(`  ${nodeId} [label="${label}"];`)
    }
  }

  lines.push('')

  const drawnEdges = new Set<string>()
  for (const cls of schema.classes) {
    const list = instances[cls.name] ?? []
    for (const inst of list) {
      for (const assoc of cls.associations) {
        if (!assoc.isNavigable) continue
        const ids = toIdArray(inst[assocKey(assoc.roleName)])

        for (const tid of ids) {
          const srcNode = `${cls.name}_${inst._id}`
          const tgtNode = `${assoc.targetClass}_${tid}`
          const edgeKey = associationEdgeKey(
            srcNode,
            tgtNode,
            assoc.roleName,
            assoc.reverseRoleName,
          )
          if (drawnEdges.has(edgeKey)) continue
          drawnEdges.add(edgeKey)
          const label = assoc.roleName ? ` [label="${escapeLabel(assoc.roleName)}"]` : ''
          lines.push(`  ${srcNode} -> ${tgtNode}${label};`)
        }
      }
    }
  }

  lines.push('}')
  return lines.join('\n')
}

import type { CrudAssociation, CrudSchema } from '@/api/types'
import {
  collectClassAssociations,
  findReverseAssoc,
  getAssocIds,
  getAssociationRuntimeIdentity,
  type CrudInstance,
} from '@/stores/crudStore'

function escapeLabel(s: string): string {
  return s.replace(/[\\"{}<>|]/g, '\\$&')
}

function associationPairKey(
  schema: CrudSchema,
  srcNode: string,
  tgtNode: string,
  assoc: CrudAssociation,
): string {
  const nodeKey = [srcNode, tgtNode].sort().join('->')
  const reverseAssoc = findReverseAssoc(schema, assoc)
  const assocKey = reverseAssoc
    ? [getAssociationRuntimeIdentity(assoc), getAssociationRuntimeIdentity(reverseAssoc)].sort().join('<->')
    : getAssociationRuntimeIdentity(assoc)
  return `${nodeKey}::${assocKey}`
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
  const nodeIdByInstanceId = new Map<number, string>()

  for (const cls of schema.classes) {
    const list = instances[cls.name] ?? []
    for (const inst of list) {
      const nodeId = `${cls.name}_${inst._id}`
      nodeIdByInstanceId.set(inst._id, nodeId)
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
      for (const assoc of collectClassAssociations(schema, cls.name)) {
        if (!assoc.isNavigable) continue
        const ids = getAssocIds(inst, assoc)

        for (const tid of ids) {
          const srcNode = nodeIdByInstanceId.get(inst._id) ?? `${cls.name}_${inst._id}`
          const tgtNode = nodeIdByInstanceId.get(tid)
          if (!tgtNode) continue
          const edgeKey = associationPairKey(schema, srcNode, tgtNode, assoc)
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

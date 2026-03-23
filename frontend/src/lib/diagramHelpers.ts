import type { Edge } from '@xyflow/react'
import type { AssociationEdgeData } from '@/components/diagram/edges/AssociationEdge'

/** Extract the Umple class name from a ReactFlow node ID (e.g. "class-Foo" → "Foo"). */
export function extractClassName(nodeId: string): string {
  return nodeId.replace(/^class-/, '')
}

/** Build a ReactFlow node ID from a class name. */
export function classNodeId(className: string): string {
  return `class-${className}`
}

/** Generate a unique class name that doesn't conflict with existing nodes. */
export function generateClassName(nodes: { id: string }[]): string {
  const existing = new Set(nodes.map((n) => extractClassName(n.id)))
  let i = 1
  while (existing.has(`NewClass${i}`)) i++
  return `NewClass${i}`
}

/** Determine the correct sync action and params for deleting an edge. */
export function edgeDeletionParams(edge: Edge): { action: string; params: Record<string, string> } {
  const data = edge.data as AssociationEdgeData | undefined
  const sourceClass = extractClassName(edge.source)
  const targetClass = extractClassName(edge.target)

  if (data?.type === 'generalization') {
    return { action: 'removeGeneralization', params: { childClass: sourceClass, parentClass: targetClass } }
  }
  const assocId = (data as any)?.assocId ?? ''
  return { action: 'removeAssociation', params: { classOneId: sourceClass, classTwoId: targetClass, assocId } }
}

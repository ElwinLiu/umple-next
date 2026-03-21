import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { UmpleModel } from '../api/types'
import type { ClassNodeData } from '../components/diagram/nodes/ClassNode'
import type { AssociationEdgeData } from '../components/diagram/edges/AssociationEdge'
import type { StateNodeData } from '../components/diagram/nodes/StateNode'
import type { TransitionEdgeData } from '../components/diagram/edges/TransitionEdge'
import { useDiagramStore } from '../stores/diagramStore'
import type { Position, UmpleAttribute, UmpleMethod } from '../api/types'
import dagre from '@dagrejs/dagre'

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 120

const STATE_GRID_COLS = 3
const STATE_X_GAP = 200
const STATE_Y_GAP = 160

interface UmpleState {
  name: string
  entryActions?: string[]
  exitActions?: string[]
  nestedStates?: UmpleState[]
  transitions?: UmpleTransition[]
}

interface UmpleTransition {
  event: string
  guard?: string
  action?: string
  nextState: string
}

interface UmpleStateMachine {
  name: string
  states: UmpleState[]
}

interface DiagramNodeMetrics {
  width: number
  height: number
}

interface LayoutEntry {
  name: string
  metrics: DiagramNodeMetrics
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function estimateTextWidth(text: string) {
  return text.length * 7
}

function resolveNodeMetrics(
  position: Position | undefined,
  fallback: DiagramNodeMetrics,
): DiagramNodeMetrics {
  // Use the larger of backend-reported and estimated size — the backend's
  // dimensions are for the old UmpleOnline UI and are much smaller than
  // our ReactFlow nodes actually render.
  return {
    width: Math.max(position?.width ?? 0, fallback.width),
    height: Math.max(position?.height ?? 0, fallback.height),
  }
}

function estimateClassMetrics(
  name: string,
  attributes: UmpleAttribute[] = [],
  methods: UmpleMethod[] = [],
  flags: { isAbstract: boolean; isInterface: boolean },
): DiagramNodeMetrics {
  const headerLabel = flags.isInterface
    ? `<<interface>> ${name}`
    : flags.isAbstract
      ? `<<abstract>> ${name}`
      : name

  const lines = [
    headerLabel,
    ...(attributes.length > 0
      ? attributes.map((attr) => (attr.type ? `${attr.name}: ${attr.type}` : attr.name))
      : [' ']),
    ...(methods.length > 0
      ? methods.map((method) => `${method.name}(${method.parameters || ''}): ${method.type || 'void'}`)
      : []),
  ]

  const widestLine = lines.reduce((max, line) => Math.max(max, estimateTextWidth(line)), 0)
  const attributeRows = Math.max(attributes.length, 1)
  const methodRows = methods.length

  return {
    width: clamp(Math.round(widestLine + 40), DEFAULT_WIDTH, 420),
    height: clamp(
      38 + attributeRows * 18 + (methodRows > 0 ? 10 + methodRows * 18 : 0),
      DEFAULT_HEIGHT,
      420,
    ),
  }
}

interface DagreEdge {
  source: string
  target: string
}

function buildDagrePositions(
  entries: LayoutEntry[],
  edges: DagreEdge[],
) {
  const positions = new Map<string, { x: number; y: number }>()
  if (entries.length === 0) return positions

  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: 80,
    marginx: 50,
    marginy: 50,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const entry of entries) {
    g.setNode(entry.name, {
      width: entry.metrics.width,
      height: entry.metrics.height,
    })
  }

  const nodeSet = new Set(entries.map((e) => e.name))
  for (const edge of edges) {
    // Skip self-edges — dagre doesn't support them; they're rendered as loops by the edge component
    if (edge.source === edge.target) continue
    if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  for (const entry of entries) {
    const node = g.node(entry.name)
    if (node) {
      // dagre positions are center-based; convert to top-left for ReactFlow
      positions.set(entry.name, {
        x: node.x - entry.metrics.width / 2,
        y: node.y - entry.metrics.height / 2,
      })
    }
  }

  return positions
}

function asBoolean(value: string | boolean | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue
  }
  return value === true || value === 'true'
}

export function useDiagram() {
  const { setNodes, setEdges, setStateNodes, setStateEdges } = useDiagramStore()

  const updateFromModel = useCallback((model: UmpleModel) => {
    const classes = model.umpleClasses || []
    const associations = model.umpleAssociations || []
    const interfaces = model.umpleInterfaces || []

    // Always run dagre for all nodes — the backend's positions were designed
    // for the old UmpleOnline UI and are too cramped for our larger ReactFlow nodes.
    const layoutEntries: LayoutEntry[] = [
      ...classes
        .map((cls) => ({
          name: cls.name,
          metrics: resolveNodeMetrics(
            cls.position,
            estimateClassMetrics(cls.name, cls.attributes, cls.methods, {
              isAbstract: cls.isAbstract || false,
              isInterface: false,
            }),
          ),
        })),
      ...interfaces
        .map((iface) => ({
          name: iface.name,
          metrics: resolveNodeMetrics(
            iface.position,
            estimateClassMetrics(iface.name, [], iface.methods, {
              isAbstract: false,
              isInterface: true,
            }),
          ),
        })),
    ]

    // Collect all relationship edges for dagre to consider
    const dagreEdges: DagreEdge[] = [
      ...associations
        .filter((a) => (a.classOneId && a.classTwoId) || (a.end1 && a.end2))
        .map((a) => ({
          source: a.classOneId ?? a.end1!.className,
          target: a.classTwoId ?? a.end2!.className,
        })),
      ...classes
        .filter((cls) => cls.extendsClass)
        .map((cls) => ({
          source: cls.name,
          target: cls.extendsClass!,
        })),
      ...classes
        .filter((cls) => cls.implementedInterfaces?.length)
        .flatMap((cls) =>
          cls.implementedInterfaces!.map((iface) => ({
            source: cls.name,
            target: iface,
          }))
        ),
    ]

    const defaultPositions = buildDagrePositions(layoutEntries, dagreEdges)

    // Create nodes from classes
    const classNodes: Node[] = classes.map((cls): Node => {
      return {
        id: `class-${cls.name}`,
        type: 'classNode',
        position: defaultPositions.get(cls.name) ?? { x: 50, y: 50 },
        data: {
          name: cls.name,
          attributes: (cls.attributes || []).map((a) => ({
            name: a.name,
            type: a.type || '',
          })),
          methods: (cls.methods || []).map((m) => ({
            name: m.name,
            returnType: m.type || 'void',
            params: m.parameters || '',
          })),
          isAbstract: cls.isAbstract || false,
          isInterface: false,
          displayColor: cls.displayColor || '',
        } satisfies ClassNodeData,
      }
    })

    // Create nodes from interfaces
    const ifaceNodes: Node[] = interfaces.map((iface): Node => {
      return {
        id: `class-${iface.name}`,
        type: 'classNode',
        position: defaultPositions.get(iface.name) ?? { x: 50, y: 50 },
        data: {
          name: iface.name,
          attributes: [],
          methods: (iface.methods || []).map((m) => ({
            name: m.name,
            returnType: m.type || 'void',
            params: m.parameters || '',
          })),
          isAbstract: false,
          isInterface: true,
        } satisfies ClassNodeData,
      }
    })

    // Create edges from associations
    // Support both flat Umple JSON (classOneId/classTwoId) and nested (end1/end2) formats
    const assocEdges: Edge[] = associations
      .filter((a) => (a.classOneId && a.classTwoId) || (a.end1 && a.end2))
      .map((assoc, i): Edge => {
        const source = assoc.classOneId
          ? `class-${assoc.classOneId}`
          : `class-${assoc.end1!.className}`
        const target = assoc.classTwoId
          ? `class-${assoc.classTwoId}`
          : `class-${assoc.end2!.className}`

        const srcMult = assoc.multiplicityOne ?? assoc.end1?.multiplicity ?? ''
        const tgtMult = assoc.multiplicityTwo ?? assoc.end2?.multiplicity ?? ''
        const srcRole = assoc.roleOne ?? assoc.end1?.roleName ?? ''
        const tgtRole = assoc.roleTwo ?? assoc.end2?.roleName ?? ''

        // Keep source/target aligned with classOne/classTwo so each label stays on its original end.
        const leftComp = asBoolean(assoc.isLeftComposition, false)
        const rightComp = asBoolean(assoc.isRightComposition, false)
        const leftNav = asBoolean(assoc.isLeftNavigable, true)
        const rightNav = asBoolean(assoc.isRightNavigable, true)

        let edgeType: AssociationEdgeData['type'] = 'association'
        if (leftComp || rightComp) {
          edgeType = 'composition'
        } else if (!leftNav && rightNav) {
          edgeType = 'unidirectional'
        } else if (leftNav && !rightNav) {
          edgeType = 'unidirectional-reverse'
        }

        const isSelfLoop = source === target

        return {
          id: `assoc-${i}`,
          source,
          target,
          // Self-loops use right-side handles to avoid overlapping with sibling nodes
          ...(isSelfLoop ? { sourceHandle: 'right-source', targetHandle: 'right-target' } : {}),
          type: 'association',
          data: {
            sourceMultiplicity: srcMult,
            targetMultiplicity: tgtMult,
            sourceRole: srcRole,
            targetRole: tgtRole,
            sourceDecoration: leftComp
              ? 'diamond-filled'
              : (!rightNav && leftNav ? 'arrow' : 'none'),
            targetDecoration: rightComp
              ? 'diamond-filled'
              : (!leftNav && rightNav ? 'arrow' : 'none'),
            type: edgeType,
          } satisfies AssociationEdgeData,
        }
      })

    // Create edges from generalization (extends)
    const genEdges: Edge[] = classes
      .filter((cls) => cls.extendsClass)
      .map((cls): Edge => ({
        id: `gen-${cls.name}`,
        source: `class-${cls.name}`,
        target: `class-${cls.extendsClass}`,
        type: 'association',
        data: {
          sourceMultiplicity: '',
          targetMultiplicity: '',
          sourceRole: '',
          targetRole: '',
          sourceDecoration: 'none',
          targetDecoration: 'triangle',
          type: 'generalization',
        } satisfies AssociationEdgeData,
      }))

    // Create edges from interface implementations
    const implEdges: Edge[] = classes
      .filter((cls) => cls.implementedInterfaces?.length)
      .flatMap((cls) =>
        cls.implementedInterfaces!.map((iface): Edge => ({
          id: `impl-${cls.name}-${iface}`,
          source: `class-${cls.name}`,
          target: `class-${iface}`,
          type: 'association',
          data: {
            sourceMultiplicity: '',
            targetMultiplicity: '',
            sourceRole: '',
            targetRole: '',
            sourceDecoration: 'none',
            targetDecoration: 'triangle',
            type: 'generalization',
          } satisfies AssociationEdgeData,
        }))
      )

    setNodes([...classNodes, ...ifaceNodes])
    setEdges([...assocEdges, ...genEdges, ...implEdges])
  }, [setNodes, setEdges])

  const updateStateDiagramFromModel = useCallback((model: UmpleModel) => {
    const stateMachines: UmpleStateMachine[] = (model as Record<string, unknown>).umpleStateMachines as UmpleStateMachine[] || []

    const allStateNodes: Node[] = []
    const allTransitionEdges: Edge[] = []
    let nodeIndex = 0
    let edgeIndex = 0

    for (const sm of stateMachines) {
      const states = sm.states || []

      // Flatten nested states for node creation
      const flattenStates = (
        stateList: UmpleState[],
        parentPrefix: string,
        depth: number
      ): { state: UmpleState; id: string; depth: number }[] => {
        const result: { state: UmpleState; id: string; depth: number }[] = []
        for (const s of stateList) {
          const id = parentPrefix ? `${parentPrefix}.${s.name}` : `${sm.name}.${s.name}`
          result.push({ state: s, id, depth })
          if (s.nestedStates?.length) {
            result.push(...flattenStates(s.nestedStates, id, depth + 1))
          }
        }
        return result
      }

      const flatStates = flattenStates(states, '', 0)

      // Create nodes
      for (const { state, id, depth } of flatStates) {
        const col = nodeIndex % STATE_GRID_COLS
        const row = Math.floor(nodeIndex / STATE_GRID_COLS)
        const isInitial = nodeIndex === 0 || (depth === 0 && flatStates.indexOf(flatStates.find((fs) => fs.id === id)!) === 0)

        allStateNodes.push({
          id: `state-${id}`,
          type: 'stateNode',
          position: {
            x: col * STATE_X_GAP + 50 + depth * 30,
            y: row * STATE_Y_GAP + 50,
          },
          data: {
            name: state.name,
            isInitial: isInitial && depth === 0 && nodeIndex < states.length,
            isFinal: state.name === 'Final' || state.name === 'final',
            entryActions: state.entryActions || [],
            exitActions: state.exitActions || [],
            nestedStates: (state.nestedStates || []).map((ns) => ns.name),
            isCollapsed: depth > 0,
          } satisfies StateNodeData,
        })
        nodeIndex++
      }

      // Create transition edges
      for (const { state, id } of flatStates) {
        const transitions = state.transitions || []
        for (const t of transitions) {
          // Find the target state id
          const targetEntry = flatStates.find((fs) => fs.state.name === t.nextState)
          const targetId = targetEntry ? `state-${targetEntry.id}` : `state-${sm.name}.${t.nextState}`

          allTransitionEdges.push({
            id: `trans-${edgeIndex}`,
            source: `state-${id}`,
            target: targetId,
            type: 'transition',
            data: {
              event: t.event || '',
              guard: t.guard || '',
              action: t.action || '',
            } satisfies TransitionEdgeData,
          })
          edgeIndex++
        }
      }
    }

    setStateNodes(allStateNodes)
    setStateEdges(allTransitionEdges)
  }, [setStateNodes, setStateEdges])

  return { updateFromModel, updateStateDiagramFromModel }
}

import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { UmpleModel, GvLayout } from '../api/types'
import type { ClassNodeData } from '../components/diagram/nodes/ClassNode'
import type { AssociationEdgeData } from '../components/diagram/edges/AssociationEdge'
import type { StateNodeData } from '../components/diagram/nodes/StateNode'
import type { TransitionEdgeData } from '../components/diagram/edges/TransitionEdge'
import { useDiagramStore } from '../stores/diagramStore'
import type { Position, UmpleAttribute } from '../api/types'

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 120

const GRID_COLS = 3
const GRID_X_GAP = 250
const GRID_Y_GAP = 200

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
): DiagramNodeMetrics {
  // Match GV output: just the class name + attributes, no prefixes or methods
  const lines = [
    name,
    ...attributes.map((attr) => (attr.type ? `${attr.name}: ${attr.type}` : attr.name)),
  ]

  const widestLine = lines.reduce((max, line) => Math.max(max, estimateTextWidth(line)), 0)

  return {
    width: clamp(Math.round(widestLine + 40), DEFAULT_WIDTH, 420),
    height: clamp(
      38 + (attributes.length > 0 ? attributes.length * 18 : 0),
      50,
      420,
    ),
  }
}

function buildGvPositions(
  layout: GvLayout,
  entries: LayoutEntry[],
) {
  const positions = new Map<string, { x: number; y: number }>()
  const nodeMap = new Map(layout.nodes.map((n) => [n.name, n]))

  for (const entry of entries) {
    const gvNode = nodeMap.get(entry.name)
    if (gvNode) {
      // GV positions are center-based (already in pixels, Y-flipped by backend).
      // Convert to top-left using estimated node metrics.
      positions.set(entry.name, {
        x: gvNode.x - entry.metrics.width / 2,
        y: gvNode.y - entry.metrics.height / 2,
      })
    }
  }

  return positions
}

function buildGridPositions(entries: LayoutEntry[]) {
  const positions = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < entries.length; i++) {
    positions.set(entries[i].name, {
      x: (i % GRID_COLS) * GRID_X_GAP + 50,
      y: Math.floor(i / GRID_COLS) * GRID_Y_GAP + 50,
    })
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

  const updateFromModel = useCallback((model: UmpleModel, gvLayout?: GvLayout) => {
    const classes = model.umpleClasses || []
    const associations = model.umpleAssociations || []
    const interfaces = model.umpleInterfaces || []

    const layoutEntries: LayoutEntry[] = [
      ...classes
        .map((cls) => ({
          name: cls.name,
          metrics: resolveNodeMetrics(
            cls.position,
            estimateClassMetrics(cls.name, cls.attributes),
          ),
        })),
      ...interfaces
        .map((iface) => ({
          name: iface.name,
          metrics: resolveNodeMetrics(
            iface.position,
            estimateClassMetrics(iface.name),
          ),
        })),
    ]

    const defaultPositions = gvLayout
      ? buildGvPositions(gvLayout, layoutEntries)
      : buildGridPositions(layoutEntries)

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

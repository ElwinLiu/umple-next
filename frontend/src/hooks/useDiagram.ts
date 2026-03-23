import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { UmpleModel, GvLayout, UmpleStateMachine, UmpleState } from '../api/types'
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

function estimateStateMetrics(state: UmpleState): DiagramNodeMetrics {
  const actionCount = (state.entryActions?.length ?? 0) + (state.exitActions?.length ?? 0)
  const nestedCount = state.nestedStates?.length ?? 0
  const allLines = [
    state.name,
    ...(state.entryActions ?? []).map((a) => `entry/ ${a}`),
    ...(state.exitActions ?? []).map((a) => `exit/ ${a}`),
    ...(state.nestedStates ?? []).map((ns) => ns.name),
  ]
  const widestLine = allLines.reduce((max, line) => Math.max(max, estimateTextWidth(line)), 0)

  return {
    width: clamp(Math.round(widestLine + 40), 140, 420),
    height: clamp(
      32 + (actionCount > 0 ? actionCount * 16 + 8 : 0) + (nestedCount > 0 ? nestedCount * 16 + 8 : 0),
      40,
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
            assocId: assoc.id ?? '',
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

  const updateStateDiagramFromGv = useCallback((
    stateMachines: UmpleStateMachine[],
    gvLayout?: GvLayout,
  ) => {
    if (!stateMachines?.length) {
      setStateNodes([])
      setStateEdges([])
      return
    }

    const allStateNodes: Node[] = []
    const allTransitionEdges: Edge[] = []
    let nodeIndex = 0
    let edgeIndex = 0

    // Build layout entries with estimated metrics (like class diagram approach)
    type FlatState = { state: UmpleState; id: string; gvNodeName: string; depth: number }
    const allFlatStates: FlatState[] = []

    for (const sm of stateMachines) {
      const states = sm.states || []
      const className = sm.className || sm.name.split('.')[0]
      const smName = sm.name.includes('.') ? sm.name.split('.').slice(1).join('.') : sm.name

      const flattenStates = (
        stateList: UmpleState[],
        parentPrefix: string,
        depth: number,
      ): FlatState[] => {
        const result: FlatState[] = []
        for (const s of stateList) {
          const id = parentPrefix ? `${parentPrefix}.${s.name}` : `${sm.name}.${s.name}`
          const gvNodeName = `${className}_${smName}_${s.name}`
          result.push({ state: s, id, gvNodeName, depth })
          if (s.nestedStates?.length) {
            result.push(...flattenStates(s.nestedStates, id, depth + 1))
          }
        }
        return result
      }

      allFlatStates.push(...flattenStates(states, '', 0))
    }

    // Use estimated metrics + buildGvPositions for proper centering (matching class diagram approach)
    const layoutEntries: LayoutEntry[] = allFlatStates.map((fs) => ({
      name: fs.gvNodeName,
      metrics: estimateStateMetrics(fs.state),
    }))

    const positions = gvLayout
      ? buildGvPositions(gvLayout, layoutEntries)
      : null

    // Build a position lookup by ReactFlow node ID for edge handle selection
    const nodePositions = new Map<string, { x: number; y: number }>()

    // Create nodes
    for (const { state, id, gvNodeName, depth } of allFlatStates) {
      const gvPos = positions?.get(gvNodeName)
      const position = gvPos ?? {
        x: (nodeIndex % STATE_GRID_COLS) * STATE_X_GAP + 50 + depth * 30,
        y: Math.floor(nodeIndex / STATE_GRID_COLS) * STATE_Y_GAP + 50,
      }

      const nodeId = `state-${id}`
      nodePositions.set(nodeId, position)

      allStateNodes.push({
        id: nodeId,
        type: 'stateNode',
        position,
        data: {
          name: state.name,
          isInitial: state.isInitial ?? false,
          isFinal: state.name === 'Final' || state.name === 'final',
          entryActions: state.entryActions || [],
          exitActions: state.exitActions || [],
          nestedStates: (state.nestedStates || []).map((ns) => ns.name),
          isCollapsed: depth > 0,
        } satisfies StateNodeData,
      })
      nodeIndex++
    }

    // Create transition edges with handle selection based on relative positions
    for (const sm of stateMachines) {
      const smFlatStates = allFlatStates.filter((fs) =>
        fs.id.startsWith(sm.name + '.'),
      )

      for (const { state, id } of smFlatStates) {
        const transitions = state.transitions || []
        for (const t of transitions) {
          const targetEntry = smFlatStates.find((fs) => fs.state.name === t.nextState)
          const targetId = targetEntry ? `state-${targetEntry.id}` : `state-${sm.name}.${t.nextState}`
          const sourceId = `state-${id}`

          const isSelfLoop = sourceId === targetId
          const sourcePos = nodePositions.get(sourceId)
          const targetPos = nodePositions.get(targetId)

          // Select handles based on relative Y position (TB layout)
          let sourceHandle: string | undefined
          let targetHandle: string | undefined

          if (isSelfLoop) {
            sourceHandle = 'right-source'
            targetHandle = 'right-target'
          } else if (sourcePos && targetPos) {
            if (sourcePos.y < targetPos.y) {
              // Forward edge (source above target): default handles (source=Bottom, target=Top)
              // Default handles have no id, so leave undefined
            } else {
              // Back-edge (source below target): use reverse handles
              sourceHandle = 'top-source'
              targetHandle = 'bottom-target'
            }
          }

          allTransitionEdges.push({
            id: `trans-${edgeIndex}`,
            source: sourceId,
            target: targetId,
            ...(sourceHandle ? { sourceHandle } : {}),
            ...(targetHandle ? { targetHandle } : {}),
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

  return { updateFromModel, updateStateDiagramFromGv }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useReactFlow,
  useNodesInitialized,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import { EMPTY_DIAGRAM_ELEMENTS, useSessionStore } from '../../stores/sessionStore'
import { ClassNode } from './nodes/ClassNode'
import { AssociationEdge } from './edges/AssociationEdge'
import { DiagramControls } from './DiagramControls'
import { DiagramContextMenu } from './menus/DiagramContextMenu'
import { NodeContextMenu } from './menus/NodeContextMenu'
import { EdgeContextMenu } from './menus/EdgeContextMenu'
import { ConnectionTypeMenu, type ConnectionChoice } from './menus/ConnectionTypeMenu'
import { useDiagramSync } from '../../hooks/useDiagramSync'
import { extractClassName, edgeDeletionParams } from '../../lib/diagramHelpers'

const nodeTypes = { classNode: ClassNode }
const edgeTypes = { association: AssociationEdge }

function handleDeleteKey(e: KeyboardEvent, sync: (action: string, params: Record<string, string>) => Promise<unknown>): boolean {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return false

  const { selectedNodeId, selectedEdgeId } = useEphemeralStore.getState()
  const { diagramData, removeNode, removeEdge } = useSessionStore.getState()
  const currentEdges = diagramData.class?.edges ?? []

  if (selectedNodeId) {
    e.preventDefault()
    const className = extractClassName(selectedNodeId)
    removeNode(selectedNodeId)
    sync('removeClass', { className })
    return true
  }
  if (selectedEdgeId) {
    e.preventDefault()
    const edge = currentEdges.find((ed) => ed.id === selectedEdgeId)
    if (edge) {
      const { action, params } = edgeDeletionParams(edge)
      removeEdge(selectedEdgeId)
      sync(action, params)
    }
    return true
  }
  return false
}

function handleRenameKey(e: KeyboardEvent): boolean {
  if (e.key !== 'F2') return false
  const { selectedNodeId, setEditing } = useEphemeralStore.getState()
  if (!selectedNodeId) return false
  e.preventDefault()
  setEditing(selectedNodeId, 'name')
  return true
}

function handleEscapeKey(e: KeyboardEvent, closeAllMenus: () => void): boolean {
  if (e.key !== 'Escape') return false
  const { editingNodeId, setEditing, setSelectedNode, setSelectedEdge } = useEphemeralStore.getState()
  if (editingNodeId) {
    setEditing(null, null)
  } else {
    setSelectedNode(null)
    setSelectedEdge(null)
  }
  closeAllMenus()
  return true
}

function handleUndoRedo(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.key !== 'z') return false
  e.preventDefault()
  if (e.shiftKey) {
    useSessionStore.getState().redo()
  } else {
    useSessionStore.getState().undo()
  }
  return true
}

/** Fits the viewport to all nodes whenever the node set changes */
function AutoFitView({ view }: { view: 'class' | 'structure' }) {
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const nodes = useSessionStore((s) => s.diagramData[view]?.nodes ?? EMPTY_DIAGRAM_ELEMENTS.nodes)
  const nodeKey = nodes.map((n) => n.id).join(',')
  const prevKeyRef = useRef('')

  useEffect(() => {
    if (!nodesInitialized) return
    if (prevKeyRef.current === nodeKey) return
    prevKeyRef.current = nodeKey
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 0, maxZoom: 1 })
    })
  }, [nodesInitialized, nodeKey, fitView])

  return null
}

// Context menu state types
interface MenuState<T = undefined> {
  position: { x: number; y: number } | null
  data: T
}

export function ClassDiagram({ view = 'class' }: { view?: 'class' | 'structure' }) {
  return (
    <ReactFlowProvider>
      <ClassDiagramInner view={view} />
    </ReactFlowProvider>
  )
}

function ClassDiagramInner({ view }: { view: 'class' | 'structure' }) {
  const isEditable = view === 'class'
  const { nodes, edges } = useSessionStore((s) => s.diagramData[view] ?? EMPTY_DIAGRAM_ELEMENTS)
  const setDiagramData = useSessionStore((s) => s.setDiagramData)
  const setSelectedNode = useEphemeralStore((s) => s.setSelectedNode)
  const setSelectedEdge = useEphemeralStore((s) => s.setSelectedEdge)
  const updateNodePosition = useSessionStore((s) => s.updateNodePosition)
  const modelId = useSessionStore((s) => s.modelId)
  const theme = usePreferencesStore((s) => s.theme)
  const rfColorMode = theme === 'system' ? 'system' : theme
  const { sync } = useDiagramSync()
  const { screenToFlowPosition } = useReactFlow()

  // Context menu states
  const [paneMenu, setPaneMenu] = useState<MenuState & { flowPosition: { x: number; y: number } | null }>({
    position: null, data: undefined, flowPosition: null,
  })
  const [nodeMenu, setNodeMenu] = useState<MenuState<string>>({ position: null, data: '' })
  const [edgeMenu, setEdgeMenu] = useState<MenuState<string>>({ position: null, data: '' })
  const [connectionMenu, setConnectionMenu] = useState<MenuState<Connection | null>>({ position: null, data: null })

  const closeAllMenus = useCallback(() => {
    setPaneMenu({ position: null, data: undefined, flowPosition: null })
    setNodeMenu({ position: null, data: '' })
    setEdgeMenu({ position: null, data: '' })
    setConnectionMenu({ position: null, data: null })
  }, [])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setDiagramData(view, applyNodeChanges(changes, nodes), edges)
      for (const c of changes) {
        if (c.type === 'select' && c.selected) {
          setSelectedNode(c.id)
          setSelectedEdge(null)
        }
      }
    },
    [view, nodes, edges, setDiagramData, setSelectedNode, setSelectedEdge]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setDiagramData(view, nodes, applyEdgeChanges(changes, edges))
      for (const c of changes) {
        if (c.type === 'select' && c.selected) {
          setSelectedEdge(c.id)
          setSelectedNode(null)
        }
      }
    },
    [view, nodes, edges, setDiagramData, setSelectedEdge, setSelectedNode]
  )

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      if (!isEditable) return
      updateNodePosition(node.id, node.position.x, node.position.y)
      const className = extractClassName(node.id)

      await sync('editPosition', {
        className,
        x: String(Math.round(node.position.x)),
        y: String(Math.round(node.position.y)),
      })
    },
    [isEditable, updateNodePosition, sync]
  )

  // Context menu handlers
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      if (!isEditable) return
      event.preventDefault()
      closeAllMenus()
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setPaneMenu({
        position: { x: event.clientX, y: event.clientY },
        data: undefined,
        flowPosition: flowPos,
      })
    },
    [isEditable, closeAllMenus, screenToFlowPosition]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!isEditable) return
      event.preventDefault()
      closeAllMenus()
      setNodeMenu({ position: { x: event.clientX, y: event.clientY }, data: node.id })
    },
    [isEditable, closeAllMenus]
  )

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!isEditable) return
      event.preventDefault()
      closeAllMenus()
      setEdgeMenu({ position: { x: event.clientX, y: event.clientY }, data: edge.id })
    },
    [isEditable, closeAllMenus]
  )

  // Connection drawing
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!isEditable) return
      if (!connection.source || !connection.target) return
      setConnectionMenu({
        position: lastMouseRef.current,
        data: connection,
      })
    },
    [isEditable]
  )

  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const handleMouseMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleConnectionChoice = useCallback(
    async (type: ConnectionChoice) => {
      const conn = connectionMenu.data
      if (!conn) return
      const sourceClass = extractClassName(conn.source!)
      const targetClass = extractClassName(conn.target!)

      setConnectionMenu({ position: null, data: null })

      if (type === 'generalization') {
        await sync('addGeneralization', {
          childClass: sourceClass,
          parentClass: targetClass,
        })
      } else {
        await sync('addAssociation', {
          classOneId: sourceClass,
          classTwoId: targetClass,
        })
      }
    },
    [connectionMenu.data, sync]
  )

  // Keyboard handlers
  useEffect(() => {
    if (!isEditable) return

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (handleDeleteKey(e, sync)) return
      if (handleRenameKey(e)) return
      if (handleEscapeKey(e, closeAllMenus)) return
      if (handleUndoRedo(e)) return
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditable, sync, closeAllMenus])

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => { setSelectedNode(node.id); setSelectedEdge(null) }}
        onEdgeClick={(_, edge) => { setSelectedEdge(edge.id); setSelectedNode(null) }}
        onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); closeAllMenus() }}
        onPaneContextMenu={isEditable ? onPaneContextMenu : undefined}
        onNodeContextMenu={isEditable ? onNodeContextMenu : undefined}
        onEdgeContextMenu={isEditable ? onEdgeContextMenu : undefined}
        onConnect={isEditable ? onConnect : undefined}
        onMouseMove={handleMouseMove}
        colorMode={rfColorMode}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'association' }}
        deleteKeyCode={null}
        nodesDraggable={isEditable}
        nodesConnectable={isEditable}
      >
        <Background />
        <DiagramControls allowClassEditing={isEditable} />
        <AutoFitView view={view} />

        {/* SVG marker definitions for edge types */}
        <svg className="absolute w-0 h-0">
          <defs>
            <marker id="triangle" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="none" stroke="var(--color-border-strong)" strokeWidth="1" />
            </marker>
            <marker id="diamond-filled" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
              <path d="M 0 6 L 6 0 L 12 6 L 6 12 z" fill="var(--color-border-strong)" stroke="var(--color-border-strong)" strokeWidth="1" />
            </marker>
            <marker id="diamond" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
              <path d="M 0 6 L 6 0 L 12 6 L 6 12 z" fill="var(--color-surface-0)" stroke="var(--color-border-strong)" strokeWidth="1" />
            </marker>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5" strokeLinejoin="round" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>

      {/* Context menus rendered as portals outside ReactFlow */}
      {isEditable && (
        <>
          <DiagramContextMenu
            position={paneMenu.position}
            flowPosition={paneMenu.flowPosition}
            onClose={() => setPaneMenu({ position: null, data: undefined, flowPosition: null })}
          />
          <NodeContextMenu
            position={nodeMenu.position}
            nodeId={nodeMenu.data}
            onClose={() => setNodeMenu({ position: null, data: '' })}
          />
          <EdgeContextMenu
            position={edgeMenu.position}
            edgeId={edgeMenu.data}
            onClose={() => setEdgeMenu({ position: null, data: '' })}
          />
          <ConnectionTypeMenu
            position={connectionMenu.position}
            onSelect={handleConnectionChoice}
            onClose={() => setConnectionMenu({ position: null, data: null })}
          />
        </>
      )}
    </>
  )
}

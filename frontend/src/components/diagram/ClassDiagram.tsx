import { useCallback, useEffect, useRef, useState } from 'react'
import { useUiStore } from '../../stores/uiStore'
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
import { useDiagramStore } from '../../stores/diagramStore'
import { useEditorStore } from '../../stores/editorStore'
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

/** Fits the viewport to all nodes whenever the node set changes */
function AutoFitView() {
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const nodes = useDiagramStore((s) => s.nodes)
  const nodeKey = nodes.map((n) => n.id).join(',')
  const prevKeyRef = useRef(nodeKey)

  useEffect(() => {
    if (!nodesInitialized) return
    if (prevKeyRef.current === nodeKey) return
    prevKeyRef.current = nodeKey
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 200, maxZoom: 1 })
    })
  }, [nodesInitialized, nodeKey, fitView])

  return null
}

// Context menu state types
interface MenuState<T = undefined> {
  position: { x: number; y: number } | null
  data: T
}

export function ClassDiagram() {
  return (
    <ReactFlowProvider>
      <ClassDiagramInner />
    </ReactFlowProvider>
  )
}

function ClassDiagramInner() {
  const { nodes, edges, setNodes, setEdges, setSelectedNode, setSelectedEdge, updateNodePosition } = useDiagramStore()
  const modelId = useEditorStore((s) => s.modelId)
  const theme = useUiStore((s) => s.theme)
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
      setNodes(applyNodeChanges(changes, nodes))
      for (const c of changes) {
        if (c.type === 'select' && c.selected) {
          setSelectedNode(c.id)
          setSelectedEdge(null)
        }
      }
    },
    [nodes, setNodes, setSelectedNode, setSelectedEdge]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges))
      for (const c of changes) {
        if (c.type === 'select' && c.selected) {
          setSelectedEdge(c.id)
          setSelectedNode(null)
        }
      }
    },
    [edges, setEdges, setSelectedEdge, setSelectedNode]
  )

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      updateNodePosition(node.id, node.position.x, node.position.y)
      const className = extractClassName(node.id)

      await sync('editPosition', {
        className,
        x: String(Math.round(node.position.x)),
        y: String(Math.round(node.position.y)),
      })
    },
    [updateNodePosition, sync]
  )

  // Context menu handlers
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      closeAllMenus()
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setPaneMenu({
        position: { x: event.clientX, y: event.clientY },
        data: undefined,
        flowPosition: flowPos,
      })
    },
    [closeAllMenus, screenToFlowPosition]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      closeAllMenus()
      setNodeMenu({ position: { x: event.clientX, y: event.clientY }, data: node.id })
    },
    [closeAllMenus]
  )

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      closeAllMenus()
      setEdgeMenu({ position: { x: event.clientX, y: event.clientY }, data: edge.id })
    },
    [closeAllMenus]
  )

  // Connection drawing
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      setConnectionMenu({
        position: lastMouseRef.current,
        data: connection,
      })
    },
    []
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
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const { selectedNodeId, selectedEdgeId, edges: currentEdges, removeNode, removeEdge, setEditing } = useDiagramStore.getState()

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault()
          const className = extractClassName(selectedNodeId)
          removeNode(selectedNodeId)
          sync('removeClass', { className })
        } else if (selectedEdgeId) {
          e.preventDefault()
          const edge = currentEdges.find((ed) => ed.id === selectedEdgeId)
          if (edge) {
            const { action, params } = edgeDeletionParams(edge)
            removeEdge(selectedEdgeId)
            sync(action, params)
          }
        }
        return
      }

      if (e.key === 'F2' && selectedNodeId) {
        e.preventDefault()
        setEditing(selectedNodeId, 'name')
        return
      }

      if (e.key === 'Escape') {
        const { editingNodeId } = useDiagramStore.getState()
        if (editingNodeId) {
          setEditing(null, null)
        } else {
          useDiagramStore.getState().setSelectedNode(null)
          useDiagramStore.getState().setSelectedEdge(null)
        }
        closeAllMenus()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          useEditorStore.getState().redo()
        } else {
          e.preventDefault()
          useEditorStore.getState().undo()
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sync, closeAllMenus])

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
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onConnect={onConnect}
        onMouseMove={handleMouseMove}
        colorMode={rfColorMode}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'association' }}
        deleteKeyCode={null}
      >
        <Background />
        <DiagramControls />
        <AutoFitView />

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
  )
}

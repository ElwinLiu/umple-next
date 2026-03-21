import { useCallback, useEffect, useRef } from 'react'
import { useUiStore } from '../../stores/uiStore'
import {
  ReactFlow,
  Background,
  useReactFlow,
  useNodesInitialized,
  type OnNodesChange,
  type OnEdgesChange,
  type Node,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import { useDiagramStore } from '../../stores/diagramStore'
import { useEditorStore } from '../../stores/editorStore'
import { ClassNode } from './nodes/ClassNode'
import { AssociationEdge } from './edges/AssociationEdge'
import { DiagramControls } from './DiagramControls'
import { api } from '../../api/client'

const nodeTypes = { classNode: ClassNode }
const edgeTypes = { association: AssociationEdge }

/** Fits the viewport to all nodes whenever the node set changes */
function AutoFitView() {
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const nodes = useDiagramStore((s) => s.nodes)
  // Track the node IDs to detect when the model changes (not just drags)
  const nodeKey = nodes.map((n) => n.id).join(',')
  const prevKeyRef = useRef(nodeKey)

  useEffect(() => {
    if (!nodesInitialized) return
    // Only fit when the set of nodes changes, not on every position update
    if (prevKeyRef.current === nodeKey) return
    prevKeyRef.current = nodeKey
    // Small delay lets ReactFlow finish measuring
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 200, maxZoom: 1 })
    })
  }, [nodesInitialized, nodeKey, fitView])

  return null
}

export function ClassDiagram() {
  const { nodes, edges, setNodes, setEdges, setSelectedNode, updateNodePosition } = useDiagramStore()
  const modelId = useEditorStore((s) => s.modelId)
  const theme = useUiStore((s) => s.theme)
  const rfColorMode = theme === 'system' ? 'system' : theme

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(applyNodeChanges(changes, nodes))
    },
    [nodes, setNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges))
    },
    [edges, setEdges]
  )

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      // Update local store immediately
      updateNodePosition(node.id, node.position.x, node.position.y)

      // Extract the class name from the node id (format: "class-ClassName")
      const className = node.id.replace(/^class-/, '')

      try {
        // Sync position back to the backend
        const response = await api.sync({
          action: 'editPosition',
          modelId: modelId ?? '',
          params: {
            className,
            x: String(Math.round(node.position.x)),
            y: String(Math.round(node.position.y)),
          },
        })

        // If the backend returns updated code, dispatch a custom event
        // so the editor can pick it up
        if (response.code) {
          window.dispatchEvent(
            new CustomEvent('garnet-code-sync', { detail: { code: response.code } })
          )
        }
      } catch (err) {
        // Position sync is best-effort; don't disrupt the user
        console.warn('Failed to sync position:', err)
      }
    },
    [updateNodePosition, modelId]
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={(_, node) => setSelectedNode(node.id)}
      onPaneClick={() => setSelectedNode(null)}
      colorMode={rfColorMode}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.2}
      maxZoom={2}
      defaultEdgeOptions={{ type: 'association' }}
    >
      <Background />
      <DiagramControls />
      <AutoFitView />

      {/* SVG marker definitions for edge types */}
      <svg className="absolute w-0 h-0">
        <defs>
          {/* Generalization: hollow triangle */}
          <marker id="triangle" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="none" stroke="var(--color-border-strong)" strokeWidth="1" />
          </marker>
          {/* Composition: filled diamond */}
          <marker id="diamond-filled" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
            <path d="M 0 6 L 6 0 L 12 6 L 6 12 z" fill="var(--color-border-strong)" stroke="var(--color-border-strong)" strokeWidth="1" />
          </marker>
          {/* Aggregation: hollow diamond */}
          <marker id="diamond" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
            <path d="M 0 6 L 6 0 L 12 6 L 6 12 z" fill="var(--color-surface-0)" stroke="var(--color-border-strong)" strokeWidth="1" />
          </marker>
          {/* Unidirectional: open arrowhead */}
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5" strokeLinejoin="round" />
          </marker>
        </defs>
      </svg>
    </ReactFlow>
  )
}

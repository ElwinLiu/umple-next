import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import { useDiagramStore } from '../../stores/diagramStore'
import { useUiStore } from '../../stores/uiStore'
import { StateNode } from './nodes/StateNode'
import { TransitionEdge } from './edges/TransitionEdge'
import { DiagramControls } from './DiagramControls'

const nodeTypes = { stateNode: StateNode }
const edgeTypes = { transition: TransitionEdge }

export function StateDiagram() {
  const { stateNodes, stateEdges, setStateNodes, setStateEdges, setSelectedNode } = useDiagramStore()
  const theme = useUiStore((s) => s.theme)
  const rfColorMode = theme === 'system' ? 'system' : theme

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setStateNodes(applyNodeChanges(changes, stateNodes))
    },
    [stateNodes, setStateNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setStateEdges(applyEdgeChanges(changes, stateEdges))
    },
    [stateEdges, setStateEdges]
  )

  return (
    <ReactFlow
      nodes={stateNodes}
      edges={stateEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => setSelectedNode(node.id)}
      onPaneClick={() => setSelectedNode(null)}
      colorMode={rfColorMode}
      fitView
      minZoom={0.2}
      maxZoom={2}
      defaultEdgeOptions={{ type: 'transition' }}
    >
      <Background />
      <DiagramControls />

      {/* SVG marker for transition arrows */}
      <svg className="absolute w-0 h-0">
        <defs>
          <marker
            id="state-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-border-strong)" />
          </marker>
        </defs>
      </svg>
    </ReactFlow>
  )
}

import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
} from '@xyflow/react'
import { useDiagramStore } from '../../stores/diagramStore'
import { useUiStore } from '../../stores/uiStore'
import { DiagramControls } from './DiagramControls'
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

/* -- Feature Node -- */

interface FeatureNodeData {
  name: string
  isMandatory: boolean
  isOr: boolean
  isXor: boolean
  [key: string]: unknown
}

const FeatureNode = memo(function FeatureNode({ data }: NodeProps) {
  const d = data as FeatureNodeData

  const indicator = d.isMandatory ? '\u25CF' : '\u25CB'
  const nodeClasses = d.isMandatory
    ? 'bg-node-class-bg border-border-strong'
    : 'bg-surface-0 border-border'

  return (
    <div
      className={`rounded-md min-w-[120px] text-xs font-mono shadow-sm text-center border-2 ${nodeClasses}`}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />

      <div className="px-3 py-1.5 font-semibold text-ink flex items-center justify-center gap-1.5">
        <span className={`text-[8px] ${d.isMandatory ? 'text-node-class-fg' : 'text-ink-faint'}`}>
          {indicator}
        </span>
        {d.name}
        {d.isOr && (
          <span className="text-[9px] text-status-warning font-normal">(OR)</span>
        )}
        {d.isXor && (
          <span className="text-[9px] text-brand font-normal">(XOR)</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  )
})

/* -- Feature Diagram -- */

const nodeTypes = { featureNode: FeatureNode }

export function FeatureDiagram() {
  const { featureNodes, featureEdges, setFeatureNodes, setFeatureEdges, setSelectedNode } = useDiagramStore()
  const theme = useUiStore((s) => s.theme)
  const rfColorMode = theme === 'system' ? 'system' : theme

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setFeatureNodes(applyNodeChanges(changes, featureNodes))
    },
    [featureNodes, setFeatureNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setFeatureEdges(applyEdgeChanges(changes, featureEdges))
    },
    [featureEdges, setFeatureEdges]
  )

  return (
    <ReactFlow
      nodes={featureNodes}
      edges={featureEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => setSelectedNode(node.id)}
      onPaneClick={() => setSelectedNode(null)}
      colorMode={rfColorMode}
      fitView
      minZoom={0.2}
      maxZoom={2}
    >
      <Background />
      <DiagramControls />
    </ReactFlow>
  )
}

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'

export interface ClassNodeData {
  name: string
  attributes: { name: string; type: string }[]
  methods: { name: string; returnType: string; params: string }[]
  isAbstract: boolean
  isInterface: boolean
  [key: string]: unknown
}

export const ClassNode = memo(function ClassNode({ data }: NodeProps) {
  const d = data as ClassNodeData
  const headerClasses = d.isInterface
    ? 'bg-node-interface-bg text-node-interface-fg'
    : d.isAbstract
      ? 'bg-node-abstract-bg text-node-abstract-fg'
      : 'bg-node-class-bg text-node-class-fg'
  const label = d.name

  return (
    <div className="bg-surface-0 border-2 border-border-strong rounded min-w-40 text-xs font-mono shadow-md" data-testid={`class-node-${d.name}`}>
      {/* BT layout: edges go upward, so source exits from top, target enters from bottom */}
      <Handle type="source" position={Position.Top} className="!invisible" />

      {/* Class name header */}
      <div
        className={cn('px-2.5 py-1.5 font-bold text-center border-b border-border-strong', headerClasses, d.isAbstract && 'italic')}
      >
        {label}
      </div>

      {/* Attributes — matches GV output which only shows attributes, not methods */}
      {d.attributes.length > 0 && (
        <div className="px-2.5 py-1">
          {d.attributes.map((attr, i) => (
            <div key={i} className="py-px">
              {attr.type ? `${attr.name}: ${attr.type}` : attr.name}
            </div>
          ))}
        </div>
      )}

      <Handle type="target" position={Position.Bottom} className="!invisible" />
      {/* Right-side handles for self-loop edges */}
      <Handle type="source" position={Position.Right} id="right-source" className="!invisible" style={{ top: '20%' }} />
      <Handle type="target" position={Position.Right} id="right-target" className="!invisible" style={{ top: '80%' }} />
    </div>
  )
})

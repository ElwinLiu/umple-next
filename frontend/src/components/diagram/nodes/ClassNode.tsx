import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useDiagramStore } from '@/stores/diagramStore'

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
  const showAttributes = useDiagramStore((s) => s.showAttributes)
  const showMethods = useDiagramStore((s) => s.showMethods)

  const headerClasses = d.isInterface
    ? 'bg-node-interface-bg text-node-interface-fg'
    : d.isAbstract
      ? 'bg-node-abstract-bg text-node-abstract-fg'
      : 'bg-node-class-bg text-node-class-fg'
  const label = d.name

  const visibleAttrs = showAttributes ? d.attributes : []
  const visibleMethods = showMethods ? d.methods : []
  const hasBody = visibleAttrs.length > 0 || visibleMethods.length > 0

  return (
    <div className="bg-surface-0 border-2 border-border-strong rounded min-w-40 text-xs font-mono shadow-md" data-testid={`class-node-${d.name}`}>
      {/* BT layout: edges go upward, so source exits from top, target enters from bottom */}
      <Handle type="source" position={Position.Top} className="!invisible" />

      {/* Class name header */}
      <div
        className={cn('px-2.5 py-1.5 font-bold text-center', headerClasses, d.isAbstract && 'italic', hasBody && 'border-b border-border-strong')}
      >
        {label}
      </div>

      {/* Attributes */}
      {visibleAttrs.length > 0 && (
        <div className={cn('px-2.5 py-1', visibleMethods.length > 0 && 'border-b border-border-strong')}>
          {visibleAttrs.map((attr, i) => (
            <div key={i} className="py-px">
              {attr.type ? `${attr.name}: ${attr.type}` : attr.name}
            </div>
          ))}
        </div>
      )}

      {/* Methods */}
      {visibleMethods.length > 0 && (
        <div className="px-2.5 py-1">
          {visibleMethods.map((method, i) => (
            <div key={i} className="py-px">
              {method.returnType ? `${method.name}(${method.params}): ${method.returnType}` : `${method.name}(${method.params})`}
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

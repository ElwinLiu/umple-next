import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

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
  const isDark = document.documentElement.classList.contains('dark')
  const headerBg = d.isInterface
    ? (isDark ? '#1b3a20' : '#e8f5e9')
    : d.isAbstract
      ? (isDark ? '#3a2a10' : '#fff3e0')
      : (isDark ? '#152a3e' : '#e3f2fd')
  const headerColor = d.isInterface
    ? (isDark ? '#6fcf76' : '#2e7d32')
    : d.isAbstract
      ? (isDark ? '#f0a050' : '#e65100')
      : (isDark ? '#6cb6ff' : '#1565c0')
  const label = d.isInterface ? `<<interface>> ${d.name}` : d.isAbstract ? `<<abstract>> ${d.name}` : d.name

  return (
    <div className="bg-surface-0 border-2 border-border-strong rounded min-w-40 text-xs font-mono shadow-md" data-testid={`class-node-${d.name}`}>
      <Handle type="target" position={Position.Top} className="!invisible" />

      {/* Class name header */}
      <div
        className="px-2.5 py-1.5 font-bold text-center border-b border-border-strong"
        style={{
          background: headerBg,
          color: headerColor,
          fontStyle: d.isAbstract ? 'italic' : 'normal',
        }}
      >
        {label}
      </div>

      {/* Attributes */}
      <div
        className="px-2.5 py-1 min-h-5"
        style={{
          borderBottom: d.methods.length > 0 ? '1px solid var(--color-border)' : 'none',
        }}
      >
        {d.attributes.length === 0 && (
          <div className="text-ink-faint italic">&nbsp;</div>
        )}
        {d.attributes.map((attr, i) => (
          <div key={i} className="py-px">
            {attr.type ? `${attr.name}: ${attr.type}` : attr.name}
          </div>
        ))}
      </div>

      {/* Methods */}
      {d.methods.length > 0 && (
        <div className="px-2.5 py-1 min-h-5">
          {d.methods.map((m, i) => (
            <div key={i} className="py-px">
              {m.name}({m.params}): {m.returnType}
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!invisible" />
      {/* Right-side handles for self-loop edges */}
      <Handle type="source" position={Position.Right} id="right-source" className="!invisible" style={{ top: '20%' }} />
      <Handle type="target" position={Position.Right} id="right-target" className="!invisible" style={{ top: '80%' }} />
    </div>
  )
})

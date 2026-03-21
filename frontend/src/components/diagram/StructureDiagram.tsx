import { useDiagramStore } from '../../stores/diagramStore'

export function StructureDiagram() {
  const { structureText } = useDiagramStore()

  if (!structureText) {
    return (
      <div className="p-6 text-ink-faint text-[13px] font-mono">
        No structure diagram available. Compile a model to generate one.
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 bg-surface-1">
      <pre className="font-mono text-xs leading-relaxed text-ink m-0 p-4 bg-surface-0 border border-border rounded-md whitespace-pre-wrap break-words">
        {structureText}
      </pre>
    </div>
  )
}

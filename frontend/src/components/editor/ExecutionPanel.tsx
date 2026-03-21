import { useState, useRef, useEffect } from 'react'
import { api } from '../../api/client'
import { useEditorStore } from '../../stores/editorStore'
import { Play, Loader2 } from 'lucide-react'

export function ExecutionPanel() {
  const code = useEditorStore((s) => s.code)
  const [output, setOutput] = useState('')
  const [errors, setErrors] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  // Auto-scroll output to bottom when new content arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, errors])

  const handleRun = async () => {
    if (running) return

    setRunning(true)
    setOutput('')
    setErrors(null)

    try {
      const result = await api.execute({
        code,
        language: 'Java',
      })
      setOutput(result.output || '')
      if (result.errors) {
        setErrors(result.errors)
      }
    } catch (err: any) {
      setErrors(err.message || 'Execution failed')
    } finally {
      setRunning(false)
    }
  }

  const handleClear = () => {
    setOutput('')
    setErrors(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-1 px-2.5 py-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">Output</span>
          {running && (
            <span className="flex items-center gap-1.5 text-[11px] text-status-warning">
              <Loader2 className="size-3 animate-spin" />
              Running...
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer bg-brand text-ink-inverse hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          >
            <Play className="size-3" />
            Run
          </button>
          <button
            onClick={handleClear}
            className="rounded px-2.5 py-0.5 text-[11px] text-ink-muted border border-border bg-surface-0 transition-colors cursor-pointer hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Output area */}
      <pre
        ref={outputRef}
        className="m-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-2.5 font-mono text-xs leading-relaxed text-ink bg-surface-0"
      >
        {output}
        {errors && (
          <span className="text-status-error">{errors}</span>
        )}
        {!output && !errors && !running && (
          <span className="text-ink-faint">
            Click "Run" to compile and execute your Umple model.
          </span>
        )}
      </pre>
    </div>
  )
}

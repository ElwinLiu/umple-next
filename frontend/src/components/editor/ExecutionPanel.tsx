import { useState, useRef, useEffect } from 'react'
import { api } from '../../api/client'
import { useEditorStore } from '../../stores/editorStore'

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
    <div className="flex h-full flex-col border-t border-gray-200 bg-[#1e1e1e]">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#444] bg-[#2d2d2d] px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">
            Output
          </span>
          {running && (
            <span className="text-[11px] text-yellow-400">
              Running...
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleRun}
            disabled={running}
            className={`flex items-center gap-1 rounded-sm border px-2.5 py-0.5 text-[11px] transition-colors ${
              running
                ? 'cursor-not-allowed border-green-700 bg-[#333] text-gray-500'
                : 'cursor-pointer border-green-600 bg-green-800 text-white hover:bg-green-700'
            }`}
          >
            <span className="text-xs">&#9654;</span> Run
          </button>
          <button
            onClick={handleClear}
            className="cursor-pointer rounded-sm border border-[#555] bg-transparent px-2.5 py-0.5 text-[11px] text-gray-400 transition-colors hover:border-[#777] hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Output area */}
      <pre
        ref={outputRef}
        className="m-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-xs leading-relaxed text-[#d4d4d4]"
      >
        {output}
        {errors && (
          <span className="text-red-400">{errors}</span>
        )}
        {!output && !errors && !running && (
          <span className="text-[#555]">
            Click "Run" to compile and execute your Umple model.
          </span>
        )}
      </pre>
    </div>
  )
}

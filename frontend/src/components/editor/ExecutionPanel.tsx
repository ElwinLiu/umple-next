import { useRef, useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'

/** Collapsed banner — always visible at the bottom of the editor column. */
export function OutputBanner() {
  const toggleExecutionPanel = useUiStore((s) => s.toggleExecutionPanel)

  return (
    <div className="flex h-[38px] items-center justify-between rounded-lg bg-surface-2 px-3">
      <span className="text-xs font-semibold text-ink-muted">Output</span>
      <Tip content="Expand output" side="top">
        <button
          onClick={toggleExecutionPanel}
          className="flex items-center justify-center size-6 rounded-md text-ink-faint hover:text-ink-muted hover:bg-surface-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          aria-label="Expand output"
        >
          <ChevronUp className="size-3.5" />
        </button>
      </Tip>
    </div>
  )
}

/** Expanded output panel — banner + scrollable content area. */
export function ExecutionPanel() {
  const toggleExecutionPanel = useUiStore((s) => s.toggleExecutionPanel)
  const outputRef = useRef<HTMLPreElement>(null)
  const { executionOutput, executionErrors } = useUiStore()

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [executionOutput, executionErrors])

  return (
    <div className="flex h-full flex-col">
      {/* Banner */}
      <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-border bg-surface-2 px-3">
        <span className="text-xs font-semibold text-ink-muted">Output</span>
        <Tip content="Collapse" side="bottom">
          <button
            onClick={toggleExecutionPanel}
            className="flex items-center justify-center size-6 rounded-md text-ink-faint hover:text-ink-muted hover:bg-surface-0/60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
            aria-label="Collapse output"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </Tip>
      </div>

      {/* Output area */}
      <pre
        ref={outputRef}
        className="m-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-2.5 font-mono text-xs leading-relaxed text-ink bg-surface-0"
      >
        {executionOutput}
        {executionErrors && (
          <span className="text-status-error">{executionErrors}</span>
        )}
        {!executionOutput && !executionErrors && (
          <span className="text-ink-faint">
            Run to see output here.
          </span>
        )}
      </pre>
    </div>
  )
}

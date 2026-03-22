import { useRef, useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'

function Badges() {
  const errorCount = useUiStore((s) => s.outputErrorCount)
  const warningCount = useUiStore((s) => s.outputWarningCount)

  if (!errorCount && !warningCount) return null

  return (
    <div className="flex items-center gap-1.5">
      {errorCount > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-status-error/15 px-1.5 py-0.5 text-xxs font-semibold leading-none text-status-error">
          {errorCount} {errorCount === 1 ? 'error' : 'errors'}
        </span>
      )}
      {warningCount > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-status-warning/15 px-1.5 py-0.5 text-xxs font-semibold leading-none text-status-warning">
          {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
        </span>
      )}
    </div>
  )
}

/** Collapsed banner — always visible at the bottom of the editor column. */
export function OutputBanner() {
  const toggleExecutionPanel = useUiStore((s) => s.toggleExecutionPanel)

  return (
    <div className="flex h-[38px] items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-muted">Output</span>
        <Badges />
      </div>
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

/** Expanded output panel — banner + scrollable content area.
 *  Shows compile errors, generation errors, and execution output. */
export function ExecutionPanel() {
  const toggleExecutionPanel = useUiStore((s) => s.toggleExecutionPanel)
  const outputRef = useRef<HTMLPreElement>(null)
  const executionOutput = useUiStore((s) => s.executionOutput)
  const executionErrors = useUiStore((s) => s.executionErrors)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [executionOutput, executionErrors])

  return (
    <div className="flex h-full flex-col">
      {/* Banner */}
      <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">Output</span>
          <Badges />
        </div>
        <Tip content="Collapse" side="bottom">
          <button
            onClick={toggleExecutionPanel}
            className="flex items-center justify-center size-6 rounded-md text-ink-faint hover:text-ink-muted hover:bg-surface-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
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
            Compile or generation messages will appear here.
          </span>
        )}
      </pre>
    </div>
  )
}

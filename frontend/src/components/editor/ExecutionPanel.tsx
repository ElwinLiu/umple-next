import { useRef, useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useAiConfigStore } from '@/stores/aiConfigStore'
import { ChevronDown, ChevronUp, Check, AlertTriangle, X, Sparkles } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'

function useIsAiConfigured() {
  return useAiConfigStore((s) => {
    const cfg = s.configs[s.activeProvider]
    return !!(cfg.apiKey.trim() && cfg.model.trim())
  })
}

function triggerAIFix() {
  const { executionOutput, executionErrors } = useUiStore.getState()
  const errorInfo = [executionOutput, executionErrors].filter(Boolean).join('\n')
  if (!errorInfo) return
  useUiStore.getState().queueAgentMessage(
    `Fix the following compilation issues:\n\n\`\`\`\n${errorInfo}\n\`\`\``,
  )
  useUiStore.getState().openAgentPanel()
}

// ── Shared badge pills ──────────────────────────────────────────────

function BadgePills({ errorCount, warningCount }: { errorCount: number; warningCount: number }) {
  return (
    <>
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
    </>
  )
}

function Badges() {
  const errorCount = useUiStore((s) => s.outputErrorCount)
  const warningCount = useUiStore((s) => s.outputWarningCount)

  if (!errorCount && !warningCount) return null

  return (
    <div className="flex items-center gap-1.5">
      <BadgePills errorCount={errorCount} warningCount={warningCount} />
    </div>
  )
}

// ── OutputBadges (for TabBar — clickable toggle) ────────────────────

export function OutputBadges() {
  const errorCount = useUiStore((s) => s.outputErrorCount)
  const warningCount = useUiStore((s) => s.outputWarningCount)
  const toggleOutputPanel = useUiStore((s) => s.toggleOutputPanel)

  if (!errorCount && !warningCount) return null

  return (
    <button
      onClick={toggleOutputPanel}
      className="flex items-center gap-1.5 px-2 h-full cursor-pointer hover:bg-surface-2/50 transition-colors"
      aria-label="Toggle output panel"
    >
      <BadgePills errorCount={errorCount} warningCount={warningCount} />
    </button>
  )
}

// ── CompileStatusStrip (28px inline strip — success/warning) ────────

export function CompileStatusStrip() {
  const outputView = useUiStore((s) => s.outputView)
  const errorCount = useUiStore((s) => s.outputErrorCount)
  const warningCount = useUiStore((s) => s.outputWarningCount)
  const executionOutput = useUiStore((s) => s.executionOutput)
  const setOutputView = useUiStore((s) => s.setOutputView)
  const isAiConfigured = useIsAiConfigured()

  const isSuccess = errorCount === 0 && warningCount === 0

  // Auto-dismiss success strip after 5 seconds
  useEffect(() => {
    if (outputView !== 'strip' || !isSuccess) return
    const timer = setTimeout(() => setOutputView('hidden'), 5000)
    return () => clearTimeout(timer)
  }, [outputView, isSuccess, executionOutput, setOutputView])

  if (outputView !== 'strip') return null

  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-border px-3 text-xs animate-strip-in">
      <div className="flex items-center gap-1.5">
        {isSuccess ? (
          <>
            <Check className="size-3.5 text-status-success" />
            <span className="text-ink-muted">Compiled successfully</span>
          </>
        ) : (
          <>
            <AlertTriangle className="size-3.5 text-status-warning" />
            <span className="text-ink">
              Compiled with {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isSuccess && isAiConfigured && (
          <button
            onClick={triggerAIFix}
            className="flex cursor-pointer items-center gap-1 rounded-full px-1.5 text-xxs text-brand transition-colors hover:text-brand-hover"
          >
            <Sparkles className="size-3" />
            Fix
          </button>
        )}
        {!isSuccess && (
          <button
            onClick={() => setOutputView('panel')}
            className="text-xxs text-ink-muted hover:text-ink transition-colors cursor-pointer px-1"
          >
            Show details
          </button>
        )}
        <Tip content="Dismiss" side="top">
          <button
            onClick={() => setOutputView('hidden')}
            className="flex items-center justify-center size-5 rounded text-ink-faint hover:text-ink-muted transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="size-3" />
          </button>
        </Tip>
      </div>
    </div>
  )
}

// ── OutputPanel (full expanded panel with scrollable output) ────────

export function OutputPanel() {
  const setOutputView = useUiStore((s) => s.setOutputView)
  const outputRef = useRef<HTMLPreElement>(null)
  const executionOutput = useUiStore((s) => s.executionOutput)
  const executionErrors = useUiStore((s) => s.executionErrors)
  const errorCount = useUiStore((s) => s.outputErrorCount)
  const warningCount = useUiStore((s) => s.outputWarningCount)
  const isAiConfigured = useIsAiConfigured()
  const hasIssues = errorCount > 0 || warningCount > 0

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [executionOutput, executionErrors])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">Output</span>
          <Badges />
          {isAiConfigured && hasIssues && (
            <button
              onClick={triggerAIFix}
              className="flex cursor-pointer items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xxs font-medium text-brand transition-colors hover:bg-brand/20"
            >
              <Sparkles className="size-3" />
              Fix
            </button>
          )}
        </div>
        <Tip content="Collapse" side="bottom">
          <button
            onClick={() => setOutputView('hidden')}
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

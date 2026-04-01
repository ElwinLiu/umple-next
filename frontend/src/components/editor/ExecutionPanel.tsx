import { useRef, useEffect, useState, useCallback } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import type { ParsedIssue } from '../../stores/ephemeralStore'
import { useSessionStore } from '../../stores/sessionStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { ChevronDown, Check, AlertTriangle, X, XCircle, Sparkles, Loader2, Copy, ExternalLink } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'

function useIsAiConfigured() {
  return usePreferencesStore((s) => {
    const cfg = s.configs[s.activeProvider]
    return !!(cfg.apiKey.trim() && cfg.model.trim())
  })
}

function triggerAIFix() {
  const { executionOutput, executionErrors } = useEphemeralStore.getState()
  const errorInfo = [executionOutput, executionErrors].filter(Boolean).join('\n')
  if (!errorInfo) return
  useEphemeralStore.getState().queueAgentMessage(
    `Fix the following compilation issues:\n\n\`\`\`\n${errorInfo}\n\`\`\``,
  )
  useSessionStore.getState().openAgentPanel()
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
  const errorCount = useEphemeralStore((s) => s.outputErrorCount)
  const warningCount = useEphemeralStore((s) => s.outputWarningCount)

  if (!errorCount && !warningCount) return null

  return (
    <div className="flex items-center gap-1.5">
      <BadgePills errorCount={errorCount} warningCount={warningCount} />
    </div>
  )
}

// ── Single issue row ────────────────────────────────────────────────

function IssueRow({ issue }: { issue: ParsedIssue }) {
  const isError = issue.severity <= 2
  const colorClass = isError ? 'text-status-error' : 'text-status-warning'
  const bgClass = isError ? 'bg-status-error/5 hover:bg-status-error/10' : 'bg-status-warning/5 hover:bg-status-warning/10'
  const Icon = isError ? XCircle : AlertTriangle

  return (
    <div className={`flex items-start gap-2 rounded px-2 py-1.5 ${bgClass} transition-colors`}>
      <Icon className={`size-3.5 shrink-0 mt-0.5 ${colorClass}`} />
      <span className={`flex-1 min-w-0 font-mono text-xs leading-relaxed ${colorClass}`}>
        {issue.message}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {issue.line > 0 && (
          <span className="text-xxs text-ink-faint">line {issue.line}</span>
        )}
        {issue.url && (
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-faint hover:text-brand transition-colors"
            title="View documentation"
          >
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── OutputBadges (for TabBar — clickable toggle) ────────────────────

export function OutputBadges() {
  const errorCount = useEphemeralStore((s) => s.outputErrorCount)
  const warningCount = useEphemeralStore((s) => s.outputWarningCount)
  const toggleOutputPanel = useEphemeralStore((s) => s.toggleOutputPanel)

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
  const outputView = useEphemeralStore((s) => s.outputView)
  const errorCount = useEphemeralStore((s) => s.outputErrorCount)
  const warningCount = useEphemeralStore((s) => s.outputWarningCount)
  const executionOutput = useEphemeralStore((s) => s.executionOutput)
  const setOutputView = useEphemeralStore((s) => s.setOutputView)
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
  const setOutputView = useEphemeralStore((s) => s.setOutputView)
  const executing = useEphemeralStore((s) => s.executing)
  const outputRef = useRef<HTMLDivElement>(null)
  const executionOutput = useEphemeralStore((s) => s.executionOutput)
  const executionErrors = useEphemeralStore((s) => s.executionErrors)
  const parsedIssues = useEphemeralStore((s) => s.parsedIssues)
  const rawErrorText = useEphemeralStore((s) => s.rawErrorText)
  const errorCount = useEphemeralStore((s) => s.outputErrorCount)
  const warningCount = useEphemeralStore((s) => s.outputWarningCount)
  const isAiConfigured = useIsAiConfigured()
  const hasIssues = errorCount > 0 || warningCount > 0
  const [copied, setCopied] = useState(false)

  const hasContent = !!(executionOutput || executionErrors)

  const handleCopy = useCallback(() => {
    const text = [executionOutput, executionErrors].filter(Boolean).join('\n')
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [executionOutput, executionErrors])

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
          <span className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
            Output
            {executing && <Loader2 className="size-3 animate-spin text-brand" />}
          </span>
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
        <div className="flex items-center gap-0.5">
          <Tip content={copied ? 'Copied!' : 'Copy'} side="bottom">
            <button
              onClick={handleCopy}
              disabled={!hasContent}
              className="flex items-center justify-center size-6 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1 disabled:opacity-30 disabled:cursor-default"
              aria-label="Copy output"
            >
              {copied
                ? <Check className="size-3.5 text-status-success" />
                : <Copy className="size-3.5 text-ink-faint hover:text-ink-muted" />}
            </button>
          </Tip>
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
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto bg-surface-0"
      >
        {executionOutput && (
          <pre className="m-0 whitespace-pre-wrap break-words px-2.5 pt-2.5 font-mono text-xs leading-relaxed text-ink">
            {executionOutput}
          </pre>
        )}
        {parsedIssues.length > 0 && (
          <div className="flex flex-col gap-px px-1.5 py-1.5">
            {parsedIssues.map((issue, i) => (
              <IssueRow key={`${issue.errorCode}-${issue.line}-${i}`} issue={issue} />
            ))}
          </div>
        )}
        {rawErrorText && (
          <pre className="m-0 whitespace-pre-wrap break-words px-2.5 py-1.5 font-mono text-xs leading-relaxed text-status-error">
            {rawErrorText}
          </pre>
        )}
        {!executionOutput && !parsedIssues.length && !rawErrorText && (
          <span className="block px-2.5 pt-2.5 text-xs font-mono text-ink-faint">
            Compile or generation messages will appear here.
          </span>
        )}
      </div>
    </div>
  )
}

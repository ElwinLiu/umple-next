import { memo } from 'react'
import { getToolName, isToolUIPart, type UIMessage } from 'ai'
import {
  Eye,
  PenLine,
  FileCode2,
  Play,
  Sparkles,
  Wrench,
  Check,
  XIcon,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import type { ToolPreviewInfo } from '@/ai/editPreview'
import { ActionRow } from './ActionRow'

/* ── Memoized Markdown ── */

const REMARK_PLUGINS = [remarkGfm]

/**
 * Wraps ReactMarkdown in memo so it only re-parses when the text string
 * actually changes — avoids redundant AST parsing during streaming when
 * the throttled render fires but the text part hasn't grown.
 */
const MemoizedMarkdown = memo(function MemoizedMarkdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{text}</ReactMarkdown>
})

/* ── Tool Config ── */

const TOOL_CONFIG: Record<
  string,
  { icon: React.JSX.Element; labels: { running: string; approval: string; done: string } }
> = {
  readEditorCode: {
    icon: <Eye className="size-3" />,
    labels: { running: 'Reading code', approval: 'Reading code', done: 'Read code' },
  },
  editCode: {
    icon: <PenLine className="size-3" />,
    labels: { running: 'Preparing edit', approval: 'Edit proposed', done: 'Edit applied' },
  },
  replaceCode: {
    icon: <FileCode2 className="size-3" />,
    labels: { running: 'Preparing replacement', approval: 'Replace proposed', done: 'Code replaced' },
  },
  compile: {
    icon: <Play className="size-3" />,
    labels: { running: 'Compiling', approval: 'Compiling', done: 'Compiled' },
  },
}

/* ── Helpers ── */

function actionLabel(name: string, state: string): string {
  const cfg = TOOL_CONFIG[name]
  if (state === 'input-streaming' || state === 'input-available')
    return cfg?.labels.running ?? `Running ${name}`
  if (state === 'approval-requested')
    return cfg?.labels.approval ?? `${name} needs approval`
  if (state === 'approval-responded') return 'Applying changes'
  if (state === 'output-available')
    return cfg?.labels.done ?? name
  if (state === 'output-error') return `${name} failed`
  if (state === 'output-denied') return `${name} rejected`
  return name
}

function actionStatus(state: string): 'running' | 'done' | 'error' | 'approval' | undefined {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
    case 'approval-responded':
      return 'running'
    case 'approval-requested':
      return 'approval'
    case 'output-available':
    case 'output-denied':
      return 'done'
    case 'output-error':
      return 'error'
    default:
      return undefined
  }
}

/* ── DiffBlock ── */

function DiffBlock({
  text,
  variant,
}: {
  text: string
  variant: 'add' | 'remove' | 'neutral'
}) {
  return (
    <pre
      className={cn(
        'whitespace-pre-wrap break-all px-2 py-1.5',
        variant === 'add' && 'bg-status-success/8 text-status-success',
        variant === 'remove' && 'bg-status-error/8 text-status-error line-through',
        variant === 'neutral' && 'text-ink',
      )}
    >
      {text || '\u00A0'}
    </pre>
  )
}

/* ── ToolActionRow ── */

function ToolActionRow({
  part,
  previewInfo,
  onApprove,
  onReject,
}: {
  part: any
  previewInfo: ToolPreviewInfo | null
  onApprove: (
    approvalId: string,
    toolCallId: string,
    toolName: string,
    input: any,
  ) => void
  onReject: (
    approvalId: string,
    toolCallId: string,
    toolName: string,
    reason?: string,
  ) => void
}) {
  const toolName = getToolName(part)
  const { toolCallId, state, input, output, errorText } = part
  const icon = TOOL_CONFIG[toolName]?.icon ?? <Wrench className="size-3" />
  let children: React.ReactNode = null

  if (state === 'approval-requested') {
    children = (
      <div className="space-y-2">
        {input?.explanation ? (
          <p className="text-xs text-ink">{input.explanation}</p>
        ) : null}
        {previewInfo?.preview ? (
          <p className="text-xs text-ink-muted">Preview shown in the editor above.</p>
        ) : null}
        {previewInfo?.error ? (
          <p className="text-xs text-status-error">Preview unavailable: {previewInfo.error}</p>
        ) : null}
        {input?.edits && (
          <div className="space-y-1">
            {input.edits.map((edit: any, j: number) => (
              <div
                key={j}
                className="max-h-48 overflow-auto rounded border border-border bg-surface-0 font-mono text-xxs"
              >
                <DiffBlock text={edit.oldText} variant="remove" />
                <DiffBlock text={edit.newText} variant="add" />
              </div>
            ))}
          </div>
        )}
        {input?.code && (
          <div className="max-h-48 overflow-auto rounded border border-border bg-surface-0 font-mono text-xxs">
            <DiffBlock text={input.code} variant="neutral" />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(part.approval.id, toolCallId, toolName, input)}
            className="flex cursor-pointer items-center gap-1 rounded-md bg-status-success/10 px-2.5 py-1 text-xs font-medium text-status-success transition-colors hover:bg-status-success/20"
          >
            <Check className="size-3" />
            Approve
          </button>
          <button
            onClick={() => onReject(part.approval.id, toolCallId, toolName)}
            className="flex cursor-pointer items-center gap-1 rounded-md bg-status-error/10 px-2.5 py-1 text-xs font-medium text-status-error transition-colors hover:bg-status-error/20"
          >
            <XIcon className="size-3" />
            Reject
          </button>
        </div>
      </div>
    )
  } else if (state === 'output-available' && output != null) {
    children =
      typeof output === 'string' ? (
        output.includes('\n') || output.length > 80 ? (
          <pre className="max-h-32 overflow-auto rounded border border-border bg-surface-0 p-2 font-mono text-xxs text-ink-muted">
            {output}
          </pre>
        ) : (
          <p className="text-xs text-ink-muted">{output}</p>
        )
      ) : (
        <pre className="max-h-32 overflow-auto rounded border border-border bg-surface-0 p-2 font-mono text-xxs text-ink-muted">
          {JSON.stringify(output, null, 2)}
        </pre>
      )
  } else if (state === 'output-error') {
    children = <p className="text-xs text-status-error">{errorText}</p>
  } else if (state === 'output-denied') {
    children = (
      <p className="text-xs text-ink-muted">
        Rejected{part.approval?.reason ? `: ${part.approval.reason}` : ''}
      </p>
    )
  }

  return (
    <ActionRow
      icon={icon}
      label={actionLabel(toolName, state)}
      status={actionStatus(state)}
    >
      {children}
    </ActionRow>
  )
}

/* ── Selection context parsing ── */

const SELECTION_RE = /^\[(.+?)\]\n```\n([\s\S]*?)\n```\n\n([\s\S]*)$/

function parseSelectionContext(text: string) {
  const m = text.match(SELECTION_RE)
  if (!m) return null
  return { label: m[1], code: m[2], question: m[3] }
}

/* ── MessageBubble ── */

export function MessageBubble({
  message,
  pendingPreview,
  onApprove,
  onReject,
}: {
  message: UIMessage
  pendingPreview: ToolPreviewInfo | null
  onApprove: (
    approvalId: string,
    toolCallId: string,
    toolName: string,
    input: any,
  ) => void
  onReject: (
    approvalId: string,
    toolCallId: string,
    toolName: string,
    reason?: string,
  ) => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex flex-col gap-1 animate-message-in', isUser && 'items-end')}>
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          if (!part.text) return null
          if (isUser) {
            const sel = parseSelectionContext(part.text)
            if (sel) {
              return (
                <div
                  key={i}
                  className="max-w-[calc(100%-2rem)] space-y-1.5 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-ink"
                >
                  <span className="inline-block rounded-full bg-surface-0 px-2 py-0.5 text-xs text-ink-muted">
                    {sel.label}
                  </span>
                  <pre className="overflow-x-auto rounded-lg bg-surface-0 px-2.5 py-1.5 font-mono text-xs text-ink-muted">
                    {sel.code}
                  </pre>
                  <p>{sel.question}</p>
                </div>
              )
            }
            return (
              <div
                key={i}
                className="max-w-[calc(100%-2rem)] rounded-2xl bg-surface-2 px-3 py-2 text-sm text-ink"
              >
                {part.text}
              </div>
            )
          }
          return (
            <div
              key={i}
              className="prose prose-sm dark:prose-invert max-w-[calc(100%-2rem)] px-1 text-ink prose-p:my-1.5 prose-pre:bg-surface-1 prose-pre:text-ink prose-code:text-ink prose-headings:text-ink prose-strong:text-ink prose-a:text-brand prose-pre:border prose-pre:border-border"
            >
              <MemoizedMarkdown text={part.text} />
            </div>
          )
        }

        if (part.type === 'reasoning') {
          const rp = part as any
          return (
            <ActionRow
              key={i}
              icon={<Sparkles className="size-3" />}
              label={rp.state === 'streaming' ? 'Thinking...' : 'Thought'}
              status={rp.state === 'streaming' ? 'running' : 'done'}
            >
              {rp.text ? (
                <p className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-ink-muted">
                  {rp.text}
                </p>
              ) : null}
            </ActionRow>
          )
        }

        if (part.type === 'step-start') {
          return i > 0 ? (
            <div key={i} className="my-1 border-t border-border/50" />
          ) : null
        }

        if (isToolUIPart(part)) {
          const preview =
            pendingPreview?.toolCallId === part.toolCallId ? pendingPreview : null
          return (
            <ToolActionRow
              key={i}
              part={part}
              previewInfo={preview}
              onApprove={onApprove}
              onReject={onReject}
            />
          )
        }

        return null
      })}
    </div>
  )
}

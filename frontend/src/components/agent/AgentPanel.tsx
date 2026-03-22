import {
  memo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react'
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useUiStore } from '@/stores/uiStore'
import { useAgent } from '@/ai/useAgent'
import { useDiffPreviewSync } from '@/ai/useDiffPreviewSync'
import { useResizablePanel } from './useResizablePanel'
import { InputBar } from './InputBar'
import { MessageBubble } from './MessageBubble'

/* ── Constants ── */

const MIN_HEIGHT = 200
const DEFAULT_HEIGHT = 400
const MAX_HEIGHT_VH = 0.8
const FOLD_THRESHOLD = 80

/* ── Main Component ── */

function AgentPanel() {
  const { messages, status, error, send, stop, reset, approveToolCall, rejectToolCall } =
    useAgent()
  const { showAgentPanel, openAgentPanel, closeAgentPanel } = useUiStore()
  const code = useEditorStore((s) => s.code)
  const selection = useEditorStore((s) => s.selection)
  const clearSelection = useEditorStore((s) => s.setSelection)
  const activeTabName = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.name ?? 'model.ump')
  const expanded = showAgentPanel
  const [focusExpandedInput, setFocusExpandedInput] = useState(false)

  /* ── Resize ── */
  const {
    height,
    panelRef,
    resizeHandlers,
    resetSuppressClick,
    shouldSuppressClick,
  } = useResizablePanel({
    defaultHeight: DEFAULT_HEIGHT,
    minHeight: MIN_HEIGHT,
    maxHeightVh: MAX_HEIGHT_VH,
    foldThreshold: FOLD_THRESHOLD,
    onFold: closeAgentPanel,
  })

  /* ── Input state ── */
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isStreaming = status === 'submitted' || status === 'streaming'
  const canSend = input.trim().length > 0 && !isStreaming

  const selectionBadge = selection
    ? selection.fromLine === selection.toLine
      ? `${activeTabName} (${selection.fromLine})`
      : `${activeTabName} (${selection.fromLine}:${selection.toLine})`
    : null
  const userScrolledUp = useRef(false)

  /* Track whether the user has scrolled up */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() {
      const gap = el!.scrollHeight - el!.scrollTop - el!.clientHeight
      userScrolledUp.current = gap > 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  /* ── Consume pending messages from SelectionToolbar ── */
  const pendingAgentMessage = useUiStore((s) => s.pendingAgentMessage)
  const consumeAgentMessage = useUiStore((s) => s.consumeAgentMessage)

  useEffect(() => {
    if (!pendingAgentMessage) return
    const msg = consumeAgentMessage()
    if (msg) {
      send(msg)
      userScrolledUp.current = false
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [pendingAgentMessage, consumeAgentMessage, send])

  /* Auto-scroll on new messages — skip if the user has scrolled up */
  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  /* ── Preview sync ── */
  const pendingPreview = useDiffPreviewSync(messages, code)

  /* ── Handlers ── */

  function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    if (!expanded) handleExpandPanel(true)

    let message = text
    if (selection) {
      message = `[${selectionBadge}]\n\`\`\`\n${selection.text}\n\`\`\`\n\n${text}`
      clearSelection(null)
    }

    send(message)
    setInput('')
    userScrolledUp.current = false
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  const handleExpandPanel = useCallback((shouldFocusInput = false) => {
    if (shouldFocusInput) setFocusExpandedInput(true)
    openAgentPanel()
  }, [openAgentPanel])

  const handleCollapsedClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldSuppressClick()) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (messages.length > 0) {
        handleExpandPanel(true)
        return
      }

      ;(e.currentTarget.querySelector('textarea') as HTMLTextAreaElement | null)?.focus()
    },
    [handleExpandPanel, messages.length, shouldSuppressClick],
  )

  const handleReset = useCallback(() => {
    reset()
    setInput('')
  }, [reset])

  /* ── Collapsed: just the input bar ── */
  if (!expanded) {
    return (
      <div
        className="absolute bottom-0 left-1/2 z-20 w-full max-w-3xl -translate-x-1/2 px-2 pb-2"
        data-testid="agent-panel-collapsed"
        onPointerDownCapture={resetSuppressClick}
        onClick={handleCollapsedClick}
      >
        <InputBar
          className="cursor-text shadow-[0_14px_32px_rgba(15,23,42,0.16),0_6px_12px_rgba(15,23,42,0.08)]"
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          canSend={canSend}
          textareaMaxHeight={60}
          selectionBadge={selectionBadge}
          onClearSelection={() => clearSelection(null)}
        >
          {messages.length > 0 && (
            <button
              onClick={() => handleExpandPanel(true)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Expand chat"
            >
              <ChevronUp className="size-4" />
            </button>
          )}
        </InputBar>
      </div>
    )
  }

  /* ── Expanded: full chat panel ── */
  return (
    <div
      ref={panelRef}
      className="absolute bottom-2 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 flex-col rounded-2xl border border-border bg-surface-0 shadow-[0_14px_32px_rgba(15,23,42,0.16),0_6px_12px_rgba(15,23,42,0.08)] animate-in slide-in-from-bottom-4 duration-200"
      style={{ height }}
      data-testid="agent-panel"
    >
      {/* Resize handle */}
      <div
        className="flex shrink-0 cursor-row-resize items-center justify-center py-1.5"
        {...resizeHandlers}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chat panel"
      >
        <div className="h-1 w-10 rounded-full bg-ink-faint" />
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 pb-2">
        <button
          onClick={closeAgentPanel}
          className="cursor-pointer rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Collapse chat panel"
        >
          <ChevronDown className="size-4" />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="cursor-pointer rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Reset conversation"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-ink-faint">
              Ask anything about your Umple model.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              pendingPreview={pendingPreview}
              onApprove={approveToolCall}
              onReject={rejectToolCall}
            />
          ))}

          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Loader2 className="size-3 animate-spin text-ink-faint" />
              <span className="text-xs text-ink-faint">Working…</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-brand-light px-3 py-2 text-sm text-status-error">
              {error.message || 'Something went wrong.'}
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 p-2">
        <InputBar
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          canSend={canSend}
          textareaMaxHeight={100}
          autoFocus={focusExpandedInput}
          onAutoFocus={() => setFocusExpandedInput(false)}
          selectionBadge={selectionBadge}
          onClearSelection={() => clearSelection(null)}
        />
      </div>
    </div>
  )
}

export default memo(AgentPanel)

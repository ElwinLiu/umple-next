import { useRef, useEffect, type KeyboardEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InputBarProps {
  className?: string
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  canSend: boolean
  textareaMaxHeight: number
  children?: React.ReactNode
}

export function InputBar({
  className,
  input,
  onInputChange,
  onSend,
  onStop,
  isStreaming,
  canSend,
  textareaMaxHeight,
  children,
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, textareaMaxHeight)}px`
  }, [input, textareaMaxHeight])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[2rem] border border-border bg-surface-0 py-1.5 pl-4 pr-1.5',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        data-slot="agent-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything..."
        rows={1}
        style={{ maxHeight: textareaMaxHeight }}
        className="min-h-[20px] flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
      />
      <div className="flex shrink-0 items-center gap-1">
        {children}
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-ink-inverse transition-colors hover:bg-ink-muted"
            aria-label="Stop generation"
          >
            <Square className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors',
              canSend
                ? 'cursor-pointer bg-ink text-ink-inverse hover:bg-ink-muted'
                : 'cursor-default bg-surface-2 text-ink-faint',
            )}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

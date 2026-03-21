import { useState, useCallback } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { api } from '../../api/client'

export function TaskCreator() {
  const code = useEditorStore((s) => s.code)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.createTask({ title, description, code })
      setResult(res)
    } catch (err: any) {
      setError(err.message || 'Failed to create task')
    } finally {
      setCreating(false)
    }
  }, [title, description, code])

  const handleCopyLink = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [result])

  return (
    <div className="p-4 bg-surface-1 border border-border rounded mt-4">
      <h4 className="mt-0 mb-3 text-sm font-semibold text-ink">
        Create New Task
      </h4>

      <div className="flex flex-col gap-2.5">
        <label className="sr-only" htmlFor="task-title">Task title</label>
        <input
          id="task-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="px-2.5 py-2 text-[13px] border border-border rounded bg-surface-0 text-ink placeholder:text-ink-faint focus:border-brand outline-none transition-colors"
        />

        <label className="sr-only" htmlFor="task-description">Task description</label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task description (instructions for the student)"
          className="px-2.5 py-2 text-[13px] font-[inherit] border border-border rounded bg-surface-0 text-ink min-h-[80px] resize-y placeholder:text-ink-faint focus:border-brand outline-none transition-colors"
        />

        <div className="text-xs text-ink-muted">
          The current editor code will be included as the initial code for this task.
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !title.trim()}
          className="px-4 py-2 text-[13px] font-semibold border-none rounded self-start transition-colors bg-brand text-ink-inverse cursor-pointer hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
        >
          {creating ? 'Creating...' : 'Create Task'}
        </button>

        {error && (
          <div className="px-3 py-2 bg-brand-light border border-status-error rounded text-status-error text-xs">
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-surface-1 border border-status-success rounded">
            <div className="text-xs text-status-success mb-2">
              Task created successfully!
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={result.url}
                className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-surface-0 text-ink"
                aria-label="Task URL"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-1.5 text-xs border rounded cursor-pointer whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1 ${
                  copied
                    ? 'bg-surface-1 text-status-success border-status-success'
                    : 'bg-surface-0 text-ink-muted border-border hover:bg-surface-1'
                }`}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

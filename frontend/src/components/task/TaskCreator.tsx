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
    <div className="p-4 bg-slate-800 border border-slate-700 rounded mt-4">
      <h4 className="mt-0 mb-3 text-sm font-semibold text-slate-300">
        Create New Task
      </h4>

      <div className="flex flex-col gap-2.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="px-2.5 py-2 text-[13px] border border-slate-600 rounded bg-slate-900 text-slate-300 placeholder:text-slate-600 focus:border-brand transition-colors"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task description (instructions for the student)"
          className="px-2.5 py-2 text-[13px] font-[inherit] border border-slate-600 rounded bg-slate-900 text-slate-300 min-h-[80px] resize-y placeholder:text-slate-600 focus:border-brand transition-colors"
        />

        <div className="text-xs text-slate-500">
          The current editor code will be included as the initial code for this task.
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !title.trim()}
          className={`px-4 py-2 text-[13px] font-semibold border-none rounded self-start transition-colors ${
            creating || !title.trim()
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-brand text-ink-inverse cursor-pointer hover:bg-brand-hover active:bg-brand'
          }`}
        >
          {creating ? 'Creating...' : 'Create Task'}
        </button>

        {error && (
          <div className="px-3 py-2 bg-red-950 border border-red-900 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-950 border border-green-800 rounded">
            <div className="text-xs text-green-500 mb-2">
              Task created successfully!
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={result.url}
                className="flex-1 px-2 py-1.5 text-xs border border-green-800 rounded bg-slate-900 text-slate-300"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-1.5 text-xs border border-green-800 rounded cursor-pointer whitespace-nowrap transition-colors ${
                  copied
                    ? 'bg-green-800 text-green-400'
                    : 'bg-transparent text-green-500 hover:bg-green-900'
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

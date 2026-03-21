import { useUiStore } from '../../stores/uiStore'
import { useTask } from '../../hooks/useTask'
import { X } from 'lucide-react'

export function TaskPanel() {
  const showTaskPanel = useUiStore((s) => s.showTaskPanel)
  const toggleTaskPanel = useUiStore((s) => s.toggleTaskPanel)
  const { task, loading, error, submitting, submitStatus, submitWork } = useTask()

  if (!showTaskPanel) return null

  return (
    <div className="fixed top-14 right-0 w-full sm:w-[380px] bottom-0 bg-surface-0 border-l border-border flex flex-col z-[100] text-ink">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1">
        <span className="font-semibold text-sm">Task</span>
        <button
          onClick={toggleTaskPanel}
          className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          aria-label="Close task panel"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {loading && (
          <div className="text-[13px] text-ink-muted">Loading task...</div>
        )}

        {error && (
          <div className="px-3 py-2 mb-3 bg-brand-light border border-status-error rounded text-status-error text-xs">
            {error}
          </div>
        )}

        {!loading && !task && !error && (
          <div className="text-[13px] text-ink-muted">
            <p className="mb-2 mt-0">No task loaded.</p>
            <p className="m-0">
              Open a task URL with <code className="bg-surface-1 px-1.5 rounded-sm text-ink">?task=taskId</code> to load a task, or create a new one below.
            </p>
          </div>
        )}

        {task && (
          <div className="flex flex-col gap-4">
            {/* Task info */}
            <div>
              <h3 className="mt-0 mb-2 text-base font-semibold text-ink">{task.title}</h3>
              <p className="m-0 text-[13px] text-ink-muted leading-relaxed">
                {task.description}
              </p>
            </div>

            {/* Submit section */}
            <div className="p-3 bg-surface-1 border border-border rounded">
              <div className="text-xs text-ink-muted mb-2">
                Submit your work when you are ready.
              </div>
              <button
                onClick={submitWork}
                disabled={submitting}
                className="px-5 py-2 text-[13px] font-semibold border-none rounded transition-colors bg-status-success text-ink-inverse cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
              >
                {submitting ? 'Submitting...' : 'Submit Work'}
              </button>

              {submitStatus && (
                <div className={`mt-2 px-2.5 py-1.5 rounded text-xs border ${
                  submitStatus === 'error'
                    ? 'bg-brand-light text-status-error border-status-error'
                    : 'bg-surface-1 text-status-success border-status-success'
                }`}>
                  {submitStatus === 'error' ? 'Submission failed' : `Status: ${submitStatus}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

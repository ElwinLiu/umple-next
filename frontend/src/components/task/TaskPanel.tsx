import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useTask } from '../../hooks/useTask'
import { SidePanel } from '@/components/ui/side-panel'
import { ErrorBanner } from '@/components/ui/error-banner'
import { cn } from '@/lib/utils'

export function TaskPanel() {
  const showTaskPanel = useEphemeralStore((s) => s.showTaskPanel)
  const toggleTaskPanel = useEphemeralStore((s) => s.toggleTaskPanel)
  const { task, loading, error, submitting, submitStatus, submitWork } = useTask()

  return (
    <SidePanel title="Task" open={showTaskPanel} onClose={toggleTaskPanel} width="sm:w-[380px]">
      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {loading && (
          <div className="text-sm text-ink-muted">Loading task...</div>
        )}

        {error && (
          <ErrorBanner className="mb-3">{error}</ErrorBanner>
        )}

        {!loading && !task && !error && (
          <div className="text-sm text-ink-muted">
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
              <p className="m-0 text-sm text-ink-muted leading-relaxed">
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
                className="px-5 py-2 text-sm font-semibold border-none rounded transition-colors bg-status-success text-ink-inverse cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
              >
                {submitting ? 'Submitting...' : 'Submit Work'}
              </button>

              {submitStatus && (
                <div className={cn(
                  'mt-2 px-2.5 py-1.5 rounded text-xs border',
                  submitStatus === 'error'
                    ? 'bg-brand-light text-status-error border-status-error'
                    : 'bg-surface-1 text-status-success border-status-success'
                )}>
                  {submitStatus === 'error' ? 'Submission failed' : `Status: ${submitStatus}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  )
}

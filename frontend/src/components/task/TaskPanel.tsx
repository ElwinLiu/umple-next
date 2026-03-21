import { useUiStore } from '../../stores/uiStore'
import { useTask } from '../../hooks/useTask'

export function TaskPanel() {
  const showTaskPanel = useUiStore((s) => s.showTaskPanel)
  const toggleTaskPanel = useUiStore((s) => s.toggleTaskPanel)
  const { task, loading, error, submitting, submitStatus, submitWork } = useTask()

  if (!showTaskPanel) return null

  return (
    <div className="fixed top-[44px] right-0 w-[380px] bottom-0 bg-slate-900 border-l border-slate-700 flex flex-col z-[100] text-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
        <span className="font-semibold text-sm text-slate-200">Task</span>
        <button
          onClick={toggleTaskPanel}
          className="bg-transparent border-none text-slate-500 cursor-pointer text-lg px-1 hover:text-slate-300 transition-colors"
        >
          x
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {loading && (
          <div className="text-[13px] text-slate-500">Loading task...</div>
        )}

        {error && (
          <div className="px-3 py-2 mb-3 bg-red-950 border border-red-900 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {!loading && !task && !error && (
          <div className="text-[13px] text-slate-500">
            <p className="mb-2 mt-0">No task loaded.</p>
            <p className="m-0">
              Open a task URL with <code className="bg-slate-800 px-1.5 rounded-sm">?task=taskId</code> to load a task, or create a new one below.
            </p>
          </div>
        )}

        {task && (
          <div className="flex flex-col gap-4">
            {/* Task info */}
            <div>
              <h3 className="mt-0 mb-2 text-base font-semibold text-slate-200">{task.title}</h3>
              <p className="m-0 text-[13px] text-slate-400 leading-relaxed">
                {task.description}
              </p>
            </div>

            {/* Submit section */}
            <div className="p-3 bg-slate-800 border border-slate-700 rounded">
              <div className="text-xs text-slate-500 mb-2">
                Submit your work when you are ready.
              </div>
              <button
                onClick={submitWork}
                disabled={submitting}
                className={`px-5 py-2 text-[13px] font-semibold border-none rounded transition-colors ${
                  submitting
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-green-600 text-white cursor-pointer hover:bg-green-700 active:bg-green-800'
                }`}
              >
                {submitting ? 'Submitting...' : 'Submit Work'}
              </button>

              {submitStatus && (
                <div className={`mt-2 px-2.5 py-1.5 rounded text-xs border ${
                  submitStatus === 'error'
                    ? 'bg-red-950 text-red-400 border-red-900'
                    : 'bg-green-950 text-green-500 border-green-800'
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

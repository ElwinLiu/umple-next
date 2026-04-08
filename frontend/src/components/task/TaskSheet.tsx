import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Copy, Check, RefreshCw, Clock, ExternalLink } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useTaskStore } from '@/stores/taskStore'
import { useSessionStore } from '@/stores/sessionStore'
import { taskApi } from '@/api/taskApi'
import type { TaskView, ResponseSummary } from '@/api/types'

const NAME_PATTERN = /^[a-zA-Z0-9_.]{1,100}$/

export function TaskSheet() {
  const sheetMode = useTaskStore((s) => s.sheetMode)
  const closeSheet = useTaskStore((s) => s.closeSheet)

  return (
    <Sheet open={sheetMode !== 'closed'} onOpenChange={(open) => { if (!open) closeSheet() }}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        {sheetMode === 'create' && <CreateView />}
        {sheetMode === 'manage' && <ManageView />}
      </SheetContent>
    </Sheet>
  )
}

// ── Create View ──

function CreateView() {
  const [taskName, setTaskName] = useState('')
  const [requestorName, setRequestorName] = useState('')
  const [completionURL, setCompletionURL] = useState('')
  const [isExperiment, setIsExperiment] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<TaskView | null>(null)

  const nameValid = taskName.length === 0 || NAME_PATTERN.test(taskName)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!NAME_PATTERN.test(taskName)) return

    // Read current editor code and tabs
    const { code, tabs, activeTabId } = useSessionStore.getState()
    const hasTabs = tabs.length > 1

    setSubmitting(true)
    setError(null)
    try {
      const result = await taskApi.createTask({
        taskName,
        requestorName,
        completionURL: completionURL || undefined,
        isExperiment,
        instructions,
        modelCode: hasTabs ? '' : code,
        tabs: hasTabs ? tabs.map((t) => ({ name: t.name, code: t.code })) : undefined,
      })
      setCreated(result)
      toast.success('Task created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return <PostCreateView task={created} />
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Create a Task</SheetTitle>
      </SheetHeader>
      <div className="p-4">
        <SheetDescription className="mb-4">
          The current editor code will be used as the starter model for participants.
        </SheetDescription>

        {error && (
          <div className="mb-4 rounded-md border border-status-error/30 bg-status-error/5 px-3 py-2 text-sm text-status-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Task Name" required hint="Alphanumeric, underscores, and dots only">
            <Input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. hw1_uml_basics"
              aria-invalid={taskName.length > 0 && !nameValid}
              data-testid="task-name-input"
            />
            {taskName.length > 0 && !nameValid && (
              <p className="text-xs text-status-error mt-1">
                Only letters, digits, underscores, and dots (1-100 chars)
              </p>
            )}
          </Field>

          <Field label="Requestor Name" hint="Your name (shown to participants)">
            <Input
              value={requestorName}
              onChange={(e) => setRequestorName(e.target.value)}
              placeholder="e.g. Prof. Smith"
              data-testid="requestor-name-input"
            />
          </Field>

          <Field label="Completion URL" hint="Optional redirect after submission (e.g. a survey)">
            <Input
              value={completionURL}
              onChange={(e) => setCompletionURL(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-border bg-surface-0 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">Experiment Mode</p>
              <p className="text-xs text-ink-muted">Log participant commands for research</p>
            </div>
            <Switch checked={isExperiment} onCheckedChange={setIsExperiment} />
          </div>

          <Field label="Instructions" hint="Markdown supported">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-surface-0 px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors hover:bg-surface-1 focus:border-brand focus:ring-1 focus:ring-brand resize-y"
              placeholder="Write the task instructions here..."
              data-testid="instructions-input"
            />
          </Field>

          <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
            <p className="text-xs text-ink-muted">
              Starter model: using the code currently in the editor
              {useSessionStore.getState().tabs.length > 1 && ` (${useSessionStore.getState().tabs.length} tabs)`}
            </p>
          </div>

          <Button type="submit" disabled={!NAME_PATTERN.test(taskName) || submitting} className="w-full" data-testid="create-task-btn">
            {submitting ? 'Creating...' : 'Create Task'}
          </Button>
        </form>
      </div>
    </>
  )
}

// ── Post-Create View ──

function PostCreateView({ task }: { task: TaskView }) {
  const [copied, setCopied] = useState(false)

  function copyURL() {
    const url = `${window.location.origin}/tasks/${task.taskName}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Participant URL copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const participantURL = `${window.location.origin}/tasks/${task.taskName}`

  return (
    <>
      <SheetHeader>
        <SheetTitle>Task Created</SheetTitle>
      </SheetHeader>
      <div className="p-4 space-y-5">
        <div className="rounded-md border border-status-success/30 bg-status-success/5 px-3 py-2 text-sm text-status-success">
          Task "{task.taskName}" created successfully.
        </div>

        <Field label="Participant URL" hint="Share this with students">
          <div className="flex gap-1.5">
            <Input value={participantURL} readOnly className="flex-1 font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={copyURL}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </Field>
      </div>
    </>
  )
}

// ── Manage View ──

function ManageView() {
  const [taskName, setTaskName] = useState('')
  const [task, setTask] = useState<TaskView | null>(null)
  const [responses, setResponses] = useState<ResponseSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Edit form state
  const [requestorName, setRequestorName] = useState('')
  const [completionURL, setCompletionURL] = useState('')
  const [isExperiment, setIsExperiment] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadData = useCallback(async (name: string) => {
    setLoading(true)
    setError(null)
    try {
      const [t, r] = await Promise.all([
        taskApi.getTask(name),
        taskApi.listResponses(name),
      ])
      setTask(t)
      setResponses(r)
      setRequestorName(t.requestorName)
      setCompletionURL(t.completionURL ?? '')
      setIsExperiment(t.isExperiment)
      setInstructions(t.instructions)

      // Load the task's model into the editor so the professor can edit it
      if (t.tabs && t.tabs.length > 0) {
        const apiTabs = t.tabs.map((tab, i) => ({ id: `tab-${i}`, name: tab.name, code: tab.code }))
        useSessionStore.getState().restoreTabs(apiTabs, apiTabs[0].id)
      } else {
        useSessionStore.getState().setCode(t.modelCode)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task not found')
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault()
    if (!taskName.trim()) return
    loadData(taskName)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!task) return
    setSaving(true)

    // Read current editor code
    const { code, tabs } = useSessionStore.getState()
    const hasTabs = tabs.length > 1

    try {
      const result = await taskApi.updateTask(task.taskName, {
        requestorName,
        completionURL,
        isExperiment,
        instructions,
        modelCode: hasTabs ? '' : code,
        tabs: hasTabs ? tabs.map((t) => ({ name: t.name, code: t.code })) : undefined,
      })
      setTask(result)
      toast.success('Task updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  function copyParticipantURL() {
    if (!task) return
    const url = `${window.location.origin}/tasks/${task.taskName}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Participant URL copied')
    setTimeout(() => setCopied(false), 2000)
  }

  // Not loaded yet — prompt for task name
  if (!task) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Manage Task</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          <SheetDescription className="mb-4">
            Enter the task name to view and edit it.
          </SheetDescription>

          {error && (
            <div className="mb-4 rounded-md border border-status-error/30 bg-status-error/5 px-3 py-2 text-sm text-status-error">
              {error}
            </div>
          )}

          <form onSubmit={handleLoad} className="space-y-4">
            <Field label="Task Name">
              <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="e.g. hw1_uml_basics" />
            </Field>
            <Button type="submit" disabled={loading || !taskName.trim()} className="w-full">
              {loading ? 'Loading...' : 'Load Task'}
            </Button>
          </form>
        </div>
      </>
    )
  }

  // Loaded — management view
  const participantURL = `${window.location.origin}/tasks/${task.taskName}`

  return (
    <>
      <SheetHeader>
        <SheetTitle>{task.taskName}</SheetTitle>
      </SheetHeader>
      <div className="p-4 space-y-6 pb-8">
        {/* Share section */}
        <div>
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1.5">Participant URL</div>
          <div className="flex gap-1.5">
            <Input value={participantURL} readOnly className="flex-1 font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={copyParticipantURL}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>

        {/* Edit form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Edit Task</div>

          <Field label="Requestor Name">
            <Input value={requestorName} onChange={(e) => setRequestorName(e.target.value)} />
          </Field>

          <Field label="Completion URL">
            <Input value={completionURL} onChange={(e) => setCompletionURL(e.target.value)} type="url" placeholder="https://..." />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-border bg-surface-0 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">Experiment Mode</p>
              <p className="text-xs text-ink-muted">Log commands for research</p>
            </div>
            <Switch checked={isExperiment} onCheckedChange={setIsExperiment} />
          </div>

          <Field label="Instructions">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-border bg-surface-0 px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors hover:bg-surface-1 focus:border-brand focus:ring-1 focus:ring-brand resize-y"
            />
          </Field>

          <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
            <p className="text-xs text-ink-muted">
              Starter model: saving whatever is currently in the editor
            </p>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>

        {/* Responses */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              Responses ({responses.length})
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => loadData(task.taskName)}>
              <RefreshCw className="size-3" />
            </Button>
          </div>
          {responses.length === 0 ? (
            <p className="text-sm text-ink-muted py-3 text-center">No responses yet.</p>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border">
              {responses.map((r) => (
                <div key={r.responseId} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink truncate">{r.responseId}</p>
                    {r.submittedAt ? (
                      <p className="flex items-center gap-1 text-xs text-status-success mt-0.5">
                        <Check className="size-3" /> Submitted {new Date(r.submittedAt).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-ink-muted mt-0.5">
                        <Clock className="size-3" /> In progress
                      </p>
                    )}
                  </div>
                  <a
                    href={`/tasks/responses/${r.responseId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand hover:text-brand-hover"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Shared ──

function Field({ label, required, hint, children }: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">
        {label}{required && <span className="text-status-error ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-ink-muted mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

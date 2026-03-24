import { useEffect, useState, useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { api } from '../api/client'
import type { TaskResponse } from '../api/types'

export function useTask() {
  const setCode = useSessionStore((s) => s.setCode)
  const code = useSessionStore((s) => s.code)

  const [task, setTask] = useState<TaskResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<string | null>(null)

  // Load task from URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const taskId = params.get('task')
    if (!taskId) return

    setLoading(true)
    setError(null)
    api.getTask(taskId)
      .then((res) => {
        setTask(res)
        setCode(res.code)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load task')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [setCode])

  const submitWork = useCallback(async () => {
    if (!task) return
    setSubmitting(true)
    setSubmitStatus(null)
    try {
      const res = await api.submitTask(task.id, code)
      setSubmitStatus(res.status)
    } catch (err: any) {
      setSubmitStatus('error')
      setError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }, [task, code])

  return { task, loading, error, submitting, submitStatus, submitWork }
}

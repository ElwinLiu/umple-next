import { useState, useCallback, useRef } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import { api } from '../api/client'

/** Shared hook for executing code via the backend. Manages loading state and execution panel visibility. */
export function useExecute() {
  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)

  const execute = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)

    const { showExecutionPanel, toggleExecutionPanel } = useUiStore.getState()
    if (!showExecutionPanel) toggleExecutionPanel()

    const code = useEditorStore.getState().code
    try {
      await api.execute({ code, language: 'Java' })
    } catch {
      // handled in ExecutionPanel
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }, [])

  return { execute, running }
}

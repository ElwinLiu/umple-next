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

    const { showExecutionPanel, toggleExecutionPanel, setExecutionOutput } = useUiStore.getState()
    if (!showExecutionPanel) toggleExecutionPanel()
    setExecutionOutput('')

    const code = useEditorStore.getState().code
    try {
      const result = await api.execute({ code, language: 'Java' })
      setExecutionOutput(result.output || '', result.errors || null)
    } catch (err: unknown) {
      setExecutionOutput('', err instanceof Error ? err.message : 'Execution failed')
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }, [])

  return { execute, running }
}

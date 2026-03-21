import { useState, useCallback, useRef } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import { useDiagram } from './useDiagram'
import { api } from '../api/client'
import { compileAndRefresh } from './useCompiler'

/** Sends code to the backend execute endpoint (code-exec service). */
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
    const language = useUiStore.getState().generatedLanguage
    try {
      const result = await api.execute({ code, language })
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

/** Triggers an immediate compile + diagram refresh (bypasses the auto-compile debounce). */
export function useCompile() {
  const [compiling, setCompiling] = useState(false)
  const compilingRef = useRef(false)
  const { updateFromModel, updateStateDiagramFromModel } = useDiagram()

  const compile = useCallback(async () => {
    if (compilingRef.current) return
    compilingRef.current = true
    setCompiling(true)

    try {
      const { success } = await compileAndRefresh({ updateFromModel, updateStateDiagramFromModel })
      if (success) useUiStore.getState().setExecutionOutput('Compiled successfully.')
    } catch {
      // compileAndRefresh handles error reporting
    } finally {
      compilingRef.current = false
      setCompiling(false)
    }
  }, [updateFromModel, updateStateDiagramFromModel])

  return { compile, compiling }
}

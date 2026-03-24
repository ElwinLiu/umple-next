import { useState, useCallback, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import { useDiagram } from './useDiagram'
import { useIsDark } from './useIsDark'
import { api } from '../api/client'
import { compileAndRefresh } from './useCompiler'

/** Sends code to the backend execute endpoint (code-exec service). */
export function useExecute() {
  const runningRef = useRef(false)

  const execute = useCallback(async (languageOverride?: string) => {
    if (runningRef.current) return
    runningRef.current = true

    const { setExecutionOutput, setOutputView, setExecuting } = useEphemeralStore.getState()
    setOutputView('panel')
    setExecutionOutput('')
    setExecuting(true)

    const code = useSessionStore.getState().code
    const language = languageOverride || useEphemeralStore.getState().generatedLanguage
    try {
      const result = await api.execute({ code, language })
      setExecutionOutput(result.output || '', result.errors || null)
    } catch (err: unknown) {
      setExecutionOutput('', err instanceof Error ? err.message : 'Execution failed')
    } finally {
      runningRef.current = false
      setExecuting(false)
    }
  }, [])

  return { execute }
}

/** Triggers an immediate compile + diagram refresh (bypasses the auto-compile debounce). */
export function useCompile() {
  const [compiling, setCompiling] = useState(false)
  const compilingRef = useRef(false)
  const { updateClassDiagram } = useDiagram()
  const isDark = useIsDark()

  const compile = useCallback(async () => {
    if (compilingRef.current) return
    compilingRef.current = true
    setCompiling(true)

    try {
      const { success } = await compileAndRefresh({ updateClassDiagram }, isDark)
      if (success) {
        useEphemeralStore.getState().setExecutionOutput('Compiled successfully.')
        useEphemeralStore.getState().setOutputView('strip')
      } else {
        // Show strip for warnings-only (errors auto-open panel via setExecutionOutput)
        const { outputWarningCount, outputErrorCount } = useEphemeralStore.getState()
        if (outputWarningCount > 0 && outputErrorCount === 0) {
          useEphemeralStore.getState().setOutputView('strip')
        }
      }
    } catch {
      // compileAndRefresh handles error reporting
    } finally {
      compilingRef.current = false
      setCompiling(false)
    }
  }, [updateClassDiagram, isDark])

  return { compile, compiling }
}

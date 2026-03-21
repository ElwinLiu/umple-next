import { useCallback } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import { api } from '../api/client'

/** Shared hook for generating code via the backend. Reads editor state at call time to avoid re-renders. */
export function useGenerate() {
  const setGeneratedOutput = useUiStore((s) => s.setGeneratedOutput)
  const setGeneratingCode = useUiStore((s) => s.setGeneratingCode)
  const setGeneratedError = useUiStore((s) => s.setGeneratedError)

  const generate = useCallback(async (language: string) => {
    const { code } = useEditorStore.getState()
    const { modelId } = useEditorStore.getState()
    if (!code.trim()) return
    setGeneratingCode(true)
    setGeneratedError(null)
    try {
      const res = await api.generate({ code, language, modelId: modelId ?? undefined })
      setGeneratedOutput(res.output, language)
      if (res.errors) setGeneratedError(res.errors)
    } catch (err: unknown) {
      setGeneratedError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGeneratingCode(false)
    }
  }, [setGeneratedOutput, setGeneratingCode, setGeneratedError])

  return generate
}

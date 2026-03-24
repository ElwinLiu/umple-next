import { useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import { api } from '../api/client'
import { getGenerateTarget, resolveGenerateRequestLanguage } from '../generation/targets'

/** Shared hook for generating code via the backend. Reads editor state at call time to avoid re-renders. */
export function useGenerate() {
  const setGeneratedOutput = useEphemeralStore((s) => s.setGeneratedOutput)
  const setGeneratingCode = useEphemeralStore((s) => s.setGeneratingCode)
  const setGeneratedError = useEphemeralStore((s) => s.setGeneratedError)

  const generate = useCallback(async (targetId: string) => {
    const target = getGenerateTarget(targetId)
    if (!target) return

    if (target.action === 'diagram' && target.diagramView) {
      useSessionStore.getState().setViewMode(target.diagramView)
      useEphemeralStore.getState().setRightPanelView('diagram')
      return
    }

    const { code } = useSessionStore.getState()
    const { modelId } = useSessionStore.getState()
    const { viewMode } = useSessionStore.getState()
    if (!code.trim()) return

    const requestLanguage = resolveGenerateRequestLanguage(target, viewMode)
    setGeneratingCode(true)
    setGeneratedError(null)
    try {
      const res = await api.generate({ code, language: requestLanguage, modelId: modelId ?? undefined })
      setGeneratedOutput(res, target.id)
    } catch (err: unknown) {
      setGeneratedError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGeneratingCode(false)
    }
  }, [setGeneratedOutput, setGeneratingCode, setGeneratedError])

  return generate
}

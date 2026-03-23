import { useCallback } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useDiagramStore } from '../stores/diagramStore'
import { useUiStore } from '../stores/uiStore'
import { api } from '../api/client'
import { getGenerateTarget, resolveGenerateRequestLanguage } from '../generation/targets'

/** Shared hook for generating code via the backend. Reads editor state at call time to avoid re-renders. */
export function useGenerate() {
  const setGeneratedOutput = useUiStore((s) => s.setGeneratedOutput)
  const setGeneratingCode = useUiStore((s) => s.setGeneratingCode)
  const setGeneratedError = useUiStore((s) => s.setGeneratedError)

  const generate = useCallback(async (targetId: string) => {
    const target = getGenerateTarget(targetId)
    if (!target) return

    if (target.action === 'diagram' && target.diagramView) {
      useDiagramStore.getState().setViewMode(target.diagramView)
      useUiStore.getState().setRightPanelView('diagram')
      return
    }

    const { code } = useEditorStore.getState()
    const { modelId } = useEditorStore.getState()
    const { viewMode } = useDiagramStore.getState()
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

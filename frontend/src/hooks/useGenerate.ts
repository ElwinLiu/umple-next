import { useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import { getGenerateTarget } from '../generation/targets'
import { generateAndRefresh } from './useCompiler'
import { useIsDark } from './useIsDark'

/** Shared hook for generating code via the backend. Reads editor state at call time to avoid re-renders. */
export function useGenerate() {
  const isDark = useIsDark()

  const generate = useCallback(async (targetId: string) => {
    const target = getGenerateTarget(targetId)
    if (!target) return

    useSessionStore.getState().setGenerateTargetId(target.id)
    if (target.action === 'diagram' && target.diagramView) {
      useSessionStore.getState().setViewMode(target.diagramView)
      useEphemeralStore.getState().setRightPanelView('diagram')
    } else {
      useEphemeralStore.getState().setRightPanelView('generated')
    }

    await generateAndRefresh(isDark, undefined, target.id)
  }, [isDark])

  return generate
}

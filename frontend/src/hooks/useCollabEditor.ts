import { useMemo } from 'react'
import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import { useCollabStore } from '../stores/collabStore'
import { getYDoc, getAwareness } from './useCollab'

export interface CollabConfig {
  ytext: Y.Text
  awareness: Awareness
}

/**
 * Returns the Yjs collab config for the shared code buffer, or null if not collaborating.
 * Used by EditorPanel to pass into UmpleEditor.
 */
export function useCollabEditor(): CollabConfig | null {
  const isCollaborating = useCollabStore((s) => s.isCollaborating)
  const ready = useCollabStore((s) => s.ready)

  return useMemo(() => {
    if (!isCollaborating || !ready) return null

    const doc = getYDoc()
    const awareness = getAwareness()
    if (!doc || !awareness) return null

    return {
      ytext: doc.getText('code'),
      awareness,
    }
  }, [isCollaborating, ready])
}

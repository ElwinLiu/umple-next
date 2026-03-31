import { useEffect, useRef } from 'react'
import { useCollabStore } from '../stores/collabStore'
import { useSessionStore } from '../stores/sessionStore'

/** The collab room param read once at module load — before any React effect. */
const initialCollabRoomId = new URLSearchParams(window.location.search).get('collab')

/**
 * On mount, checks for `?collab=<roomId>` URL param and auto-joins.
 * Also keeps the URL param in sync with collab state changes.
 */
export function useCollabFromURL() {
  const startCollab = useCollabStore((s) => s.startCollab)
  const isCollaborating = useCollabStore((s) => s.isCollaborating)
  const joinedRef = useRef(false)
  // Track previous value so we only react to true → false transitions,
  // not the initial false on mount (which races with the join effect).
  const wasCollaboratingRef = useRef(false)

  // Auto-join from URL on mount
  useEffect(() => {
    if (initialCollabRoomId && !joinedRef.current) {
      joinedRef.current = true
      // URL-driven collab should not reuse whatever backend model the
      // current tab was editing previously.
      useSessionStore.setState((s) => (
        s.modelId
          ? { modelId: null, tabsVersion: s.tabsVersion + 1 }
          : s
      ))
      startCollab(initialCollabRoomId)
    }
  }, [startCollab])

  // Clean up URL when collab transitions from active → inactive.
  // Restores `?model=` if there's an active model so useModelFromURL stays in sync.
  useEffect(() => {
    if (wasCollaboratingRef.current && !isCollaborating) {
      const url = new URL(window.location.href)
      if (url.searchParams.has('collab')) {
        url.searchParams.delete('collab')
        const modelId = useSessionStore.getState().modelId
        if (modelId) url.searchParams.set('model', modelId)
        window.history.replaceState({}, '', url.toString())
      }
    }
    wasCollaboratingRef.current = isCollaborating
  }, [isCollaborating])
}

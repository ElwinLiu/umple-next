import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useCollabStore } from '../stores/collabStore'
import { isTemporaryModel } from '../lib/modelId'
import { api } from '../api/client'

/** The URL model param read once at module load — before any React effect. */
const initialUrlModelId = new URLSearchParams(window.location.search).get('model')

/**
 * Read the persisted modelId from sessionStorage (Zustand hydrates async, so
 * we read the raw storage to get the value synchronously at module load).
 */
function readStoredModelId(): string | null {
  try {
    const raw = sessionStorage.getItem('umple-session-v1')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.modelId ?? null
  } catch {
    return null
  }
}

const initialStoreModelId = initialUrlModelId ? null : readStoredModelId()

/** The model ID to restore on mount — URL takes priority over sessionStorage. */
const initialModelId = initialUrlModelId ?? initialStoreModelId

/**
 * True once the initial model (from URL or sessionStorage) has been resolved.
 * Exported so useCompiler can defer compilation until the server state is known,
 * preventing stale/empty code from overwriting the server model.
 */
export let urlModelResolved = !initialModelId

/**
 * On mount, reads `?model=<id>` from the URL (or modelId from sessionStorage)
 * and loads the model from the backend. After compilation assigns a modelId,
 * syncs permanent IDs back to the URL so the user can bookmark / share.
 */
export function useModelFromURL() {
  const setCode = useSessionStore((s) => s.setCode)
  const setModelId = useSessionStore((s) => s.setModelId)
  const restoreTabs = useSessionStore((s) => s.restoreTabs)
  const modelId = useSessionStore((s) => s.modelId)

  const resolvedRef = useRef(!initialModelId)

  // Load model from URL or sessionStorage on mount.
  useEffect(() => {
    if (!initialModelId) return

    const abort = new AbortController()

    api.getModel(initialModelId, abort.signal)
      .then((res) => {
        if (abort.signal.aborted) return
        if (res.tabs?.length) {
          restoreTabs(res.tabs, res.activeTabId ?? res.tabs[0].id)
        } else {
          setCode(res.code)
        }
        setModelId(res.modelId)

        // Auto-start collab for permanent models loaded from the URL.
        // Permanent model URLs are always collab-enabled — if a room exists
        // the user joins it; otherwise a new room is created.
        if (initialUrlModelId && !isTemporaryModel(res.modelId)) {
          useCollabStore.getState().startCollab(res.modelId)
        }
      })
      .catch((err) => {
        if (abort.signal.aborted || err.name === 'AbortError') return
        // Model not found or expired — clean up
        if (initialUrlModelId) {
          const url = new URL(window.location.href)
          url.searchParams.delete('model')
          window.history.replaceState({}, '', url.toString())
        }
        // Clear stale modelId and bump tabsVersion so the compile effect
        // fires with a clean slate.
        useSessionStore.setState((s) => ({
          modelId: null,
          tabsVersion: s.tabsVersion + 1,
        }))
      })
      .finally(() => {
        if (abort.signal.aborted) return
        urlModelResolved = true
        resolvedRef.current = true
        // Force the compile effect to re-fire now that urlModelResolved is true.
        useSessionStore.setState((s) => ({ tabsVersion: s.tabsVersion + 1 }))
      })

    return () => abort.abort()
  }, [setCode, setModelId, restoreTabs])

  // Sync modelId to URL whenever it changes — only for permanent IDs.
  useEffect(() => {
    if (!resolvedRef.current) return

    const url = new URL(window.location.href)
    if (modelId && !isTemporaryModel(modelId)) {
      url.searchParams.set('model', modelId)
    } else {
      url.searchParams.delete('model')
    }
    window.history.replaceState({}, '', url.toString())
  }, [modelId])
}

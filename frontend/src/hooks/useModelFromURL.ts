import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useCollabStore } from '../stores/collabStore'
import { api } from '../api/client'

/** The URL model param read once at module load — before any React effect. */
const initialUrlModelId = new URLSearchParams(window.location.search).get('model')

/**
 * True once the initial URL model has been resolved (loaded or failed).
 * Exported so useCompiler can defer compilation until the server state is known,
 * preventing stale sessionStorage data from overwriting the server model.
 */
export let urlModelResolved = !initialUrlModelId

/**
 * On mount, reads `?model=<id>` from the URL and loads the model from the
 * backend (URL takes priority over sessionStorage). After compilation assigns
 * a modelId, syncs it back to the URL so the user can bookmark / share.
 */
export function useModelFromURL() {
  const setCode = useSessionStore((s) => s.setCode)
  const setModelId = useSessionStore((s) => s.setModelId)
  const restoreTabs = useSessionStore((s) => s.restoreTabs)
  const modelId = useSessionStore((s) => s.modelId)

  // True once the initial URL model has been resolved (loaded or failed).
  // Until then, don't let the sessionStorage modelId overwrite the URL.
  const resolvedRef = useRef(!initialUrlModelId)

  // Load model from URL on mount.
  // AbortController ensures React StrictMode's double-mount doesn't fire two
  // fetches that each bump tabsVersion and trigger duplicate compilations.
  useEffect(() => {
    if (!initialUrlModelId) return

    const abort = new AbortController()

    api.getModel(initialUrlModelId, abort.signal)
      .then((res) => {
        if (abort.signal.aborted) return
        if (res.tabs?.length) {
          restoreTabs(res.tabs, res.activeTabId ?? res.tabs[0].id)
        } else {
          setCode(res.code)
        }
        setModelId(res.modelId)
      })
      .catch((err) => {
        if (abort.signal.aborted || err.name === 'AbortError') return
        // Model not found or expired — remove the stale param
        const url = new URL(window.location.href)
        url.searchParams.delete('model')
        window.history.replaceState({}, '', url.toString())
        // Clear stale modelId from sessionStorage and bump tabsVersion
        // so the compile effect fires with a clean slate.
        useSessionStore.setState((s) => ({
          modelId: null,
          tabsVersion: s.tabsVersion + 1,
        }))
      })
      .finally(() => {
        if (abort.signal.aborted) return
        urlModelResolved = true
        resolvedRef.current = true
        // Force the compile effect to re-fire now that urlModelResolved is true,
        // even if code/modelId didn't change (e.g., sessionStorage matches server).
        useSessionStore.setState((s) => ({ tabsVersion: s.tabsVersion + 1 }))
      })

    return () => abort.abort()
  }, [setCode, setModelId, restoreTabs])

  // Sync modelId to URL whenever it changes
  useEffect(() => {
    if (!resolvedRef.current) return

    // Don't touch the URL during collab mode.
    if (useCollabStore.getState().isCollaborating) return

    const url = new URL(window.location.href)
    if (modelId) {
      url.searchParams.set('model', modelId)
    } else {
      url.searchParams.delete('model')
    }
    window.history.replaceState({}, '', url.toString())
  }, [modelId])
}

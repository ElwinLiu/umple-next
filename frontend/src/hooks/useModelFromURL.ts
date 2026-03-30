import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { api } from '../api/client'

/** The URL model param read once at module load — before any React effect. */
const initialUrlModelId = new URLSearchParams(window.location.search).get('model')

/**
 * On mount, reads `?model=<id>` from the URL and loads the model from the
 * backend (URL takes priority over sessionStorage). After compilation assigns
 * a modelId, syncs it back to the URL so the user can bookmark / share.
 */
export function useModelFromURL() {
  const setCode = useSessionStore((s) => s.setCode)
  const setModelId = useSessionStore((s) => s.setModelId)
  const modelId = useSessionStore((s) => s.modelId)

  // True once the initial URL model has been resolved (loaded or failed).
  // Until then, don't let the sessionStorage modelId overwrite the URL.
  const resolvedRef = useRef(!initialUrlModelId)

  // Load model from URL on mount
  useEffect(() => {
    if (!initialUrlModelId) return

    api.getModel(initialUrlModelId)
      .then((res) => {
        setCode(res.code)
        setModelId(res.modelId)
      })
      .catch(() => {
        // Model not found or expired — remove the stale param
        const url = new URL(window.location.href)
        url.searchParams.delete('model')
        window.history.replaceState({}, '', url.toString())
      })
      .finally(() => {
        resolvedRef.current = true
      })
  }, [setCode, setModelId])

  // Sync modelId to URL whenever it changes
  useEffect(() => {
    if (!resolvedRef.current) return

    // Don't overwrite task URLs
    const params = new URLSearchParams(window.location.search)
    if (params.has('task')) return

    const url = new URL(window.location.href)
    if (modelId) {
      url.searchParams.set('model', modelId)
    } else {
      url.searchParams.delete('model')
    }
    window.history.replaceState({}, '', url.toString())
  }, [modelId])
}

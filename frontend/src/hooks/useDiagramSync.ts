import { useCallback, useRef } from 'react'
import { api } from '../api/client'
import { useSessionStore } from '../stores/sessionStore'

interface SyncResult {
  success: boolean
  code?: string
  error?: string
}

/**
 * Extracts the sync pattern into a reusable hook.
 * sync(action, params) → api.sync() → editorStore.setCodeFromSync(response.code)
 *
 * Calling setCodeFromSync triggers the existing useCompiler debounce → compileAndRefresh() →
 * diagram updates from backend-authoritative state.
 */
export function useDiagramSync() {
  const inflightRef = useRef(0)
  // Serializes requests that need a modelId: the first request creates the
  // model and subsequent ones wait for it before proceeding.
  const modelIdPromiseRef = useRef<Promise<string> | null>(null)

  const sync = useCallback(async (
    action: string,
    params: Record<string, string>,
  ): Promise<SyncResult> => {
    let modelId = useSessionStore.getState().modelId ?? ''

    // If another request is already creating a model, wait for it
    if (!modelId && modelIdPromiseRef.current) {
      modelId = await modelIdPromiseRef.current
    }

    let ownsGate = false
    let resolveGate: ((id: string) => void) | undefined
    if (!modelId) {
      ownsGate = true
      // First request without a modelId — create a gate for subsequent callers
      modelIdPromiseRef.current = new Promise<string>((r) => {
        resolveGate = r
      })
    }

    inflightRef.current++
    try {
      const response = await api.sync({
        action,
        modelId,
        params,
      })

      // Capture modelId from response if we didn't have one
      if (response.modelId && !modelId) {
        useSessionStore.getState().setModelId(response.modelId)
        resolveGate?.(response.modelId)
        ownsGate = false
        modelIdPromiseRef.current = null
      }

      // Always apply the code update — the backend reads from the file on
      // disk which reflects the actual state, even when umplesync also
      // produces warnings/errors.
      if (response.code) {
        useSessionStore.getState().setCodeFromSync(response.code)
      }

      if (response.errors) {
        console.warn(`Diagram sync warning (${action}):`, response.errors)
        return { success: true, code: response.code, error: response.errors }
      }

      return { success: true, code: response.code }
    } catch (err: any) {
      console.warn(`Diagram sync failed (${action}):`, err.message)
      return { success: false, error: err.message }
    } finally {
      inflightRef.current--
      // If we owned the gate but never resolved it (request failed or
      // no modelId in response), resolve with '' so waiters retry
      // instead of blocking forever.
      if (ownsGate) {
        resolveGate?.('')
        modelIdPromiseRef.current = null
      }
    }
  }, [])

  return { sync }
}

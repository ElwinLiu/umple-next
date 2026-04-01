import { useEffect, useRef } from 'react'
import { useSessionStore, type DiagramView } from '../stores/sessionStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import { urlModelResolved } from './useModelFromURL'
import {
  usePreferencesStore,
  getEffectiveDiagramType,
  buildSuboptions,
  selectSuboptionsKey,
} from '../stores/preferencesStore'
import { useIsDark } from './useIsDark'
import { api } from '../api/client'
import type { UmpleModel, GvLayout, StoredLayoutMetadata } from '../api/types'


const DEBOUNCE_MS = 1500

/** Build the diagram request params from current store state + isDark flag. */
function getDiagramRequestParams(view: DiagramView, isDark: boolean) {
  const s = usePreferencesStore.getState()
  return {
    diagramType: getEffectiveDiagramType(view, s.showTraits),
    suboptions: buildSuboptions(s, view, isDark),
    needsLayout: view === 'class',
  }
}

/** Core compile + diagram refresh. Shared by auto-compile and manual compile.
 *  Returns { success, model } so callers can cache the parsed model. */
export async function compileAndRefresh(
  isDark: boolean,
  signal?: AbortSignal,
): Promise<{ success: boolean; model: UmpleModel | null }> {
  const { code, modelId, setModelId, setUmpleModel, tabs, activeTabId } = useSessionStore.getState()
  const { viewMode, clearSvgCache, clearHtmlCache, setSvgForView, setHtmlForView } = useSessionStore.getState()
  const { setCompiling, setExecutionOutput } = useEphemeralStore.getState()

  if (!code.trim()) return { success: false, model: null }

  setCompiling(true)
  setExecutionOutput('')
  clearSvgCache()
  clearHtmlCache()

  let success = false
  let model: UmpleModel | null = null

  try {
    const diagramParams = getDiagramRequestParams(viewMode, isDark)

    // Single request: compile + diagram generation
    const res = await api.compile({
      code,
      modelId: modelId ?? undefined,
      ...diagramParams,
      tabs: tabs.map(({ id, name, code }) => ({ id, name, code })),
      activeTabId,
    }, signal)

    // Read current modelId from the store (not the stale closure value) to
    // avoid overwriting a modelId that was set by useModelFromURL while the
    // compile request was in flight.
    if (res.modelId && !useSessionStore.getState().modelId) setModelId(res.modelId)
    if (res.result) {
      try {
        model = JSON.parse(res.result)
      } catch {}
    }

    // Handle diagram output from the merged response
    if (res.svg) setSvgForView(viewMode, res.svg)
    if (res.html) setHtmlForView(viewMode, res.html)

    const gvLayout: GvLayout | undefined = res.layout
    const storedLayout: StoredLayoutMetadata | null = res.storedLayout ?? null

    if (res.errors) {
      setExecutionOutput('', res.errors)
    } else {
      success = true
    }

    // Store the parsed model and layout for UmpleDiagram
    if (model) {
      setUmpleModel(
        model,
        viewMode === 'class' ? gvLayout ?? null : undefined,
        viewMode === 'class' ? storedLayout : undefined,
      )
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err
    const msg = err.message || 'Compilation failed'
    setExecutionOutput('', msg)
  } finally {
    setCompiling(false)
  }

  return { success, model }
}

export function useCompiler() {
  const code = useSessionStore((s) => s.code)
  const modelId = useSessionStore((s) => s.modelId)
  const tabsVersion = useSessionStore((s) => s.tabsVersion)
  const viewMode = useSessionStore((s) => s.viewMode)
  const setSvgForView = useSessionStore((s) => s.setSvgForView)
  const setHtmlForView = useSessionStore((s) => s.setHtmlForView)
  const suboptionsKey = usePreferencesStore(selectSuboptionsKey)
  const isDark = useIsDark()

  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = useRef<AbortController>(undefined)
  const diagramAbortRef = useRef<AbortController>(undefined)
  const lastModelRef = useRef<UmpleModel | null>(null)

  const codeRef = useRef(code)
  codeRef.current = code
  const modelIdRef = useRef(modelId)
  modelIdRef.current = modelId
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  // Track whether mount has completed to skip initial effect fires
  const mountedRef = useRef(false)
  const initialCompileRef = useRef(true)
  useEffect(() => { mountedRef.current = true }, [])

  // Main compile effect — debounced on code/modelId changes.
  // Diagram-sync edits set syncPending, which skips the debounce so the
  // diagram refreshes immediately after a user interaction.
  useEffect(() => {
    // Don't compile until any URL model has been resolved — sessionStorage
    // may contain stale data that would overwrite the server model.
    if (!urlModelResolved) return

    if (timerRef.current) clearTimeout(timerRef.current)

    const { syncPending, clearSyncPending } = useSessionStore.getState()
    if (syncPending) clearSyncPending()

    const isInitial = initialCompileRef.current
    const delay = syncPending || isInitial ? 0 : DEBOUNCE_MS

    timerRef.current = setTimeout(async () => {
      // Preserve the initial immediate compile across React StrictMode's
      // mount-time effect replay in development. If we flip this flag before
      // the timer runs, the replayed effect falls back to the debounce delay.
      if (initialCompileRef.current && codeRef.current.trim()) {
        initialCompileRef.current = false
      }

      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      try {
        const result = await compileAndRefresh(
          isDarkRef.current,
          abortRef.current.signal,
        )
        if (result.model) lastModelRef.current = result.model
      } catch (err: any) {
        if (err.name !== 'AbortError') throw err
      }
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [code, modelId, tabsVersion])

  // When viewMode, display preferences, or dark theme change, re-fetch diagram only
  useEffect(() => {
    if (!mountedRef.current) return
    const currentCode = codeRef.current
    const currentModelId = modelIdRef.current
    if (!currentCode?.trim() || !currentModelId) return

    fetchDiagramSvg(currentCode, viewModeRef.current, currentModelId)
  }, [viewMode, suboptionsKey, isDark])

  async function fetchDiagramSvg(umpleCode: string, view: DiagramView, mid: string) {
    // Abort previous diagram request
    if (diagramAbortRef.current) diagramAbortRef.current.abort()
    diagramAbortRef.current = new AbortController()

    try {
      const res = await api.diagram({
        code: umpleCode,
        modelId: mid,
        ...getDiagramRequestParams(view, isDarkRef.current),
      })
      if (res.svg) {
        setSvgForView(view, res.svg)
      }
      if (res.html) {
        setHtmlForView(view, res.html)
      }
      if (view === 'class' && lastModelRef.current) {
        useSessionStore.getState().setUmpleModel(lastModelRef.current, res.layout ?? null, res.storedLayout ?? null)
      }
      if (res.errors) {
        useEphemeralStore.getState().setExecutionOutput('', res.errors)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Don't overwrite compile errors — diagram fetch is secondary
        console.warn('Diagram SVG fetch failed:', err.message)
      }
    }
  }
}

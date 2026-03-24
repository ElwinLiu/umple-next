import { useEffect, useRef } from 'react'
import { useSessionStore, type DiagramView } from '../stores/sessionStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import {
  usePreferencesStore,
  getEffectiveDiagramType,
  buildSuboptions,
  selectSuboptionsKey,
} from '../stores/preferencesStore'
import { useIsDark } from './useIsDark'
import { useDiagram } from './useDiagram'
import { api } from '../api/client'
import type { UmpleModel, GvLayout } from '../api/types'


const DEBOUNCE_MS = 1500

interface CompileCallbacks {
  updateClassDiagram: (model: UmpleModel, gvLayout?: GvLayout) => void
}

/** Build the diagram request params from current store state + isDark flag. */
function getDiagramRequestParams(code: string, view: DiagramView, modelId: string, isDark: boolean) {
  const s = usePreferencesStore.getState()
  return {
    code,
    diagramType: getEffectiveDiagramType(view, s.showTraits),
    modelId,
    suboptions: buildSuboptions(s, view, isDark),
  }
}

/** Core compile + diagram refresh. Shared by auto-compile and manual compile.
 *  Returns { success, model } so callers can cache the parsed model. */
export async function compileAndRefresh(
  callbacks: CompileCallbacks,
  isDark: boolean,
  signal?: AbortSignal,
): Promise<{ success: boolean; model: UmpleModel | null }> {
  const { code, modelId, setModelId } = useSessionStore.getState()
  const { viewMode, clearSvgCache, clearHtmlCache, setSvgForView, setHtmlForView } = useSessionStore.getState()
  const { setCompiling, setLastError } = useEphemeralStore.getState()
  const { setExecutionOutput } = useEphemeralStore.getState()

  if (!code.trim()) return { success: false, model: null }

  setCompiling(true)
  setLastError(null)
  setExecutionOutput('')
  clearSvgCache()
  clearHtmlCache()

  let success = false
  let model: UmpleModel | null = null

  try {
    const res = await api.compile({ code, modelId: modelId ?? undefined }, signal)

    if (res.modelId && !modelId) setModelId(res.modelId)
    if (res.result) {
      try {
        model = JSON.parse(res.result)
      } catch {}
    }

    if (res.errors) {
      setLastError(res.errors)
      setExecutionOutput('', res.errors)
    } else {
      success = true
    }

    // Fetch diagram SVG + layout
    let gvLayout: GvLayout | undefined
    const currentModelId = res.modelId || modelId
    if (currentModelId) {
      try {
        const svgRes = await api.diagram(getDiagramRequestParams(code, viewMode, currentModelId, isDark))
        if (svgRes.svg) setSvgForView(viewMode, svgRes.svg)
        if (svgRes.html) setHtmlForView(viewMode, svgRes.html)
        gvLayout = svgRes.layout
        if (svgRes.errors) {
          setLastError(svgRes.errors)
          setExecutionOutput('', svgRes.errors)
          success = false
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Diagram SVG fetch failed:', err.message)
        }
      }
    }

    if (model && viewMode === 'class') {
      callbacks.updateClassDiagram(model, gvLayout)
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err
    const msg = err.message || 'Compilation failed'
    setLastError(msg)
    setExecutionOutput('', msg)
  } finally {
    setCompiling(false)
  }

  return { success, model }
}

export function useCompiler() {
  const code = useSessionStore((s) => s.code)
  const modelId = useSessionStore((s) => s.modelId)
  const viewMode = useSessionStore((s) => s.viewMode)
  const setSvgForView = useSessionStore((s) => s.setSvgForView)
  const setHtmlForView = useSessionStore((s) => s.setHtmlForView)
  const setLastError = useEphemeralStore((s) => s.setLastError)
  const suboptionsKey = usePreferencesStore(selectSuboptionsKey)
  const isDark = useIsDark()
  const { updateClassDiagram } = useDiagram()

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
  useEffect(() => { mountedRef.current = true }, [])

  // Main compile effect — debounced on code/modelId changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      try {
        const result = await compileAndRefresh(
          { updateClassDiagram },
          isDarkRef.current,
          abortRef.current.signal,
        )
        if (result.model) lastModelRef.current = result.model
      } catch (err: any) {
        if (err.name !== 'AbortError') throw err
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [code, modelId])

  // When viewMode, display preferences, or dark theme change, re-fetch diagram SVG
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
      const res = await api.diagram(getDiagramRequestParams(umpleCode, view, mid, isDarkRef.current))
      if (res.svg) {
        setSvgForView(view, res.svg)
      }
      if (res.html) {
        setHtmlForView(view, res.html)
      }
      if (view === 'class' && lastModelRef.current) {
        updateClassDiagram(lastModelRef.current, res.layout)
      }
      if (res.errors) {
        setLastError(res.errors)
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

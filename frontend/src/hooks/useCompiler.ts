import { useEffect, useRef } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import { useDiagramStore, VIEW_TO_GV_TYPE, type DiagramView } from '../stores/diagramStore'
import { useDiagram } from './useDiagram'
import { api } from '../api/client'
import type { UmpleModel, GvLayout } from '../api/types'

const DEBOUNCE_MS = 1500

interface CompileCallbacks {
  updateFromModel: (model: UmpleModel, gvLayout?: GvLayout) => void
  updateStateDiagramFromModel: (model: UmpleModel) => void
}

/** Core compile + diagram refresh. Shared by auto-compile and manual compile.
 *  Returns { success, model } so callers can cache the parsed model. */
export async function compileAndRefresh(
  callbacks: CompileCallbacks,
  signal?: AbortSignal,
): Promise<{ success: boolean; model: UmpleModel | null }> {
  const { code, modelId, setModelId } = useEditorStore.getState()
  const { viewMode, setCompiling, setLastError, clearSvgCache, setSvgForView } = useDiagramStore.getState()
  const { setExecutionOutput } = useUiStore.getState()

  if (!code.trim()) return { success: false, model: null }

  setCompiling(true)
  setLastError(null)
  setExecutionOutput('')
  clearSvgCache()

  let success = false
  let model: UmpleModel | null = null

  try {
    const res = await api.compile({ code, modelId: modelId ?? undefined }, signal)

    if (res.modelId && !modelId) setModelId(res.modelId)
    if (res.result) {
      try {
        model = JSON.parse(res.result)
        // State diagram doesn't use GV layout — update immediately
        callbacks.updateStateDiagramFromModel(model!)
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
    const gvType = VIEW_TO_GV_TYPE[viewMode]
    if (currentModelId && gvType) {
      try {
        const svgRes = await api.diagram({ code, diagramType: gvType, modelId: currentModelId })
        if (svgRes.svg) setSvgForView(viewMode, svgRes.svg)
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

    // Update class diagram with GV positions (or grid fallback if no layout)
    if (model) callbacks.updateFromModel(model, gvLayout)
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
  const code = useEditorStore((s) => s.code)
  const modelId = useEditorStore((s) => s.modelId)
  const viewMode = useDiagramStore((s) => s.viewMode)
  const setSvgForView = useDiagramStore((s) => s.setSvgForView)
  const setLastError = useDiagramStore((s) => s.setLastError)
  const { updateFromModel, updateStateDiagramFromModel } = useDiagram()

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

  // Main compile effect — debounced on code/modelId changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      try {
        const result = await compileAndRefresh(
          { updateFromModel, updateStateDiagramFromModel },
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

  // When viewMode changes, fetch the SVG for the new diagram type
  useEffect(() => {
    const currentCode = codeRef.current
    const currentModelId = modelIdRef.current
    if (!currentCode?.trim() || !currentModelId) return

    fetchDiagramSvg(currentCode, viewMode, currentModelId)
  }, [viewMode])

  async function fetchDiagramSvg(umpleCode: string, view: DiagramView, mid: string) {
    // Abort previous diagram request
    if (diagramAbortRef.current) diagramAbortRef.current.abort()
    diagramAbortRef.current = new AbortController()

    const gvType = VIEW_TO_GV_TYPE[view]
    if (!gvType) return

    try {
      const res = await api.diagram({
        code: umpleCode,
        diagramType: gvType,
        modelId: mid,
      })
      if (res.svg) {
        setSvgForView(view, res.svg)
      }
      // Update class diagram positions with new GV layout for this view
      if (res.layout && lastModelRef.current) {
        updateFromModel(lastModelRef.current, res.layout)
      }
      if (res.errors) {
        setLastError(res.errors)
        useUiStore.getState().setExecutionOutput('', res.errors)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Don't overwrite compile errors — diagram fetch is secondary
        console.warn('Diagram SVG fetch failed:', err.message)
      }
    }
  }
}

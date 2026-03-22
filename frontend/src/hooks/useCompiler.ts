import { useEffect, useRef } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import {
  useDiagramStore,
  getEffectiveDiagramType,
  buildSuboptions,
  selectSuboptionsKey,
  type DiagramView,
} from '../stores/diagramStore'
import { useIsDark } from './useIsDark'
import { useDiagram } from './useDiagram'
import { api } from '../api/client'
import type { UmpleModel, UmpleStateMachine, GvLayout } from '../api/types'

const DEBOUNCE_MS = 1500

interface CompileCallbacks {
  updateFromModel: (model: UmpleModel, gvLayout?: GvLayout) => void
  updateStateDiagramFromGv: (stateMachines: UmpleStateMachine[], gvLayout?: GvLayout) => void
}

/** Build the diagram request params from current store state + isDark flag. */
function getDiagramRequestParams(code: string, view: DiagramView, modelId: string, isDark: boolean) {
  const s = useDiagramStore.getState()
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
        gvLayout = svgRes.layout
        // Update state diagram from GV-parsed data
        if (viewMode === 'state' && svgRes.stateMachines) {
          callbacks.updateStateDiagramFromGv(svgRes.stateMachines, svgRes.layout)
        }
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
  const suboptionsKey = useDiagramStore(selectSuboptionsKey)
  const isDark = useIsDark()
  const { updateFromModel, updateStateDiagramFromGv } = useDiagram()

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
          { updateFromModel, updateStateDiagramFromGv },
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
      // Update ReactFlow nodes from diagram response
      if (view === 'class' && res.layout && lastModelRef.current) {
        updateFromModel(lastModelRef.current, res.layout)
      } else if (view === 'state' && res.stateMachines?.length) {
        updateStateDiagramFromGv(res.stateMachines, res.layout)
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

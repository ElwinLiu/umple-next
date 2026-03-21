import { useEffect, useRef } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useDiagramStore, VIEW_TO_GV_TYPE, type DiagramView } from '../stores/diagramStore'
import { useDiagram } from './useDiagram'
import { api } from '../api/client'
import type { UmpleModel } from '../api/types'

const DEBOUNCE_MS = 1500

export function useCompiler() {
  const code = useEditorStore((s) => s.code)
  const modelId = useEditorStore((s) => s.modelId)
  const setModelId = useEditorStore((s) => s.setModelId)
  const viewMode = useDiagramStore((s) => s.viewMode)
  const setCompiling = useDiagramStore((s) => s.setCompiling)
  const setLastError = useDiagramStore((s) => s.setLastError)
  const setSvgForView = useDiagramStore((s) => s.setSvgForView)
  const clearSvgCache = useDiagramStore((s) => s.clearSvgCache)
  const { updateFromModel, updateStateDiagramFromModel } = useDiagram()

  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = useRef<AbortController>(undefined)
  const diagramAbortRef = useRef<AbortController>(undefined)

  // Track the latest modelId in a ref so the viewMode effect can read it
  const modelIdRef = useRef(modelId)
  modelIdRef.current = modelId
  const codeRef = useRef(code)
  codeRef.current = code
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode

  // Main compile effect — triggers on code/modelId changes
  // Always does JSON compile (for class diagram ReactFlow data)
  // Then fetches the SVG for the current viewMode
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      if (!code.trim()) return

      // Abort previous in-flight request
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      setCompiling(true)
      setLastError(null)
      clearSvgCache()

      try {
        const res = await api.compile({
          code,
          modelId: modelId ?? undefined,
        }, abortRef.current.signal)

        // Store the model ID for subsequent requests
        if (res.modelId && !modelId) {
          setModelId(res.modelId)
        }

        // Parse the JSON model result (for class diagram ReactFlow)
        if (res.result) {
          try {
            const model: UmpleModel = JSON.parse(res.result)
            updateFromModel(model)
            updateStateDiagramFromModel(model)
          } catch {
            // Result might not be JSON yet
          }
        }

        if (res.errors) {
          setLastError(res.errors)
        }

        // After JSON compile, fetch SVG for current view
        const currentModelId = res.modelId || modelId
        if (currentModelId) {
          fetchDiagramSvg(code, viewModeRef.current, currentModelId)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setLastError(err.message || 'Compilation failed')
        }
      } finally {
        setCompiling(false)
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
      if (res.errors) {
        setLastError(res.errors)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Don't overwrite compile errors — diagram fetch is secondary
        console.warn('Diagram SVG fetch failed:', err.message)
      }
    }
  }
}

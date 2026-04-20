import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useSessionStore, type DiagramView } from '../stores/sessionStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import { useCollabStore } from '../stores/collabStore'
import { getYDoc } from './useCollab'
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
import { getGenerateTarget, resolveGenerateRequestLanguage } from '../generation/targets'

/** Diagram-only messages that are transient (not real compilation errors).
 *  Matched via exact equality (case-insensitive, trimmed) to avoid
 *  accidentally swallowing unrelated errors that contain a substring. */
const DIAGRAM_TOAST_MESSAGES = new Set([
  'no diagram output generated',
])

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

/** Split an error string into real panel errors and transient toast messages. */
function splitDiagramToasts(errors: string): { panelErrors: string; toastMessages: string[] } {
  const toastMessages: string[] = []
  const remaining = errors.split('\n').filter((line) => {
    const trimmed = line.trim()
    if (DIAGRAM_TOAST_MESSAGES.has(trimmed.toLowerCase())) {
      toastMessages.push(trimmed)
      return false
    }
    return true
  })
  return { panelErrors: remaining.join('\n').trim(), toastMessages }
}

/** Core output generation + refresh. Shared by dynamic generation and manual regenerate.
 *  Returns { success, model } so callers can cache the parsed model. */
export async function generateAndRefresh(
  isDark: boolean,
  signal?: AbortSignal,
  targetId?: string,
): Promise<{ success: boolean; model: UmpleModel | null }> {
  const { code, modelId, setModelId, setUmpleModel, tabs, activeTabId, generateTargetId, viewMode } = useSessionStore.getState()
  const { clearSvgCache, clearHtmlCache, setSvgForView, setHtmlForView } = useSessionStore.getState()
  const { setGeneratingOutput, setExecutionOutput, setGeneratingCode, setGeneratedError, setGeneratedOutput } = useEphemeralStore.getState()
  const target = getGenerateTarget(targetId ?? generateTargetId)

  if (!code.trim() || !target) return { success: false, model: null }

  setGeneratingOutput(true)
  setExecutionOutput('')
  if (target.action === 'generate') {
    setGeneratingCode(true, target.id)
    setGeneratedError(null)
  }

  let success = false
  let model: UmpleModel | null = null

  try {
    const activeView = target.action === 'diagram' ? target.diagramView ?? viewMode : viewMode

    // In collab mode, read tab content from Y.Text (authoritative) instead
    // of the possibly-stale sessionStore cache for non-active tabs.
    const doc = useCollabStore.getState().isCollaborating ? getYDoc() : null
    const compileTabs = tabs.map(({ id, name, code: localCode }) => ({
      id,
      name,
      code: doc ? doc.getText(`tab:${id}`).toString() : localCode,
    }))

    // Single request: compile + diagram generation
    const request =
      target.action === 'diagram'
        ? {
            code,
            modelId: modelId ?? undefined,
            ...getDiagramRequestParams(activeView, isDark),
            tabs: compileTabs,
            activeTabId,
          }
        : {
            code,
            modelId: modelId ?? undefined,
            language: resolveGenerateRequestLanguage(target, viewMode),
            tabs: compileTabs,
            activeTabId,
          }

    const res = await api.generate(request, signal)

    // If the user switched tabs while the request was in flight, discard the
    // results — they belong to the old tab, not the current one.
    if (useSessionStore.getState().activeTabId !== activeTabId) {
      return { success: false, model: null }
    }

    // Clear old caches only after the response arrives (not eagerly at the
    // start) so that if the user switches tabs mid-compile, setActiveTab
    // snapshots the previous diagram — not empty caches.
    if (target.action === 'diagram') {
      clearSvgCache()
      clearHtmlCache()
    }

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
    if (target.action === 'diagram') {
      if (res.svg) setSvgForView(activeView, res.svg)
      if (res.html) setHtmlForView(activeView, res.html)

      const gvLayout: GvLayout | undefined = res.layout
      const storedLayout: StoredLayoutMetadata | null = res.storedLayout ?? null

      if (res.errors) {
        // Separate transient diagram messages (shown as toasts) from real
        // compilation errors (shown in the output panel).
        const { panelErrors, toastMessages } = splitDiagramToasts(res.errors)
        for (const msg of toastMessages) toast.info(msg, { id: 'diagram-info' })
        if (panelErrors) {
          setExecutionOutput('', panelErrors)
        } else {
          success = true
        }
      } else {
        success = true
      }
  
      // Store the parsed model and layout for UmpleDiagram
      if (model) {
        setUmpleModel(
          model,
          activeView === 'class' ? gvLayout ?? null : undefined,
          activeView === 'class' ? storedLayout : undefined,
        )
      }
    } else {
      const requestLanguage = resolveGenerateRequestLanguage(target, viewMode)
      const hasInlineGeneratedPayload = Boolean(
        res.generatedOutput ||
        res.generatedHtml ||
        res.generatedIframeUrl ||
        (res.generatedDownloads && res.generatedDownloads.length > 0)
      )

      if (hasInlineGeneratedPayload) {
        setGeneratedOutput({
          output: res.generatedOutput ?? '',
          language: res.generatedLanguage ?? requestLanguage,
          errors: res.errors,
          kind: res.generatedKind,
          html: res.generatedHtml,
          iframeUrl: res.generatedIframeUrl,
          downloads: res.generatedDownloads,
          modelId: res.modelId,
        }, target.id)

        if (res.errors) {
          setExecutionOutput('', res.errors)
        } else {
          success = true
        }
      } else {
        const msg = `Generation API returned no generated output for ${requestLanguage}.`
        setGeneratedError(msg)
        setExecutionOutput('', msg)
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err
    const msg = err.message || 'Generation failed'
    setExecutionOutput('', msg)
    if (target.action === 'generate') {
      setGeneratedError(msg)
    }
  } finally {
    setGeneratingOutput(false)
    if (target.action === 'generate') {
      setGeneratingCode(false)
    }
  }

  return { success, model }
}

export function useCompiler() {
  const code = useSessionStore((s) => s.code)
  const modelId = useSessionStore((s) => s.modelId)
  const tabsVersion = useSessionStore((s) => s.tabsVersion)
  const viewMode = useSessionStore((s) => s.viewMode)
  const generateTargetId = useSessionStore((s) => s.generateTargetId)
  const dynamicGeneration = usePreferencesStore((s) => s.dynamicGeneration)
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
  const generateTargetIdRef = useRef(generateTargetId)
  generateTargetIdRef.current = generateTargetId
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  // Track whether mount has completed to skip initial effect fires
  const mountedRef = useRef(false)
  const initialCompileRef = useRef(true)
  useEffect(() => { mountedRef.current = true }, [])

  // Main generation effect — debounced on code changes.
  // Diagram-sync edits set syncPending, which skips the debounce so the
  // diagram refreshes immediately after a user interaction.
  useEffect(() => {
    // Don't compile until any URL model has been resolved — sessionStorage
    // may contain stale data that would overwrite the server model.
    if (!urlModelResolved) return

    if (timerRef.current) clearTimeout(timerRef.current)
    if (!dynamicGeneration) return

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
        const result = await generateAndRefresh(
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
    // modelId intentionally excluded — generateAndRefresh reads it from the
    // store, and every legitimate modelId change is accompanied by a code or
    // tabsVersion change.  Including it here caused a feedback loop: first
    // compile assigns a modelId → dep changes → second (redundant) compile.
  }, [dynamicGeneration, code, tabsVersion])

  // When diagram display preferences or dark theme change, re-fetch diagram only
  useEffect(() => {
    if (!mountedRef.current) return
    const activeTarget = getGenerateTarget(generateTargetIdRef.current)
    if (activeTarget?.action !== 'diagram') return
    if (viewModeRef.current === 'crud') return // CRUD UI is a local component, no backend diagram
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
        activeTabId: useSessionStore.getState().activeTabId,
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
        const { panelErrors, toastMessages } = splitDiagramToasts(res.errors)
        for (const msg of toastMessages) toast.info(msg, { id: 'diagram-info' })
        if (panelErrors) useEphemeralStore.getState().setExecutionOutput('', panelErrors)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      const msg = err.message || ''
      if (DIAGRAM_TOAST_MESSAGES.has(msg.toLowerCase().trim())) {
        toast.info(msg, { id: 'diagram-info' })
      } else {
        // Don't overwrite compile errors — diagram fetch is secondary
        console.warn('Diagram SVG fetch failed:', msg)
      }
    }
  }
}

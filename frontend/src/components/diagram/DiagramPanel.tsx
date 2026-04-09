import { type ReactNode, useCallback, useEffect } from 'react'
import { BookOpen, Download } from 'lucide-react'
import { toSvg, toPng } from 'html-to-image'
import JSZip from 'jszip'
import { UmpleDiagram } from './UmpleDiagram'
import { SmartSvgView } from './SmartSvgView'
import { HtmlDiagramView } from './HtmlDiagramView'
import { CanvasToolbar } from './CanvasToolbar'
import { GeneratedOutputView } from '../generation/GeneratedOutputView'
import { ObjectExplorer } from '../crud/ObjectExplorer'
import { CanvasBanner } from '../layout/CanvasBanner'
import { useSessionStore, VIEW_OUTPUT_KIND } from '../../stores/sessionStore'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
}

export function DiagramPanel() {
  const viewMode = useSessionStore((s) => s.viewMode)
  const svgCache = useSessionStore((s) => s.svgCache)
  const htmlCache = useSessionStore((s) => s.htmlCache)
  const umpleModel = useSessionStore((s) => s.umpleModel)
  const classLayout = useSessionStore((s) => s.classLayout)
  const storedLayout = useSessionStore((s) => s.storedLayout)
  const code = useSessionStore((s) => s.code)
  const modelId = useSessionStore((s) => s.modelId)
  const renderMode = useEphemeralStore((s) => s.renderMode)
  const compiling = useEphemeralStore((s) => s.compiling)
  const setRenderMode = useEphemeralStore((s) => s.setRenderMode)
  const rightPanelView = useEphemeralStore((s) => s.rightPanelView)
  const generatedCode = useEphemeralStore((s) => s.generatedCode)
  const generatedHtml = useEphemeralStore((s) => s.generatedHtml)
  const generatedKind = useEphemeralStore((s) => s.generatedKind)
  const generatedIframeUrl = useEphemeralStore((s) => s.generatedIframeUrl)
  const generatedDownloads = useEphemeralStore((s) => s.generatedDownloads)
  const generatedLanguage = useEphemeralStore((s) => s.generatedLanguage)
  const generatingCode = useEphemeralStore((s) => s.generatingCode)
  const generatedError = useEphemeralStore((s) => s.generatedError)
  const generationRequested = useEphemeralStore((s) => s.generationRequested)
  const openCommandPalette = useEphemeralStore((s) => s.openCommandPalette)


  const currentSvg = svgCache[viewMode] ?? ''
  const currentHtml = htmlCache[viewMode] ?? ''
  const outputKind = VIEW_OUTPUT_KIND[viewMode]
  const hasEditableModel = !!umpleModel?.umpleClasses?.length
  const canToggleRenderer = viewMode === 'class' && hasEditableModel
  const showEditable = canToggleRenderer && renderMode === 'editable'
  const editableLoading = viewMode === 'class' && compiling && !hasEditableModel && !currentSvg
  const showEmptyCanvasState = viewMode === 'class' && !compiling && !hasEditableModel && !currentSvg

  // Default: all views start in graphviz mode
  useEffect(() => {
    setRenderMode('graphviz')
  }, [viewMode, setRenderMode])
  const showHtml = !showEditable && !editableLoading && outputKind === 'html' && !!currentHtml
  const showGv = !showEditable && !editableLoading && !showHtml && !!currentSvg
  const hasDiagram = showEditable || showHtml || showGv
  const mountEditable = canToggleRenderer
  const mountHtml = outputKind === 'html' && !!currentHtml
  const mountGv = outputKind === 'gv' && !!currentSvg

  const handleExport = useCallback(async (format: string) => {
    // Umple source code — zip all tabs client-side
    if (format === 'ump') {
      const { tabs, activeTabId } = useSessionStore.getState()
      const zip = new JSZip()
      for (const tab of tabs) {
        const content = tab.id === activeTabId ? code : tab.code
        zip.file(tab.name, content)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, 'umple-model.zip')
      URL.revokeObjectURL(url)
      return
    }

    // Diagram image exports (SVG, PNG)
    const filename = `umple-${viewMode}-diagram.${format}`

    // When showing ReactFlow, capture the canvas client-side
    if (!showGv) {
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (viewport) {
        const convert = format === 'png' ? toPng : toSvg
        const dataUrl = await convert(viewport, {
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface-0').trim() || '#ffffff',
        })
        triggerDownload(dataUrl, filename)
        return
      }
    }

    // GV mode or fallback: use backend export
    const activeTabId = useSessionStore.getState().activeTabId
    const blob = await api.export({ code, format, modelId: modelId ?? undefined, activeTabId })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, filename)
    URL.revokeObjectURL(url)
  }, [code, modelId, viewMode, showGv])

  return (
    <div className="h-full flex flex-col" data-testid="diagram-panel">
      <CanvasBanner />
      <div className="flex-1 relative" data-testid="diagram-canvas">
        <div className={cn('absolute inset-0', rightPanelView !== 'diagram' && 'invisible')}>
          <div className="absolute top-2 left-0 right-0 z-10 flex justify-center pointer-events-none">
            <CanvasToolbar
              hasDiagram={hasDiagram}
              onExport={handleExport}
              canToggleRenderer={canToggleRenderer}
              renderMode={renderMode}
              onRenderModeChange={setRenderMode}
              showDisplayOptions={!showHtml}
            />
          </div>
          {mountEditable && (
            <DiagramLayer active={showEditable}>
              <UmpleDiagram model={umpleModel!} layout={classLayout ?? undefined} storedLayout={storedLayout ?? undefined} editable={showEditable} />
            </DiagramLayer>
          )}
          {mountHtml && (
            <DiagramLayer active={showHtml}>
              <HtmlDiagramView html={currentHtml} viewMode={viewMode} />
            </DiagramLayer>
          )}
          {mountGv && (
            <DiagramLayer active={showGv}>
              <SmartSvgView svg={currentSvg} />
            </DiagramLayer>
          )}
          {editableLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-ink-faint text-sm">
              <div className="flex flex-col gap-2.5 w-3/4 max-w-sm">
                <div className="h-3 rounded animate-shimmer" style={{ width: '90%' }} />
                <div className="h-3 rounded animate-shimmer" style={{ width: '70%', animationDelay: '0.15s' }} />
                <div className="h-3 rounded animate-shimmer" style={{ width: '80%', animationDelay: '0.3s' }} />
                <div className="h-3 rounded animate-shimmer" style={{ width: '55%', animationDelay: '0.45s' }} />
              </div>
              <span>Loading diagram...</span>
            </div>
          )}
          {showEmptyCanvasState && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => openCommandPalette(['examples'])}
                className="bg-surface-0/88 border-border text-ink shadow-sm backdrop-blur-sm hover:bg-surface-1 hover:border-border-strong"
                data-testid="empty-canvas-open-examples"
              >
                <BookOpen className="size-4" />
                Open examples
              </Button>
            </div>
          )}
        </div>

        {generationRequested && (
          <div className={cn('absolute inset-0 bg-surface-0 flex flex-col z-20', rightPanelView !== 'generated' && 'invisible')}>
            {generatedError && (
              <ErrorBanner className="py-1.5 rounded-none border-0 border-b border-border shrink-0">
                {generatedError}
              </ErrorBanner>
            )}
            {generatingCode ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-ink-faint text-sm">
                <div className="flex flex-col gap-2.5 w-3/4 max-w-sm">
                  <div className="h-3 rounded animate-shimmer" style={{ width: '90%' }} />
                  <div className="h-3 rounded animate-shimmer" style={{ width: '70%', animationDelay: '0.15s' }} />
                  <div className="h-3 rounded animate-shimmer" style={{ width: '80%', animationDelay: '0.3s' }} />
                  <div className="h-3 rounded animate-shimmer" style={{ width: '55%', animationDelay: '0.45s' }} />
                </div>
                <span>Generating {generatedLanguage}...</span>
              </div>
            ) : (generatedCode || generatedHtml || generatedIframeUrl) ? (
              <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
              <GeneratedOutputView
                kind={generatedKind}
                code={generatedCode}
                html={generatedHtml}
                iframeUrl={generatedIframeUrl}
                language={generatedLanguage}
                downloads={generatedDownloads}
              />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ink-faint text-sm">
                No output returned — try a different model or language
              </div>
            )}
          </div>
        )}

        {viewMode === 'crud' && rightPanelView === 'diagram' && (
          <div className="absolute inset-0 bg-surface-0 z-20">
            <ObjectExplorer />
          </div>
        )}
      </div>
    </div>
  )
}

function DiagramLayer({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={!active}
      className={cn('absolute inset-0', active ? 'visible' : 'invisible pointer-events-none')}
    >
      {children}
    </div>
  )
}

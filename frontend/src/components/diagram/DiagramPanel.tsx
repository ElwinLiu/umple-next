import { useCallback, type ComponentType } from 'react'
import { Download } from 'lucide-react'
import { toSvg, toPng } from 'html-to-image'
import { ClassDiagram } from './ClassDiagram'
import { SmartSvgView } from './SmartSvgView'
import { HtmlDiagramView } from './HtmlDiagramView'
import { CanvasToolbar } from './CanvasToolbar'
import { GeneratedOutputView } from '../generation/GeneratedOutputView'
import { CanvasBanner } from '../layout/CanvasBanner'
import { EMPTY_DIAGRAM_ELEMENTS, type DiagramView, useDiagramStore, VIEW_OUTPUT_KIND } from '../../stores/diagramStore'
import { useEditorStore } from '../../stores/editorStore'
import { useUiStore } from '../../stores/uiStore'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
}

const RF_RENDERERS: Partial<Record<DiagramView, ComponentType>> = {
  class: ClassDiagram,
}

export function DiagramPanel() {
  const { viewMode, renderMode, svgCache, htmlCache, diagramData, setRenderMode } = useDiagramStore()
  const {
    rightPanelView,
    generatedCode, generatedHtml, generatedKind, generatedIframeUrl, generatedDownloads,
    generatedLanguage, generatingCode, generatedError,
    generationRequested,
  } = useUiStore()

  const { code, modelId } = useEditorStore()

  const currentSvg = svgCache[viewMode] ?? ''
  const currentHtml = htmlCache[viewMode] ?? ''
  const currentDiagramData = diagramData[viewMode] ?? EMPTY_DIAGRAM_ELEMENTS
  const Renderer = RF_RENDERERS[viewMode]
  const outputKind = VIEW_OUTPUT_KIND[viewMode]
  const showHtml = outputKind === 'html' && !!currentHtml
  const hasReactFlowData = !!Renderer && currentDiagramData.nodes.length > 0
  const showGv = !showHtml && currentSvg && (renderMode === 'graphviz' || !hasReactFlowData)

  const handleExport = useCallback(async (format: string) => {
    const filename = `umple-${viewMode}-diagram.${format}`

    // When showing ReactFlow, capture the canvas client-side
    if (!showGv) {
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (viewport) {
        const convert = format === 'png' ? toPng : toSvg
        const dataUrl = await convert(viewport, {
          backgroundColor: document.documentElement.classList.contains('dark') ? '#1a1a1a' : '#ffffff',
        })
        triggerDownload(dataUrl, filename)
        return
      }
    }

    // GV mode or fallback: use backend export
    const blob = await api.export({ code, format, modelId: modelId ?? undefined })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, filename)
    URL.revokeObjectURL(url)
  }, [code, modelId, viewMode, showGv])

  return (
    <div className="h-full flex flex-col" data-testid="diagram-panel">
      <CanvasBanner />
      <div className="flex-1 relative" data-testid="diagram-canvas">
        <div className={cn('absolute inset-0', rightPanelView !== 'diagram' && 'invisible')}>
          {!showHtml && <CanvasToolbar />}
          {!showHtml && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-surface-0/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-sm">
              <DropdownMenu>
                <Tip content="Export diagram" side="bottom">
                  <DropdownMenuTrigger asChild>
                    <button className={`${toolbarBtnBase} text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center gap-1`}>
                      <Download className="size-3" />
                      Export
                    </button>
                  </DropdownMenuTrigger>
                </Tip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('svg')}>SVG</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('png')}>PNG</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {hasReactFlowData && (
                <>
                  <div className="w-px h-3.5 bg-border mx-0.5" />
                  <Tip content={`Renderer: ${renderMode === 'reactflow' ? 'React Flow' : 'Graphviz'}`} side="bottom">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className={`text-xs ${renderMode === 'reactflow' ? 'text-ink font-semibold' : 'text-ink-muted'}`}>RF</span>
                      <Switch
                        size="sm"
                        checked={renderMode === 'graphviz'}
                        onCheckedChange={(checked) => setRenderMode(checked ? 'graphviz' : 'reactflow')}
                      />
                      <span className={`text-xs ${renderMode === 'graphviz' ? 'text-ink font-semibold' : 'text-ink-muted'}`}>GV</span>
                    </label>
                  </Tip>
                </>
              )}
            </div>
          )}
          {showHtml ? (
            <HtmlDiagramView html={currentHtml} viewMode={viewMode} />
          ) : showGv ? (
            <SmartSvgView svg={currentSvg} />
          ) : (
            Renderer ? <Renderer /> : null
          )}
        </div>

        {generationRequested && (
          <div className={cn('absolute inset-0 bg-surface-0 flex flex-col', rightPanelView !== 'generated' && 'invisible')}>
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
              <div className="flex-1 flex flex-col animate-fade-in">
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
      </div>
    </div>
  )
}

const toolbarBtnBase = 'px-1.5 py-0.5 text-xs cursor-pointer transition-colors rounded focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1'

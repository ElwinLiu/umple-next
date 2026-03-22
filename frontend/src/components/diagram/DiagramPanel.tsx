import { useCallback } from 'react'
import { Download } from 'lucide-react'
import { toSvg, toPng } from 'html-to-image'
import { ClassDiagram } from './ClassDiagram'
import { StateDiagram } from './StateDiagram'
import { FeatureDiagram } from './FeatureDiagram'
import { StructureDiagram } from './StructureDiagram'
import { GvDiagramView } from './GvDiagramView'
import { CodeOutput } from '../generation/CodeOutput'
import { CanvasBanner } from '../layout/CanvasBanner'
import { useDiagramStore } from '../../stores/diagramStore'
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

export function DiagramPanel() {
  const { viewMode, renderMode, svgCache, stateNodes, setRenderMode } = useDiagramStore()
  const {
    rightPanelView,
    generatedCode, generatedLanguage, generatingCode, generatedError,
    generationRequested,
  } = useUiStore()

  const { code, modelId } = useEditorStore()

  const currentSvg = svgCache[viewMode] ?? ''
  const hasReactFlowData = viewMode === 'class' || (viewMode === 'state' && stateNodes.length > 0)
  const showGv = currentSvg && (renderMode === 'graphviz' || (!hasReactFlowData && viewMode !== 'structure'))

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
          {showGv ? (
            <GvDiagramView svg={currentSvg} />
          ) : (
            <>
              {viewMode === 'class' && <ClassDiagram />}
              {viewMode === 'state' && <StateDiagram />}
              {viewMode === 'feature' && <FeatureDiagram />}
              {viewMode === 'structure' && <StructureDiagram />}
            </>
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
              <div className="flex-1 flex items-center justify-center text-ink-faint text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  Generating {generatedLanguage}...
                </span>
              </div>
            ) : generatedCode ? (
              <CodeOutput code={generatedCode} language={generatedLanguage} />
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


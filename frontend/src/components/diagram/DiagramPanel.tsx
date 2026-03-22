import { useCallback } from 'react'
import { ClassDiagram } from './ClassDiagram'
import { StateDiagram } from './StateDiagram'
import { FeatureDiagram } from './FeatureDiagram'
import { StructureDiagram } from './StructureDiagram'
import { GvDiagramView } from './GvDiagramView'
import { CodeOutput } from '../generation/CodeOutput'
import { CanvasBanner } from '../layout/CanvasBanner'
import { useDiagramStore } from '../../stores/diagramStore'
import { useUiStore } from '../../stores/uiStore'
import { Tip } from '@/components/ui/tooltip'

export function DiagramPanel() {
  const { viewMode, renderMode, svgCache, stateNodes, setRenderMode } = useDiagramStore()
  const {
    rightPanelView,
    generatedCode, generatedLanguage, generatingCode, generatedError,
    generationRequested,
  } = useUiStore()

  const currentSvg = svgCache[viewMode] ?? ''
  const hasReactFlowData = viewMode === 'class' || (viewMode === 'state' && stateNodes.length > 0)
  const showGv = currentSvg && (renderMode === 'graphviz' || (!hasReactFlowData && viewMode !== 'structure'))

  const handleExportSvg = useCallback(() => {
    const rfEl = document.querySelector('.react-flow') as HTMLElement | null
    if (!rfEl) return
    const viewport = rfEl.querySelector('.react-flow__viewport')
    if (!viewport) return
    const { width, height } = rfEl.getBoundingClientRect()
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${viewport.innerHTML}</svg>`
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `umple-${viewMode}-diagram.svg`
    link.click()
    URL.revokeObjectURL(url)
  }, [viewMode])

  const handleExportPng = useCallback(() => {
    const rfEl = document.querySelector('.react-flow') as HTMLElement | null
    if (!rfEl) return
    const viewport = rfEl.querySelector('.react-flow__viewport')
    if (!viewport) return
    const { width, height } = rfEl.getBoundingClientRect()
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${viewport.innerHTML}</svg>`
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(2, 2)
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#1a1a1a' : '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = `umple-${viewMode}-diagram.png`
        link.click()
        URL.revokeObjectURL(pngUrl)
      }, 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [viewMode])

  return (
    <div className="h-full flex flex-col" data-testid="diagram-panel">
      <CanvasBanner />
      <div className="flex-1 relative" data-testid="diagram-canvas">
        <div className={`absolute inset-0 ${rightPanelView !== 'diagram' ? 'invisible' : ''}`}>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-surface-0/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-sm">
            <ToolbarButton onClick={handleExportSvg} label="Export SVG">SVG</ToolbarButton>
            <ToolbarButton onClick={handleExportPng} label="Export PNG">PNG</ToolbarButton>
            {hasReactFlowData && (
              <>
                <div className="w-px h-3.5 bg-border mx-0.5" />
                <ToolbarButton
                  onClick={() => setRenderMode(renderMode === 'reactflow' ? 'graphviz' : 'reactflow')}
                  label={renderMode === 'reactflow' ? 'Switch to Graphviz rendering' : 'Switch to React Flow rendering'}
                  active={renderMode === 'graphviz'}
                >
                  {renderMode === 'reactflow' ? 'GV' : 'RF'}
                </ToolbarButton>
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
          <div className={`absolute inset-0 bg-surface-0 flex flex-col ${rightPanelView !== 'generated' ? 'invisible' : ''}`}>
            {generatedError && (
              <div className="px-3 py-1.5 text-xs text-status-error bg-brand-light border-b border-border shrink-0">
                {generatedError}
              </div>
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

function ToolbarButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Tip content={label} side="bottom">
      <button
        onClick={onClick}
        className={`px-1.5 py-0.5 text-[11px] cursor-pointer transition-colors rounded focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1 ${
          active
            ? 'text-brand font-semibold bg-brand-light'
            : 'text-ink-muted hover:text-ink hover:bg-surface-2'
        }`}
      >
        {children}
      </button>
    </Tip>
  )
}

import { useCallback } from 'react'
import { ClassDiagram } from './ClassDiagram'
import { StateDiagram } from './StateDiagram'
import { FeatureDiagram } from './FeatureDiagram'
import { StructureDiagram } from './StructureDiagram'
import { GvDiagramView } from './GvDiagramView'
import { CodeOutput } from '../generation/CodeOutput'
import { useDiagramStore } from '../../stores/diagramStore'
import { useUiStore } from '../../stores/uiStore'
import { useEditorStore } from '../../stores/editorStore'
import { api } from '../../api/client'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UMPLE_TARGETS } from '../../api/types'

export function DiagramPanel() {
  const { viewMode, renderMode, svgCache, stateNodes, compiling, setRenderMode } = useDiagramStore()
  const {
    rightPanelView, setRightPanelView,
    generatedCode, generatedLanguage, generatingCode, generatedError,
    setGeneratedOutput, setGeneratingCode, setGeneratedError,
  } = useUiStore()
  const code = useEditorStore((s) => s.code)
  const modelId = useEditorStore((s) => s.modelId)

  const currentSvg = svgCache[viewMode] ?? ''
  // Show GV when explicitly in graphviz mode, or auto-fallback for state/feature
  // diagrams where ReactFlow has no data (JSON compile doesn't include these)
  const hasReactFlowData = viewMode === 'class' || (viewMode === 'state' && stateNodes.length > 0)
  const showGv = currentSvg && (renderMode === 'graphviz' || (!hasReactFlowData && viewMode !== 'structure'))
  const hasGenerated = !!generatedCode || generatingCode

  const handleGenerate = useCallback(async (language: string) => {
    if (!code.trim()) return
    setGeneratingCode(true)
    setGeneratedError(null)
    try {
      const res = await api.generate({ code, language, modelId: modelId ?? undefined })
      setGeneratedOutput(res.output, language)
      if (res.errors) setGeneratedError(res.errors)
    } catch (err: any) {
      setGeneratedError(err.message || 'Generation failed')
    } finally {
      setGeneratingCode(false)
    }
  }, [code, modelId, setGeneratedOutput, setGeneratingCode, setGeneratedError])

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

  const handleFitView = useCallback(() => {
    const fitBtn = document.querySelector('[data-diagram-fit-view]') as HTMLButtonElement | null
    if (fitBtn) fitBtn.click()
  }, [])

  return (
    <div className="h-full flex flex-col" data-testid="diagram-panel">
      {/* Content — full height, toolbar floats on top */}
      <div className="flex-1 relative" data-testid="diagram-canvas">
        {/* Floating toolbar controls */}
        {rightPanelView === 'diagram' && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-surface-0/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-sm">
            <ToolbarButton onClick={handleExportSvg} title="Export SVG">SVG</ToolbarButton>
            <ToolbarButton onClick={handleExportPng} title="Export PNG">PNG</ToolbarButton>
            {!showGv && (
              <ToolbarButton onClick={handleFitView} title="Fit to view">Fit</ToolbarButton>
            )}
            {hasReactFlowData && (
              <>
                <div className="w-px h-3.5 bg-border mx-0.5" />
                <ToolbarButton
                  onClick={() => setRenderMode(renderMode === 'reactflow' ? 'graphviz' : 'reactflow')}
                  title="Toggle render mode"
                  active={renderMode === 'graphviz'}
                >
                  {renderMode === 'reactflow' ? 'GV' : 'RF'}
                </ToolbarButton>
              </>
            )}
          </div>
        )}

        {/* Generated code tab (floating, top-left) */}
        {hasGenerated && (
          <div className="absolute top-2 left-2 z-10 flex items-center bg-surface-0/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-sm">
            <button
              onClick={() => setRightPanelView(rightPanelView === 'generated' ? 'diagram' : 'generated')}
              className={`px-2 py-0.5 text-[11px] rounded-l transition-colors cursor-pointer flex items-center gap-1.5 ${
                rightPanelView === 'generated'
                  ? 'bg-brand text-ink-inverse font-semibold'
                  : 'text-ink-muted hover:bg-surface-2 font-medium'
              }`}
            >
              {generatingCode && <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />}
              {generatedLanguage}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`px-1 py-0.5 text-[11px] rounded-r transition-colors cursor-pointer outline-none ${
                  rightPanelView === 'generated'
                    ? 'bg-brand text-ink-inverse/70 hover:text-ink-inverse'
                    : 'text-ink-faint hover:bg-surface-2'
                }`}
                title="Change language"
              >
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 max-h-52">
                {UMPLE_TARGETS.map((target) => (
                  <DropdownMenuItem
                    key={target}
                    onSelect={() => handleGenerate(target)}
                    className={`text-xs ${target === generatedLanguage ? 'bg-brand-light text-brand font-semibold' : ''}`}
                  >
                    {target}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {compiling && rightPanelView === 'diagram' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 text-[11px] bg-surface-0/90 backdrop-blur-sm border border-status-warning rounded-lg text-status-warning shadow-sm">
            Compiling...
          </div>
        )}

        {rightPanelView === 'diagram' ? (
          showGv ? (
            <GvDiagramView svg={currentSvg} />
          ) : (
            <>
              {viewMode === 'class' && <ClassDiagram />}
              {viewMode === 'state' && <StateDiagram />}
              {viewMode === 'feature' && <FeatureDiagram />}
              {viewMode === 'structure' && <StructureDiagram />}
            </>
          )
        ) : (
          <div className="h-full flex flex-col">
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
                No generated code yet
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
  title,
  active,
  children,
}: {
  onClick: () => void
  title: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-1.5 py-0.5 text-[11px] cursor-pointer transition-colors rounded focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1 ${
        active
          ? 'text-brand font-semibold bg-brand-light'
          : 'text-ink-muted hover:text-ink hover:bg-surface-2'
      }`}
    >
      {children}
    </button>
  )
}

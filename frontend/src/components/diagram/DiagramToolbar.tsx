import { useCallback } from 'react'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'

const viewModes: { value: DiagramView; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'state', label: 'State' },
  { value: 'feature', label: 'Feature' },
  { value: 'structure', label: 'Structure' },
]

export function DiagramToolbar() {
  const { viewMode, renderMode, setViewMode, setRenderMode } = useDiagramStore()

  const handleExportSvg = useCallback(() => {
    const svgEl = document.querySelector('.react-flow svg.react-flow__edges')
      ?? document.querySelector('.react-flow')
    if (!svgEl) return

    // Try to get the full ReactFlow SVG viewport
    const rfContainer = document.querySelector('.react-flow__viewport')
    if (!rfContainer) return

    const rfEl = document.querySelector('.react-flow') as HTMLElement | null
    if (!rfEl) return

    const { width, height } = rfEl.getBoundingClientRect()

    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rfContainer.innerHTML}</svg>`
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
      ctx.fillStyle = '#fff'
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

  const toggleRenderMode = useCallback(() => {
    setRenderMode(renderMode === 'reactflow' ? 'graphviz' : 'reactflow')
  }, [renderMode, setRenderMode])

  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-surface-1 border-b border-border h-8 shrink-0" data-testid="diagram-toolbar">
      {/* View mode buttons */}
      {viewModes.map((m) => {
        const active = viewMode === m.value
        return (
          <button
            key={m.value}
            onClick={() => setViewMode(m.value)}
            data-testid={`diagram-view-${m.value}`}
            className={`px-2.5 py-0.5 text-[11px] border rounded-sm cursor-pointer transition-colors ${
              active
                ? 'border-brand bg-brand-light text-brand hover:bg-brand-light'
                : 'border-border bg-surface-0 text-ink-muted hover:bg-surface-1'
            }`}
          >
            {m.label}
          </button>
        )
      })}

      {/* Separator */}
      <div className="w-px h-4.5 bg-border mx-1" />

      {/* Export SVG */}
      <button
        onClick={handleExportSvg}
        data-testid="diagram-export-svg"
        className="px-2 py-0.5 text-[11px] border border-border rounded-sm bg-surface-0 text-ink-muted cursor-pointer hover:bg-surface-1 transition-colors"
        title="Export SVG"
      >
        SVG
      </button>

      {/* Export PNG */}
      <button
        onClick={handleExportPng}
        data-testid="diagram-export-png"
        className="px-2 py-0.5 text-[11px] border border-border rounded-sm bg-surface-0 text-ink-muted cursor-pointer hover:bg-surface-1 transition-colors"
        title="Export PNG"
      >
        PNG
      </button>

      {/* Fit to view */}
      <button
        onClick={handleFitView}
        data-testid="diagram-fit-view"
        className="px-2 py-0.5 text-[11px] border border-border rounded-sm bg-surface-0 text-ink-muted cursor-pointer hover:bg-surface-1 transition-colors"
        title="Fit to view"
      >
        Fit
      </button>

      {/* Separator */}
      <div className="w-px h-4.5 bg-border mx-1" />

      {/* Render mode toggle */}
      <button
        onClick={toggleRenderMode}
        data-testid="diagram-render-mode"
        className={`px-2.5 py-0.5 text-[11px] border rounded-sm cursor-pointer transition-colors ${
          renderMode === 'graphviz'
            ? 'border-brand bg-brand-light text-brand hover:bg-brand-light'
            : 'border-border bg-surface-0 text-ink-muted hover:bg-surface-1'
        }`}
        title="Toggle between ReactFlow and GraphViz rendering"
      >
        {renderMode === 'reactflow' ? 'GV' : 'RF'}
      </button>
    </div>
  )
}

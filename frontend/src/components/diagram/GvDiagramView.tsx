import { useRef, useState, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'

interface GvDiagramViewProps {
  svg: string
}

/** Sanitize SVG by parsing it and stripping script/event-handler content */
function sanitizeSvg(raw: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'image/svg+xml')

  // Remove script elements
  const scripts = doc.querySelectorAll('script')
  scripts.forEach((s) => s.remove())

  // Remove event handler attributes (onclick, onload, etc.)
  const allEls = doc.querySelectorAll('*')
  allEls.forEach((el) => {
    const attrs = Array.from(el.attributes)
    for (const attr of attrs) {
      if (attr.name.startsWith('on') || attr.value.startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
    }
  })

  // Remove foreignObject elements
  const foreignObjects = doc.querySelectorAll('foreignObject')
  foreignObjects.forEach((fo) => fo.remove())

  const serializer = new XMLSerializer()
  return serializer.serializeToString(doc.documentElement)
}

export function GvDiagramView({ svg }: GvDiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const sanitizedSvg = useMemo(() => sanitizeSvg(svg), [svg])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale * delta, 0.1), 5)
      return { ...prev, scale: newScale }
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }, [transform.x, transform.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }))
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const fitToView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  const handleZoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.2, 5) }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.1) }))
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 30
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        setTransform((prev) => ({ ...prev, y: prev.y + step }))
        break
      case 'ArrowDown':
        e.preventDefault()
        setTransform((prev) => ({ ...prev, y: prev.y - step }))
        break
      case 'ArrowLeft':
        e.preventDefault()
        setTransform((prev) => ({ ...prev, x: prev.x + step }))
        break
      case 'ArrowRight':
        e.preventDefault()
        setTransform((prev) => ({ ...prev, x: prev.x - step }))
        break
      case '+':
      case '=':
        e.preventDefault()
        handleZoomIn()
        break
      case '-':
        e.preventDefault()
        handleZoomOut()
        break
      case '0':
        e.preventDefault()
        fitToView()
        break
    }
  }, [handleZoomIn, handleZoomOut, fitToView])

  if (!svg) {
    return (
      <div className="p-6 text-ink-faint text-[13px] font-mono">
        No GraphViz diagram available. Compile a model to generate one.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative bg-surface-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      tabIndex={0}
      role="application"
      aria-label="GraphViz diagram viewer — use arrow keys to pan, +/- to zoom"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
    >
      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-0.5 bg-surface-0 border border-border rounded-lg shadow-sm p-0.5">
        <GvControlButton onClick={handleZoomIn} label="Zoom in">
          <ZoomIn className="size-3.5" />
        </GvControlButton>
        <GvControlButton onClick={handleZoomOut} label="Zoom out">
          <ZoomOut className="size-3.5" />
        </GvControlButton>
        <div className="h-px bg-border mx-0.5" />
        <GvControlButton onClick={fitToView} label="Fit to view" data-diagram-fit-view>
          <Maximize className="size-3.5" />
        </GvControlButton>
      </div>

      <div
        className="inline-block origin-top-left"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
      />
    </div>
  )
}

function GvControlButton({
  onClick,
  label,
  children,
  ...rest
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <Tip content={label} side="right">
      <button
        onClick={onClick}
        aria-label={label}
        {...rest}
        className="flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer text-ink-muted hover:text-ink hover:bg-surface-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
      >
        {children}
      </button>
    </Tip>
  )
}

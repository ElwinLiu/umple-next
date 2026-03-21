import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'

interface GvDiagramViewProps {
  svg: string
}

/** Parse, sanitize, and extract dimensions from an SVG string in a single DOMParser pass */
function processSvg(raw: string): { html: string; dims: { width: number; height: number } | null } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'image/svg+xml')
  const svgEl = doc.documentElement

  // Sanitize: strip scripts, event handlers, foreignObject
  doc.querySelectorAll('script').forEach((s) => s.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on') || attr.value.startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
    }
  })
  doc.querySelectorAll('foreignObject').forEach((fo) => fo.remove())

  const html = new XMLSerializer().serializeToString(svgEl)

  // Extract dimensions
  const parseUnit = (val: string | null): number | null => {
    if (!val) return null
    const match = val.match(/^([\d.]+)(pt|px)?$/)
    if (!match) return null
    const num = parseFloat(match[1])
    return match[2] === 'pt' ? num * 1.333 : num
  }

  const w = parseUnit(svgEl.getAttribute('width'))
  const h = parseUnit(svgEl.getAttribute('height'))
  if (w && h) return { html, dims: { width: w, height: h } }

  const vb = svgEl.getAttribute('viewBox')
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { html, dims: { width: parts[2], height: parts[3] } }
    }
  }

  return { html, dims: null }
}

const PADDING = 24

export function GvDiagramView({ svg }: GvDiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const { html: sanitizedSvg, dims: svgDims } = useMemo(() => processSvg(svg), [svg])

  const fitToView = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      setTransform({ x: 0, y: 0, scale: 1 })
      return
    }

    const contentEl = contentRef.current
    let contentW: number
    let contentH: number

    if (contentEl) {
      const svgChild = contentEl.querySelector('svg')
      if (svgChild) {
        const bbox = svgChild.getBBox()
        contentW = bbox.width
        contentH = bbox.height
      } else if (svgDims) {
        contentW = svgDims.width
        contentH = svgDims.height
      } else {
        setTransform({ x: 0, y: 0, scale: 1 })
        return
      }
    } else if (svgDims) {
      contentW = svgDims.width
      contentH = svgDims.height
    } else {
      setTransform({ x: 0, y: 0, scale: 1 })
      return
    }

    const { width: cw, height: ch } = container.getBoundingClientRect()
    const availW = cw - PADDING * 2
    const availH = ch - PADDING * 2

    if (availW <= 0 || availH <= 0 || contentW <= 0 || contentH <= 0) {
      setTransform({ x: 0, y: 0, scale: 1 })
      return
    }

    const scale = Math.min(availW / contentW, availH / contentH, 1)
    const x = (cw - contentW * scale) / 2
    const y = (ch - contentH * scale) / 2

    setTransform({ x, y, scale })
  }, [svgDims])

  useEffect(() => {
    const id = requestAnimationFrame(fitToView)
    return () => cancelAnimationFrame(id)
  }, [sanitizedSvg, fitToView])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    setTransform((prev) => {
      // Scale zoom speed by deltaY magnitude — matches ReactFlow behavior.
      // Trackpad pinch sends small deltaY (~1-4), mouse wheel sends larger (~100).
      const factor = 1 - e.deltaY * 0.005
      const newScale = Math.min(Math.max(prev.scale * factor, 0.1), 5)
      const ratio = newScale / prev.scale
      const newX = cursorX - ratio * (cursorX - prev.x)
      const newY = cursorY - ratio * (cursorY - prev.y)
      return { x: newX, y: newY, scale: newScale }
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
      className="w-full h-full overflow-hidden relative bg-surface-0 select-none focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      tabIndex={0}
      role="application"
      aria-label="GraphViz diagram viewer — use arrow keys to pan, +/- to zoom, scroll to zoom"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
    >
      {/* Controls — matches DiagramControls overlay */}
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
        ref={contentRef}
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

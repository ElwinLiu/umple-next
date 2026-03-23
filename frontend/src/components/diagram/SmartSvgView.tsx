import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { ControlButton } from './DiagramControls'

interface SmartSvgViewProps {
  svg: string
}

/**
 * CSS theme rules injected into every Graphviz SVG.
 * Uses the app's CSS custom properties so light/dark mode works automatically.
 * Graphviz produces a predictable structure: .graph, .node, .edge, .cluster <g> groups
 * containing polygons, paths, ellipses, and text elements.
 */
const SVG_THEME_CSS = `
  .graph > polygon { fill: var(--color-surface-0); stroke: none; }
  .cluster > polygon, .cluster > path { fill: var(--color-surface-1); stroke: var(--color-border); }
  .cluster > text { fill: var(--color-ink); }
  .node polygon, .node ellipse, .node path, .node polyline { stroke: var(--color-border-strong); fill: var(--color-surface-1); }
  .node text { fill: var(--color-ink); }
  .edge path { stroke: var(--color-ink-muted); fill: none; }
  .edge polygon { fill: var(--color-ink-muted); stroke: var(--color-ink-muted); }
  .edge text { fill: var(--color-ink-muted); }

  /* Hover highlights */
  .node, .edge { cursor: pointer; }
  .node:hover polygon, .node:hover ellipse, .node:hover path, .node:hover polyline {
    stroke: var(--color-brand);
    transition: stroke 0.15s ease;
  }
  .edge:hover path {
    stroke: var(--color-brand);
    stroke-width: 2;
    transition: stroke 0.15s ease, stroke-width 0.15s ease;
  }
  .edge:hover polygon {
    fill: var(--color-brand);
    stroke: var(--color-brand);
    transition: fill 0.15s ease, stroke 0.15s ease;
  }

  /* Selection highlights */
  [data-selected="true"] polygon, [data-selected="true"] ellipse,
  [data-selected="true"] path, [data-selected="true"] polyline {
    stroke: var(--color-brand) !important;
    stroke-width: 2;
  }
  .edge[data-selected="true"] polygon {
    fill: var(--color-brand) !important;
  }
`

/** Colors that Graphviz hardcodes which we want CSS to control instead.
 *  NOTE: Do NOT include 'none' — it's intentional transparency (e.g. box
 *  outline polygons). Stripping it would let CSS fill them opaque, covering text. */
const STRIP_COLORS = new Set([
  'black', '#000000', '#000',
  'white', '#ffffff', '#fff',
])

/** Should this inline color be stripped so CSS rules take over? */
function shouldStripColor(value: string): boolean {
  return STRIP_COLORS.has(value.toLowerCase())
}

/**
 * Parse, sanitize, theme, and extract dimensions from an SVG string.
 * Replaces the old per-attribute dark-mode remapping with CSS injection.
 */
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

  // Strip `<a>` wrappers (Graphviz wraps nodes in links) — unwrap children, remove the <a>
  doc.querySelectorAll('a').forEach((a) => {
    while (a.firstChild) a.parentNode?.insertBefore(a.firstChild, a)
    a.remove()
  })

  // Inject theme stylesheet
  const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  styleEl.textContent = SVG_THEME_CSS
  svgEl.insertBefore(styleEl, svgEl.firstChild)

  // Strip hardcoded fill/stroke so CSS rules take effect.
  // Only strip black/white — preserve intentional colors (e.g. colored edges).
  // Special handling for fill="none": promote to inline style so it beats CSS
  // specificity (presentation attributes lose to CSS rules, inline styles don't).
  // This is critical for Graphviz class diagram box-outline polygons which use
  // fill="none" and are drawn AFTER text — making them opaque would hide labels.
  doc.querySelectorAll('.node *, .edge *, .graph > polygon, .cluster > polygon, .cluster > path, .cluster > text').forEach((el) => {
    for (const attr of ['fill', 'stroke']) {
      const val = el.getAttribute(attr)
      if (!val) continue
      if (val.toLowerCase() === 'none') {
        // Promote to inline style so it overrides CSS rules
        el.removeAttribute(attr)
        const existing = el.getAttribute('style') ?? ''
        el.setAttribute('style', `${existing}${existing ? ';' : ''}${attr}:none`)
      } else if (shouldStripColor(val)) {
        el.removeAttribute(attr)
      }
    }
    // Also strip font color
    const fontColor = el.getAttribute('color')
    if (fontColor && shouldStripColor(fontColor)) {
      el.removeAttribute('color')
    }
  })

  // Add data attributes to node/edge groups for interaction targeting
  doc.querySelectorAll('g.node').forEach((g) => {
    const title = g.querySelector('title')
    if (title?.textContent) {
      g.setAttribute('data-node-id', title.textContent.trim())
    }
  })
  doc.querySelectorAll('g.edge').forEach((g) => {
    const title = g.querySelector('title')
    if (title?.textContent) {
      g.setAttribute('data-edge-id', title.textContent.trim())
    }
  })

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

export function SmartSvgView({ svg }: SmartSvgViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { html: sanitizedSvg, dims: svgDims } = useMemo(() => processSvg(svg), [svg])

  // Clear selection when SVG changes
  useEffect(() => { setSelectedId(null) }, [svg])

  const fitToView = useCallback(() => {
    const RESET = { x: 0, y: 0, scale: 1 }
    const container = containerRef.current
    if (!container) { setTransform(RESET); return }

    const bbox = contentRef.current?.querySelector('svg')?.getBBox()
    const contentW = bbox?.width ?? svgDims?.width
    const contentH = bbox?.height ?? svgDims?.height
    if (!contentW || !contentH) { setTransform(RESET); return }

    const { width: cw, height: ch } = container.getBoundingClientRect()
    const availW = cw - PADDING * 2
    const availH = ch - PADDING * 2
    if (availW <= 0 || availH <= 0) { setTransform(RESET); return }

    const scale = Math.min(availW / contentW, availH / contentH, 1)
    setTransform({ x: (cw - contentW * scale) / 2, y: (ch - contentH * scale) / 2, scale })
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
      case 'Escape':
        setSelectedId(null)
        break
    }
  }, [handleZoomIn, handleZoomOut, fitToView])

  /** Handle clicks on SVG nodes/edges for selection */
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as Element

    // Walk up to find closest node or edge group
    const nodeGroup = target.closest('g.node')
    const edgeGroup = target.closest('g.edge')

    const contentEl = contentRef.current
    if (!contentEl) return

    // Clear previous selection
    contentEl.querySelectorAll('[data-selected]').forEach((el) => {
      el.removeAttribute('data-selected')
    })

    if (nodeGroup) {
      const id = nodeGroup.getAttribute('data-node-id')
      nodeGroup.setAttribute('data-selected', 'true')
      setSelectedId(id)
    } else if (edgeGroup) {
      const id = edgeGroup.getAttribute('data-edge-id')
      edgeGroup.setAttribute('data-selected', 'true')
      setSelectedId(id)
    } else {
      setSelectedId(null)
    }
  }, [])

  if (!svg) {
    return (
      <div className="p-6 text-ink-faint text-sm font-mono">
        No diagram available. Compile a model to generate one.
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
      aria-label="SVG diagram canvas — use arrow keys to pan, +/- to zoom, scroll to zoom"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      {/* Controls */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-0.5 bg-surface-0 border border-border rounded-lg shadow-sm p-0.5">
        <ControlButton onClick={handleZoomIn} label="Zoom in">
          <ZoomIn className="size-3.5" />
        </ControlButton>
        <ControlButton onClick={handleZoomOut} label="Zoom out">
          <ZoomOut className="size-3.5" />
        </ControlButton>
        <div className="h-px bg-border mx-0.5" />
        <ControlButton onClick={fitToView} label="Fit to view" data-diagram-fit-view>
          <Maximize className="size-3.5" />
        </ControlButton>
      </div>

      {/* Selected element indicator */}
      {selectedId && (
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-surface-1 border border-border rounded-md text-xs text-ink-muted font-mono truncate max-w-64">
          {selectedId}
        </div>
      )}

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

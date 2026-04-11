// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SmartSvgView, formatDiagramIdentifierForDisplay } from '../SmartSvgView'
import { TooltipProvider } from '@/components/ui/tooltip'

const svgGraphicsPrototype = SVGGraphicsElement.prototype as SVGGraphicsElement & {
  getBBox?: () => { x: number; y: number; width: number; height: number }
}
const originalGetBBox = svgGraphicsPrototype.getBBox

beforeAll(() => {
  Object.defineProperty(svgGraphicsPrototype, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 120, height: 80 }),
  })
})

afterAll(() => {
  if (originalGetBBox) {
    Object.defineProperty(svgGraphicsPrototype, 'getBBox', {
      configurable: true,
      value: originalGetBBox,
    })
  } else {
    Reflect.deleteProperty(svgGraphicsPrototype, 'getBBox')
  }
})

afterEach(() => {
  cleanup()
})

describe('SmartSvgView', () => {
  it('formats internal instance identifiers for display', () => {
    expect(formatDiagramIdentifierForDisplay('Segment_12')).toBe('Segment #12')
    expect(formatDiagramIdentifierForDisplay('Segment_12->Lock_3')).toBe('Segment #12 -> Lock #3')
    expect(formatDiagramIdentifierForDisplay('OrderItem')).toBe('OrderItem')
  })

  it('keeps raw ids internal while showing formatted labels to the user', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
        <g class="node">
          <title>Segment_12</title>
          <rect x="10" y="10" width="40" height="20"></rect>
          <text x="15" y="25">Segment #12</text>
        </g>
        <g class="edge">
          <title>Segment_12->Lock_3</title>
          <path d="M50,20 C60,20 70,40 80,40"></path>
        </g>
      </svg>
    `

    const { container } = render(
      <TooltipProvider>
        <SmartSvgView svg={svg} />
      </TooltipProvider>
    )

    const nodeTitle = container.querySelector('g.node title')
    const edgeTitle = container.querySelector('g.edge title')
    const nodeGroup = container.querySelector('g.node')
    const edgeGroup = container.querySelector('g.edge')

    expect(nodeTitle?.textContent).toBe('Segment #12')
    expect(edgeTitle?.textContent).toBe('Segment #12 -> Lock #3')
    expect(nodeGroup?.getAttribute('data-node-id')).toBe('Segment_12')
    expect(edgeGroup?.getAttribute('data-edge-id')).toBe('Segment_12->Lock_3')

    fireEvent.click(nodeGroup as Element)
    expect(screen.getByTestId('smart-svg-selected-id').textContent).toBe('Segment #12')
  })
})

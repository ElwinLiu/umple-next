import { describe, expect, it } from 'vitest'

import type { GvLayout, StoredLayoutMetadata, UmpleModel } from '@/api/types'
import { convertClassDiagram } from '../classConverter'

describe('convertClassDiagram', () => {
  it('uses Graphviz text lines to expose generated trait methods in RF', () => {
    const model: UmpleModel = {
      umpleClasses: [
        {
          name: 'Unit',
          attributes: [{ name: 'id', type: '' }],
          methods: [],
        },
      ],
    }

    const layout: GvLayout = {
      bboxWidth: 300,
      bboxHeight: 200,
      nodes: [
        {
          name: 'Unit',
          x: 100,
          y: 100,
          width: 180,
          height: 120,
          textLines: [
            { text: 'Unit', bold: true },
            { text: 'id' },
            { text: 'getId()' },
            { text: 'addGuest(aGuest)' },
          ],
        },
      ],
      edges: [],
    }

    const result = convertClassDiagram(model, layout)
    const unitNode = result.nodes[0]
    const methods = unitNode.data.methods as Array<{ displayText?: string; removable?: boolean }>

    expect(methods.map((method) => method.displayText)).toEqual(['getId()', 'addGuest(aGuest)'])
    expect(methods.every((method) => method.removable === false)).toBe(true)
  })

  it('keeps explicit methods removable when matching layout lines are present', () => {
    const model: UmpleModel = {
      umpleClasses: [
        {
          name: 'Unit',
          attributes: [],
          methods: [{ name: 'doSomething', type: 'void', parameters: '' }],
        },
      ],
    }

    const layout: GvLayout = {
      bboxWidth: 300,
      bboxHeight: 200,
      nodes: [
        {
          name: 'Unit',
          x: 100,
          y: 100,
          width: 180,
          height: 90,
          textLines: [
            { text: 'Unit', bold: true },
            { text: 'doSomething(): void' },
          ],
        },
      ],
      edges: [],
    }

    const result = convertClassDiagram(model, layout)
    const unitNode = result.nodes[0]
    const methods = unitNode.data.methods as Array<{ name: string; displayText?: string; removable?: boolean }>

    expect(methods).toEqual([
      expect.objectContaining({
        name: 'doSomething',
        displayText: 'doSomething(): void',
        removable: true,
      }),
    ])
  })

  it('prefers stored node positions over Graphviz positions for explicitly persisted layout', () => {
    const model: UmpleModel = {
      umpleClasses: [
        {
          name: 'Unit',
          position: { x: 320, y: 180, width: 180, height: 90 },
          attributes: [],
          methods: [],
        },
        {
          name: 'Guest',
          position: { x: 20, y: 20, width: 180, height: 90 },
          attributes: [],
          methods: [],
        },
      ],
    }

    const layout: GvLayout = {
      bboxWidth: 800,
      bboxHeight: 600,
      nodes: [
        { name: 'Unit', x: 110, y: 120, width: 180, height: 90 },
        { name: 'Guest', x: 420, y: 120, width: 180, height: 90 },
      ],
      edges: [],
    }

    const storedLayout: StoredLayoutMetadata = {
      hasStoredLayout: true,
      nodeNames: ['Unit'],
    }

    const result = convertClassDiagram(model, layout, storedLayout)
    const unitNode = result.nodes.find((node) => node.id === 'class-Unit')
    const guestNode = result.nodes.find((node) => node.id === 'class-Guest')

    expect(unitNode?.position).toEqual({ x: 320, y: 180 })
    expect(guestNode?.position).toEqual({ x: 330, y: 75 })
    expect(unitNode?.style).toMatchObject({ width: 180, height: 90 })
    expect(guestNode?.style).toMatchObject({ width: 180, height: 90 })
  })
})

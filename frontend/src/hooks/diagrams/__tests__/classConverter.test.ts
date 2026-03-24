import { describe, expect, it } from 'vitest'

import type { GvLayout, UmpleModel } from '@/api/types'
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
})

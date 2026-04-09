import { describe, expect, it } from 'vitest'
import type { CrudSchema } from '@/api/types'
import { assocKey } from '@/stores/crudStore'
import { generateInstanceDiagramDot } from '../instanceDiagram'

const reflexiveSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Person',
          roleName: 'advisor',
          reverseRoleName: 'advisees',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
          isReflexive: true,
        },
        {
          targetClass: 'Person',
          roleName: 'advisees',
          reverseRoleName: 'advisor',
          multiplicity: { min: 0, max: -1, raw: '*' },
          isNavigable: true,
          isComposition: false,
          isReflexive: true,
        },
        {
          targetClass: 'Person',
          roleName: 'mentor',
          reverseRoleName: 'mentees',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
          isReflexive: true,
        },
        {
          targetClass: 'Person',
          roleName: 'mentees',
          reverseRoleName: 'mentor',
          multiplicity: { min: 0, max: -1, raw: '*' },
          isNavigable: true,
          isComposition: false,
          isReflexive: true,
        },
      ],
    },
  ],
  enums: [],
}

describe('generateInstanceDiagramDot', () => {
  it('keeps distinct role-based associations between the same two instances', () => {
    const dot = generateInstanceDiagramDot(reflexiveSchema, {
      Person: [
        {
          _id: 1,
          [assocKey('advisor')]: 2,
          [assocKey('mentor')]: 2,
        },
        { _id: 2 },
      ],
    })

    expect(dot).toContain('Person_1 -> Person_2 [label="advisor"];')
    expect(dot).toContain('Person_1 -> Person_2 [label="mentor"];')
    expect((dot.match(/Person_1 -> Person_2/g) ?? [])).toHaveLength(2)
  })
})

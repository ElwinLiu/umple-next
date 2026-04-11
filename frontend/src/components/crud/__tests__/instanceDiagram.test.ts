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

const duplicateUnnamedAssociationSchema: CrudSchema = {
  classes: [
    {
      name: 'Order',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Account',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
        {
          targetClass: 'Account',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Account',
      isAbstract: false,
      attributes: [],
      associations: [],
    },
  ],
  enums: [],
}

const inheritedTargetSchema: CrudSchema = {
  classes: [
    {
      name: 'Segment',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'SegEnd',
          roleName: 'ends',
          reverseRoleName: 'segments',
          multiplicity: { min: 1, max: -1, raw: '1..*' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'SegEnd',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Segment',
          roleName: 'segments',
          reverseRoleName: 'ends',
          multiplicity: { min: 0, max: -1, raw: '*' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Bend',
      isAbstract: false,
      extendsClass: 'SegEnd',
      attributes: [],
      associations: [],
    },
  ],
  enums: [],
}

const inheritedSourceSchema: CrudSchema = {
  classes: [
    {
      name: 'Asset',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Owner',
          roleName: 'owner',
          reverseRoleName: 'assets',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Computer',
      isAbstract: false,
      extendsClass: 'Asset',
      attributes: [],
      associations: [],
    },
    {
      name: 'Owner',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Asset',
          roleName: 'assets',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: -1, raw: '*' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const inheritedReflexiveSchema: CrudSchema = {
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
      ],
    },
    {
      name: 'Student',
      isAbstract: false,
      extendsClass: 'Person',
      attributes: [],
      associations: [],
    },
  ],
  enums: [],
}

describe('generateInstanceDiagramDot', () => {
  it('keeps distinct role-based associations between the same two instances', () => {
    const advisorAssoc = reflexiveSchema.classes[0]!.associations[0]!
    const mentorAssoc = reflexiveSchema.classes[0]!.associations[2]!
    const dot = generateInstanceDiagramDot(reflexiveSchema, {
      Person: [
        {
          _id: 1,
          [assocKey(advisorAssoc)]: 2,
          [assocKey(mentorAssoc)]: 2,
        },
        { _id: 2 },
      ],
    })

    expect(dot).toContain('Person_1 -> Person_2 [label="advisor"];')
    expect(dot).toContain('Person_1 -> Person_2 [label="mentor"];')
    expect((dot.match(/Person_1 -> Person_2/g) ?? [])).toHaveLength(2)
  })

  it('keeps distinct unlabeled associations between the same two instances when declaration order differs', () => {
    const assocA = duplicateUnnamedAssociationSchema.classes[0]!.associations[0]!
    const assocB = duplicateUnnamedAssociationSchema.classes[0]!.associations[1]!

    const dot = generateInstanceDiagramDot(duplicateUnnamedAssociationSchema, {
      Order: [
        {
          _id: 1,
          [assocKey(assocA)]: 2,
          [assocKey(assocB)]: 2,
        },
      ],
      Account: [{ _id: 2 }],
    })

    expect((dot.match(/Order_1 -> Account_2/g) ?? [])).toHaveLength(2)
  })

  it('uses the real subclass node id for inherited association targets', () => {
    const segmentAssoc = inheritedTargetSchema.classes[0]!.associations[0]!

    const dot = generateInstanceDiagramDot(inheritedTargetSchema, {
      Segment: [{ _id: 1, [assocKey(segmentAssoc)]: 12 }],
      SegEnd: [],
      Bend: [{ _id: 12 }],
    })

    expect(dot).toContain('Bend_12 [label="Bend #12"];')
    expect(dot).toContain('Segment_1 -> Bend_12 [label="ends"];')
    expect(dot).not.toContain('Segment_1 -> SegEnd_12 [label="ends"];')
  })

  it('renders inherited associations for subclass instances', () => {
    const assetAssoc = inheritedSourceSchema.classes[0]!.associations[0]!

    const dot = generateInstanceDiagramDot(inheritedSourceSchema, {
      Asset: [],
      Computer: [{ _id: 7, [assocKey(assetAssoc)]: 3 }],
      Owner: [{ _id: 3 }],
    })

    expect(dot).toContain('Computer_7 [label="Computer #7"];')
    expect(dot).toContain('Owner_3 [label="Owner #3"];')
    expect(dot).toContain('Computer_7 -> Owner_3 [label="owner"];')
  })

  it('keeps both inherited self-association ends distinct when the inherited roles differ', () => {
    const advisorAssoc = inheritedReflexiveSchema.classes[0]!.associations[0]!
    const adviseesAssoc = inheritedReflexiveSchema.classes[0]!.associations[1]!

    const dot = generateInstanceDiagramDot(inheritedReflexiveSchema, {
      Person: [],
      Student: [
        { _id: 1, [assocKey(advisorAssoc)]: 2, [assocKey(adviseesAssoc)]: [3] },
        { _id: 2 },
        { _id: 3 },
      ],
    })

    expect(dot).toContain('Student_1 -> Student_2 [label="advisor"];')
    expect(dot).toContain('Student_1 -> Student_3 [label="advisees"];')
  })
})

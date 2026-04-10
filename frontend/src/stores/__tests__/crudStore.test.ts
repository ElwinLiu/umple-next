import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CrudSchema } from '@/api/types'
import {
  assocKey,
  reconcileInstances,
  reconcileInstancesDetailed,
  resolveSelectedClassName,
  useCrudStore,
  validateGlobalModel,
  validateInstance,
} from '../crudStore'

const baseCrudState = useCrudStore.getState()

const compositionSchema: CrudSchema = {
  classes: [
    {
      name: 'Company',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Department',
          roleName: 'departments',
          reverseRoleName: 'company',
          multiplicity: { min: 0, max: -1, raw: '*' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Department',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Company',
          roleName: 'company',
          reverseRoleName: 'departments',
          multiplicity: { min: 1, max: 1, raw: '1' },
          isNavigable: true,
          isComposition: true,
        },
      ],
    },
  ],
  enums: [],
}

const toOneReverseSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Locker',
          roleName: 'assignedLocker',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Person',
          roleName: 'owner',
          reverseRoleName: 'assignedLocker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const personOnlySchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personWithEmailSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
        { name: 'email', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personWithNicknameSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
        { name: 'nickname', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personWithHandleSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'handle', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personWithAliasSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'alias', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personWithDisplayNameSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'displayName', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personWithAliasAndNicknameSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'alias', type: 'String', typeKind: 'primitive', isInherited: false },
        { name: 'nickname', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personAgeAsStringSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'age', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personAgeAsIntegerSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'age', type: 'Integer', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personWithMandatoryLockerSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          targetClass: 'Locker',
          roleName: 'assignedLocker',
          reverseRoleName: '',
          multiplicity: { min: 1, max: 1, raw: '1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const deliveryOrderSchemaWithUnnamedRoles: CrudSchema = {
  classes: [
    {
      name: 'Order',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          id: 'assoc-delivery-order',
          endId: 'assoc-delivery-order:classTwo',
          sourceClassId: 'Order',
          targetClassId: 'Delivery',
          targetClass: 'Delivery',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Delivery',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          id: 'assoc-delivery-order',
          endId: 'assoc-delivery-order:classOne',
          sourceClassId: 'Delivery',
          targetClassId: 'Order',
          targetClass: 'Order',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 1, max: -1, raw: '1..*' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const duplicateUnnamedOrderAssociationsSchema: CrudSchema = {
  classes: [
    {
      name: 'Delivery',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          id: 'assoc-order-a',
          endId: 'assoc-order-a:classOne',
          sourceClassId: 'Delivery',
          targetClassId: 'Order',
          targetClass: 'Order',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 1, max: -1, raw: '1..*' },
          isNavigable: true,
          isComposition: false,
        },
        {
          id: 'assoc-order-b',
          endId: 'assoc-order-b:classOne',
          sourceClassId: 'Delivery',
          targetClassId: 'Order',
          targetClass: 'Order',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 1, max: -1, raw: '1..*' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Order',
      isAbstract: false,
      attributes: [],
      associations: [],
    },
  ],
  enums: [],
}

const randomBidirectionalSchema: CrudSchema = {
  classes: [
    {
      id: 'class-left',
      name: 'Left',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          id: 'assoc-left-right',
          endId: 'assoc-left-right:right',
          sourceClassId: 'class-left',
          targetClassId: 'class-right',
          targetClass: 'Right',
          roleName: 'right',
          reverseRoleName: 'left',
          multiplicity: { min: 1, max: 1, raw: '1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      id: 'class-right',
      name: 'Right',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          id: 'assoc-left-right',
          endId: 'assoc-left-right:left',
          sourceClassId: 'class-right',
          targetClassId: 'class-left',
          targetClass: 'Left',
          roleName: 'left',
          reverseRoleName: 'right',
          multiplicity: { min: 1, max: 1, raw: '1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const personWithNewClassSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
    {
      name: 'Course',
      isAbstract: false,
      attributes: [
        { name: 'code', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personLockerSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          targetClass: 'Locker',
          roleName: 'assignedLocker',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          targetClass: 'Person',
          roleName: 'owner',
          reverseRoleName: 'assignedLocker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const personManyLockersSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          targetClass: 'Locker',
          roleName: 'assignedLocker',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: -1, raw: '*' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          targetClass: 'Person',
          roleName: 'owner',
          reverseRoleName: 'assignedLocker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const personSchemaWithoutAssociations: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personCabinetSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          targetClass: 'Cabinet',
          roleName: 'assignedLocker',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
    {
      name: 'Cabinet',
      isAbstract: false,
      attributes: [
        { name: 'code', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          targetClass: 'Person',
          roleName: 'owner',
          reverseRoleName: 'assignedLocker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const renamedPersonSchema: CrudSchema = {
  classes: [
    {
      name: 'User',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const ambiguousOldRenameSchema: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
    {
      name: 'Customer',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const ambiguousNewRenameSchema: CrudSchema = {
  classes: [
    {
      name: 'Member',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personSchemaWithStableId: CrudSchema = {
  classes: [
    {
      id: 'class-person-1',
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const renamedUserSchemaWithStableId: CrudSchema = {
  classes: [
    {
      id: 'class-person-1',
      name: 'User',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [],
    },
  ],
  enums: [],
}

const personLockerSchemaWithStableAssocIds: CrudSchema = {
  classes: [
    {
      id: 'class-person-1',
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:right',
          sourceClassId: 'class-person-1',
          targetClassId: 'class-locker-1',
          targetClass: 'Locker',
          roleName: 'assignedLocker',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      id: 'class-locker-1',
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:left',
          sourceClassId: 'class-locker-1',
          targetClassId: 'class-person-1',
          targetClass: 'Person',
          roleName: 'owner',
          reverseRoleName: 'assignedLocker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const personLockerSchemaWithRenamedRoles: CrudSchema = {
  classes: [
    {
      id: 'class-person-1',
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:right',
          sourceClassId: 'class-person-1',
          targetClassId: 'class-locker-1',
          targetClass: 'Locker',
          roleName: 'locker',
          reverseRoleName: 'assignedPerson',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      id: 'class-locker-1',
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:left',
          sourceClassId: 'class-locker-1',
          targetClassId: 'class-person-1',
          targetClass: 'Person',
          roleName: 'assignedPerson',
          reverseRoleName: 'locker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const personLockerSchemaWithoutClassIds: CrudSchema = {
  classes: [
    {
      name: 'Person',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:classOne',
          sourceClassId: 'Person',
          targetClassId: 'Locker',
          targetClass: 'Locker',
          roleName: 'owner',
          reverseRoleName: 'assignedLocker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:classTwo',
          sourceClassId: 'Locker',
          targetClassId: 'Person',
          targetClass: 'Person',
          roleName: 'assignedLocker',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

const userLockerSchemaWithoutClassIds: CrudSchema = {
  classes: [
    {
      name: 'User',
      isAbstract: false,
      attributes: [
        { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:classOne',
          sourceClassId: 'User',
          targetClassId: 'Locker',
          targetClass: 'Locker',
          roleName: 'owner',
          reverseRoleName: 'assignedLocker',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Locker',
      isAbstract: false,
      attributes: [
        { name: 'number', type: 'String', typeKind: 'primitive', isInherited: false },
      ],
      associations: [
        {
          id: 'assoc-locker-1',
          endId: 'assoc-locker-1:classTwo',
          sourceClassId: 'Locker',
          targetClassId: 'User',
          targetClass: 'User',
          roleName: 'assignedLocker',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
  ],
  enums: [],
}

afterEach(() => {
  useCrudStore.setState({ ...baseCrudState })
})

describe('crudStore', () => {
  it('cascades composition deletes from the owner to its parts only', () => {
    useCrudStore.setState({ schema: compositionSchema })

    const companyId = useCrudStore.getState().createInstance('Company', {})
    const departmentId = useCrudStore.getState().createInstance('Department', {
      [assocKey('company')]: companyId,
    })

    useCrudStore.getState().deleteInstance('Department', departmentId)

    expect(useCrudStore.getState().instances.Company?.[0]).toMatchObject({ _id: companyId })
    expect(useCrudStore.getState().instances.Company?.[0]?.[assocKey('departments')]).toBeUndefined()
    expect(useCrudStore.getState().instances.Department).toEqual([])

    const replacementDepartmentId = useCrudStore.getState().createInstance('Department', {
      [assocKey('company')]: companyId,
    })

    expect(useCrudStore.getState().instances.Company).toEqual([
      { _id: companyId, [assocKey('departments')]: [replacementDepartmentId] },
    ])

    useCrudStore.getState().deleteInstance('Company', companyId)

    expect(useCrudStore.getState().instances.Company).toEqual([])
    expect(useCrudStore.getState().instances.Department).toEqual([])
  })

  it('rejects a second reverse to-one link during validation and reverse sync', () => {
    useCrudStore.setState({ schema: toOneReverseSchema })

    const lockerId = useCrudStore.getState().createInstance('Locker', {})
    const aliceId = useCrudStore.getState().createInstance('Person', {
      [assocKey('assignedLocker')]: lockerId,
    })

    const errors = validateInstance(
      toOneReverseSchema,
      'Person',
      { [assocKey('assignedLocker')]: lockerId },
      useCrudStore.getState().instances,
      null,
    )

    expect(errors).toContainEqual({
      field: assocKey('assignedLocker'),
      message: `Locker #${lockerId} already has the maximum number of owner links`,
    })

    const bobId = useCrudStore.getState().createInstance('Person', {
      [assocKey('assignedLocker')]: lockerId,
    })

    const locker = useCrudStore.getState().instances.Locker?.[0]
    const alice = useCrudStore.getState().instances.Person?.find((inst) => inst._id === aliceId)
    const bob = useCrudStore.getState().instances.Person?.find((inst) => inst._id === bobId)

    expect(locker).toEqual({ _id: lockerId, [assocKey('owner')]: aliceId })
    expect(alice).toEqual({ _id: aliceId, [assocKey('assignedLocker')]: lockerId })
    expect(bob).toMatchObject({ _id: bobId })
    expect(bob?.[assocKey('assignedLocker')]).toBeUndefined()
  })

  it('keeps class instances when a new attribute is added', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice' }],
    }

    const reconciled = reconcileInstances(personOnlySchema, personWithEmailSchema, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1, name: 'Alice' }],
    })
  })

  it('drops removed attributes but keeps the class instances', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice', nickname: 'Al' }],
    }

    const reconciled = reconcileInstances(personWithNicknameSchema, personOnlySchema, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1, name: 'Alice' }],
    })
  })

  it('preserves attribute values across a unique rename match', () => {
    const instances = {
      Person: [{ _id: 1, handle: 'alice' }],
    }

    const reconciled = reconcileInstancesDetailed(personWithHandleSchema, personWithAliasSchema, instances)

    expect(reconciled.instances).toEqual({
      Person: [{ _id: 1, alias: 'alice' }],
    })
    expect(reconciled.adjustments).toContain(
      `Attribute 'handle' in class 'Person' was renamed to 'alias'. Existing data was preserved because the attribute type did not change.`,
    )
  })

  it('does not guess an attribute rename when the match is ambiguous', () => {
    const instances = {
      Person: [{ _id: 1, alias: 'ally', nickname: 'alice' }],
    }

    const reconciled = reconcileInstancesDetailed(personWithAliasAndNicknameSchema, personWithDisplayNameSchema, instances)

    expect(reconciled.instances).toEqual({
      Person: [{ _id: 1 }],
    })
  })

  it('coerces compatible attribute type changes', () => {
    const instances = {
      Person: [{ _id: 1, age: '42' }],
    }

    const reconciled = reconcileInstances(personAgeAsStringSchema, personAgeAsIntegerSchema, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1, age: 42 }],
    })
  })

  it('clears incompatible attribute values after a type change', () => {
    const instances = {
      Person: [{ _id: 1, age: 'not-a-number' }],
    }

    const reconciled = reconcileInstances(personAgeAsStringSchema, personAgeAsIntegerSchema, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1 }],
    })
  })

  it('records attribute type-change adjustments when incompatible values are dropped', () => {
    const instances = {
      Person: [{ _id: 1, age: 'not-a-number' }],
    }

    const reconciled = reconcileInstancesDetailed(personAgeAsStringSchema, personAgeAsIntegerSchema, instances)

    expect(reconciled.adjustments).toContain(
      `Data type of attribute 'age' in class 'Person' was updated from String to Integer. Existing data was removed from 1 instance(s) because it is not compatible with the new type.`,
    )
  })

  it('keeps existing instances when an unrelated class is added', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice' }],
    }

    const reconciled = reconcileInstances(personOnlySchema, personWithNewClassSchema, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1, name: 'Alice' }],
      Course: [],
    })
  })

  it('removes deleted classes and prunes links from surviving instances', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice', [assocKey('assignedLocker')]: 2 }],
      Locker: [{ _id: 2, number: 'L1', [assocKey('owner')]: 1 }],
    }

    const reconciled = reconcileInstances(personLockerSchema, personOnlySchema, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1, name: 'Alice' }],
    })
  })

  it('drops removed associations but keeps the instances', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice', [assocKey('assignedLocker')]: 2 }],
      Locker: [{ _id: 2, number: 'L1', [assocKey('owner')]: 1 }],
    }

    const reconciled = reconcileInstances(personLockerSchema, personSchemaWithoutAssociations, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1, name: 'Alice' }],
      Locker: [{ _id: 2, number: 'L1' }],
    })
  })

  it('clears association links when the target class changes', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice', [assocKey('assignedLocker')]: 2 }],
      Locker: [{ _id: 2, number: 'L1', [assocKey('owner')]: 1 }],
      Cabinet: [],
    }

    const reconciled = reconcileInstances(personLockerSchema, personCabinetSchema, instances)

    expect(reconciled).toEqual({
      Person: [{ _id: 1, name: 'Alice' }],
      Locker: [{ _id: 2, number: 'L1' }],
      Cabinet: [],
    })
  })

  it('records association adjustments when links are trimmed by a tighter multiplicity', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice', [assocKey('assignedLocker')]: [2, 3] }],
      Locker: [
        { _id: 2, number: 'L1', [assocKey('owner')]: 1 },
        { _id: 3, number: 'L2', [assocKey('owner')]: 1 },
      ],
    }

    const reconciled = reconcileInstancesDetailed(personManyLockersSchema, personLockerSchema, instances)

    expect(reconciled.instances).toEqual({
      Person: [{ _id: 1, name: 'Alice', [assocKey('assignedLocker')]: 2 }],
      Locker: [
        { _id: 2, number: 'L1', [assocKey('owner')]: 1 },
        { _id: 3, number: 'L2' },
      ],
    })
    expect(reconciled.adjustments).toContain(
      `Existing links for association 'assignedLocker' from Person to Locker were trimmed to satisfy the updated multiplicity constraints.`,
    )
  })

  it('preserves class instances across rename when class shape matches uniquely', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice' }],
    }

    const reconciled = reconcileInstances(personOnlySchema, renamedPersonSchema, instances)

    expect(reconciled).toEqual({
      User: [{ _id: 1, name: 'Alice' }],
    })
  })

  it('preserves class instances across rename when class ids match', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice' }],
    }

    const reconciled = reconcileInstances(personSchemaWithStableId, renamedUserSchemaWithStableId, instances)

    expect(reconciled).toEqual({
      User: [{ _id: 1, name: 'Alice' }],
    })
  })

  it('preserves association links when a class is renamed heuristically', () => {
    const userAssoc = userLockerSchemaWithoutClassIds.classes[0]!.associations[0]!
    const lockerAssoc = userLockerSchemaWithoutClassIds.classes[1]!.associations[0]!
    const instances = {
      Person: [{ _id: 1, name: 'Alice', [assocKey('owner')]: 2 }],
      Locker: [{ _id: 2, number: 'L1', [assocKey('assignedLocker')]: 1 }],
    }

    const reconciled = reconcileInstances(personLockerSchemaWithoutClassIds, userLockerSchemaWithoutClassIds, instances)

    expect(reconciled).toEqual({
      User: [{ _id: 1, name: 'Alice', [assocKey(userAssoc)]: 2 }],
      Locker: [{ _id: 2, number: 'L1', [assocKey(lockerAssoc)]: 1 }],
    })
  })

  it('rejects ambiguous class rename matches', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice' }],
      Customer: [{ _id: 2, name: 'Bob' }],
    }

    const reconciled = reconcileInstances(ambiguousOldRenameSchema, ambiguousNewRenameSchema, instances)

    expect(reconciled).toEqual({
      Member: [],
    })
  })

  it('remaps the selected class when a heuristic rename matches uniquely', () => {
    expect(resolveSelectedClassName(personOnlySchema, renamedPersonSchema, 'Person')).toBe('User')
  })

  it('does not guess a selected-class rename when the heuristic is ambiguous', () => {
    expect(resolveSelectedClassName(ambiguousOldRenameSchema, ambiguousNewRenameSchema, 'Person')).toBeNull()
  })

  it('preserves association links across role rename when association ids match', () => {
    const personAssoc = personLockerSchemaWithRenamedRoles.classes[0]!.associations[0]!
    const lockerAssoc = personLockerSchemaWithRenamedRoles.classes[1]!.associations[0]!
    const instances = {
      Person: [{ _id: 1, name: 'Alice', [assocKey('assignedLocker')]: 2 }],
      Locker: [{ _id: 2, number: 'L1', [assocKey('owner')]: 1 }],
    }

    const reconciled = reconcileInstances(
      personLockerSchemaWithStableAssocIds,
      personLockerSchemaWithRenamedRoles,
      instances,
    )

    expect(reconciled).toEqual({
      Person: [{ _id: 1, name: 'Alice', [assocKey(personAssoc)]: 2 }],
      Locker: [{ _id: 2, number: 'L1', [assocKey(lockerAssoc)]: 1 }],
    })
  })

  it('reports global validation errors when schema evolution makes existing instances invalid', () => {
    const instances = {
      Person: [{ _id: 1, name: 'Alice' }],
      Locker: [],
    }

    const result = validateGlobalModel(personWithMandatoryLockerSchema, instances)

    expect(result.count).toBe(1)
    expect(result.messages).toEqual([
      `Conflict: Person cannot exist without Locker according to the updated association. Create at least one Locker instance and associate it with the existing Person instances.`,
    ])
  })

  it('accepts unnamed association links stored under the association end id during global validation', () => {
    const deliveryAssoc = deliveryOrderSchemaWithUnnamedRoles.classes[1]!.associations[0]!
    const instances = {
      Order: [{ _id: 2 }],
      Delivery: [{ _id: 3, [assocKey(deliveryAssoc)]: [2] }],
    }

    const result = validateGlobalModel(deliveryOrderSchemaWithUnnamedRoles, instances)

    expect(result.count).toBe(0)
    expect(result.messages).toEqual([])
  })

  it('keeps duplicate unnamed association violations as separate messages', () => {
    const instances = {
      Delivery: [{ _id: 1 }],
      Order: [{ _id: 2 }],
    }

    const result = validateGlobalModel(duplicateUnnamedOrderAssociationsSchema, instances)

    expect(result.count).toBe(2)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]).not.toContain("''")
    expect(result.messages[0]).toBe('Please associate Delivery #1 with at least 1 Order instances.')
    expect(result.messages[1]).toBe('Please associate Delivery #1 with at least 1 Order instances.')
  })

  it('normalizes legacy role-based association keys on import', () => {
    useCrudStore.setState({ schema: personLockerSchemaWithStableAssocIds })

    const imported = useCrudStore.getState().importJson(JSON.stringify({
      instances: {
        Person: [{ _id: 1, name: 'Alice', [assocKey('assignedLocker')]: 2 }],
        Locker: [{ _id: 2, number: 'L1', [assocKey('owner')]: 1 }],
      },
      nextId: 3,
    }))

    const personAssoc = personLockerSchemaWithStableAssocIds.classes[0]!.associations[0]!
    const lockerAssoc = personLockerSchemaWithStableAssocIds.classes[1]!.associations[0]!
    const state = useCrudStore.getState()

    expect(imported).toBe(true)
    expect(state.instances.Person).toEqual([{ _id: 1, name: 'Alice', [assocKey(personAssoc)]: 2 }])
    expect(state.instances.Locker).toEqual([{ _id: 2, number: 'L1', [assocKey(lockerAssoc)]: 1 }])
  })

  it('deduplicates bidirectional random generation by association identity', () => {
    useCrudStore.setState({ schema: randomBidirectionalSchema })
    const randomValues = [0.9, 0.9, 0.1, 0.1, 0.1, 0.9, 0.1]
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => randomValues.shift() ?? 0.1)

    try {
      useCrudStore.getState().generateRandomAll()
    } finally {
      randomSpy.mockRestore()
    }

    const state = useCrudStore.getState()
    const leftAssoc = randomBidirectionalSchema.classes[0]!.associations[0]!
    const rightAssoc = randomBidirectionalSchema.classes[1]!.associations[0]!

    expect(state.instances.Left).toHaveLength(2)
    expect(state.instances.Right).toHaveLength(2)

    for (const left of state.instances.Left ?? []) {
      const rightId = left[assocKey(leftAssoc)]
      expect(typeof rightId).toBe('number')

      const right = state.instances.Right?.find((candidate) => candidate._id === rightId)
      expect(right?.[assocKey(rightAssoc)]).toBe(left._id)
    }

    const linkedRightIds = (state.instances.Left ?? []).map((left) => left[assocKey(leftAssoc)])
    expect(new Set(linkedRightIds).size).toBe(2)
  })
})

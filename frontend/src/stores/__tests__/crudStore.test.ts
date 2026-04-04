import { afterEach, describe, expect, it } from 'vitest'
import type { CrudSchema } from '@/api/types'
import { assocKey, useCrudStore, validateInstance } from '../crudStore'

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
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { CrudSchema } from '@/api/types'
import { assocKey, useCrudStore } from '@/stores/crudStore'
import { InstanceEditor } from '../InstanceEditor'

const baseCrudState = useCrudStore.getState()

const inheritedEditorSchema: CrudSchema = {
  classes: [
    {
      name: 'Owner',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Asset',
          roleName: 'asset',
          reverseRoleName: 'owner',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
      ],
    },
    {
      name: 'Asset',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          targetClass: 'Owner',
          roleName: 'owner',
          reverseRoleName: 'asset',
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
      attributes: [{ name: 'name', type: 'String', typeKind: 'primitive', isInherited: false }],
      associations: [],
    },
  ],
  enums: [],
}

afterEach(() => {
  cleanup()
  useCrudStore.setState({ ...baseCrudState })
})

describe('InstanceEditor', () => {
  it('shows inherited association fields when editing a subclass instance', () => {
    const assetAssoc = inheritedEditorSchema.classes[1]!.associations[0]!

    useCrudStore.setState({
      schema: inheritedEditorSchema,
      editingInstance: { className: 'Computer', instanceId: 2 },
      instances: {
        Owner: [{ _id: 1 }],
        Asset: [],
        Computer: [{ _id: 2, name: 'Workstation', [assocKey(assetAssoc)]: 1 }],
      },
    })

    render(<InstanceEditor />)

    expect(screen.getByText('owner')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Owner #1' })).toBeTruthy()
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('1')
  })
})

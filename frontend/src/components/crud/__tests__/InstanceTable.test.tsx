// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { CrudSchema } from '@/api/types'
import { assocKey, useCrudStore } from '@/stores/crudStore'
import { InstanceTable } from '../InstanceTable'

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>{children}</button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const baseCrudState = useCrudStore.getState()

const unnamedAssociationSchema: CrudSchema = {
  classes: [
    {
      name: 'Order',
      isAbstract: false,
      attributes: [],
      associations: [
        {
          id: 'order-account',
          endId: 'order-account:order',
          sourceClassId: 'Order',
          targetClassId: 'Account',
          targetClass: 'Account',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 0, max: 1, raw: '0..1' },
          isNavigable: true,
          isComposition: false,
        },
        {
          id: 'order-item',
          endId: 'order-item:order',
          sourceClassId: 'Order',
          targetClassId: 'OrderItem',
          targetClass: 'OrderItem',
          roleName: '',
          reverseRoleName: '',
          multiplicity: { min: 1, max: -1, raw: '*' },
          isNavigable: true,
          isComposition: false,
        },
        {
          id: 'order-delivery',
          endId: 'order-delivery:order',
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
      name: 'Account',
      isAbstract: false,
      attributes: [{ name: 'name', type: 'String', typeKind: 'primitive', isInherited: false }],
      associations: [],
    },
    {
      name: 'OrderItem',
      isAbstract: false,
      attributes: [],
      associations: [],
    },
    {
      name: 'Delivery',
      isAbstract: false,
      attributes: [],
      associations: [],
    },
  ],
  enums: [],
}

afterEach(() => {
  cleanup()
  useCrudStore.setState({ ...baseCrudState })
})

describe('InstanceTable', () => {
  it('does not leak an unnamed association value into other unnamed associations', () => {
    const accountAssoc = unnamedAssociationSchema.classes[0]!.associations[0]!

    useCrudStore.setState({
      schema: unnamedAssociationSchema,
      instances: {
        Order: [{ _id: 10, [assocKey(accountAssoc)]: 5 }],
        Account: [{ _id: 5, name: 'Ada' }],
        OrderItem: [],
        Delivery: [],
      },
    })

    const { container } = render(<InstanceTable cls={unnamedAssociationSchema.classes[0]!} />)

    const expandButton = container.querySelector('tbody button')
    expect(expandButton).toBeTruthy()
    fireEvent.click(expandButton as HTMLButtonElement)

    expect(screen.getByText('Account #5 - Ada')).toBeTruthy()
    expect(screen.queryAllByText('#5 (deleted)')).toHaveLength(0)
  })
})

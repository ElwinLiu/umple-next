// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { CrudSchema } from '@/api/types'
import { buildCrudSchemaRequestKey, useCrudStore } from '@/stores/crudStore'
import { useSessionStore } from '@/stores/sessionStore'
import { ObjectExplorer } from '../ObjectExplorer'

vi.mock('../ClassList', () => ({
  ClassList: () => <div data-testid="class-list" />,
}))

vi.mock('../InstanceTable', () => ({
  InstanceTable: () => <div data-testid="instance-table" />,
}))

vi.mock('../InstanceEditor', () => ({
  InstanceEditor: () => <div data-testid="instance-editor" />,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/diagram/SmartSvgView', () => ({
  SmartSvgView: () => <div data-testid="smart-svg-view" />,
}))

const baseCrudState = useCrudStore.getState()

const schema: CrudSchema = {
  classes: [
    {
      name: 'Student',
      isAbstract: false,
      attributes: [],
      associations: [],
    },
  ],
  enums: [],
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  useCrudStore.setState({ ...baseCrudState })
  useSessionStore.setState({ code: '', modelId: null })
})

describe('ObjectExplorer', () => {
  it('does not refetch the schema when remounted for the same model input', () => {
    const fetchSchema = vi.fn()
    const code = 'class Student {}'
    const modelId = 'model-1'

    useCrudStore.setState({
      schema,
      selectedClass: 'Student',
      schemaRequestKey: buildCrudSchemaRequestKey(code),
      fetchSchema,
    })
    useSessionStore.setState({ code, modelId })

    const firstRender = render(<ObjectExplorer />)
    expect(fetchSchema).not.toHaveBeenCalled()

    firstRender.unmount()
    render(<ObjectExplorer />)

    expect(fetchSchema).not.toHaveBeenCalled()
  })

  it('fetches the schema when the current model input changes', () => {
    const fetchSchema = vi.fn()

    useCrudStore.setState({
      schema: null,
      schemaRequestKey: buildCrudSchemaRequestKey('class Person {}'),
      fetchSchema,
    })
    useSessionStore.setState({ code: 'class Student {}', modelId: 'model-1' })

    render(<ObjectExplorer />)

    expect(fetchSchema).toHaveBeenCalledWith('class Student {}', 'model-1')
  })
})

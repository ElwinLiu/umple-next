// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '../sessionStore'

describe('sessionStore class filters', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useSessionStore.setState({
      classFilterQuery: '*',
      activeNamedFilters: [],
      activeMixsets: [],
    })
  })

  it('normalizes blank class filter queries to the legacy default value', () => {
    useSessionStore.getState().setClassFilterQuery('   ')

    expect(useSessionStore.getState().classFilterQuery).toBe('*')
  })

  it('prunes stale named filters and mixsets when declarations disappear', () => {
    useSessionStore.setState({
      activeNamedFilters: ['KeepFilter', 'DropFilter'],
      activeMixsets: ['DropMixset', 'KeepMixset'],
    })

    useSessionStore.getState().reconcileClassDiagramFilters(['KeepFilter'], ['KeepMixset'])

    expect(useSessionStore.getState().activeNamedFilters).toEqual(['KeepFilter'])
    expect(useSessionStore.getState().activeMixsets).toEqual(['KeepMixset'])
  })
})

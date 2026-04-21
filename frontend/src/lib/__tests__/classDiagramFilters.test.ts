// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  buildClassDiagramFilterRequestFields,
  discoverNamedClassDiagramOverlays,
  normalizeClassFilterQuery,
} from '../classDiagramFilters'

describe('classDiagramFilters', () => {
  it('discovers named filters and mixsets while ignoring commented declarations', () => {
    const discovered = discoverNamedClassDiagramOverlays([
      {
        code: `
          // filter HiddenByComment {
          mixset VisibleMixset {
          }
          filter VisibleFilter {
          }
          /* mixset BlockCommented {
          } */
        `,
      },
      {
        code: `
          filter 7 {
          }
          // mixset IgnoredLineComment {
          // }
          mixset AlsoVisible {
          }
        `,
      },
    ])

    expect(discovered.namedFilters).toEqual(['7', 'VisibleFilter'])
    expect(discovered.mixsets).toEqual(['AlsoVisible', 'VisibleMixset'])
  })

  it('builds request fields only when the class filter state is active', () => {
    expect(buildClassDiagramFilterRequestFields('*', [], [])).toEqual({})

    expect(
      buildClassDiagramFilterRequestFields('  Invoice   ~Archived 2  ', ['F1'], ['M2']),
    ).toEqual({
      classFilterQuery: 'Invoice ~Archived 2',
      namedFilters: ['F1'],
      mixsets: ['M2'],
    })
  })

  it('normalizes blank class filter queries back to the legacy default', () => {
    expect(normalizeClassFilterQuery('   ')).toBe('*')
  })
})

import { describe, expect, it } from 'vitest'

import {
  APP_TOOLBAR_GENERATE_TARGET_GROUPS,
  GENERATE_TARGET_GROUPS,
  getGenerateTarget,
} from './targets'

function groupContainsDiagram(group: { targets: { action: 'generate' | 'diagram' }[] }) {
  return group.targets.some((target) => target.action === 'diagram')
}

describe('APP_TOOLBAR_GENERATE_TARGET_GROUPS', () => {
  it('starts with diagram-capable groups before code-generation-only groups', () => {
    const firstNonDiagramGroupIndex = APP_TOOLBAR_GENERATE_TARGET_GROUPS.findIndex(
      (group) => !groupContainsDiagram(group),
    )

    expect(firstNonDiagramGroupIndex).toBeGreaterThan(0)
    expect(
      APP_TOOLBAR_GENERATE_TARGET_GROUPS.slice(0, firstNonDiagramGroupIndex).every(groupContainsDiagram),
    ).toBe(true)
    expect(APP_TOOLBAR_GENERATE_TARGET_GROUPS[firstNonDiagramGroupIndex]?.label).toBe(
      'Programming Language Code',
    )
  })

  it('keeps the same group count as the canonical target list', () => {
    expect(APP_TOOLBAR_GENERATE_TARGET_GROUPS).toHaveLength(GENERATE_TARGET_GROUPS.length)
  })

  it('puts diagram entries first inside mixed groups', () => {
    const specialViewsGroup = APP_TOOLBAR_GENERATE_TARGET_GROUPS.find(
      (group) => group.label === 'Special Views',
    )

    expect(specialViewsGroup?.targets.slice(0, 2).map((target) => target.id)).toEqual([
      'featureDiagram',
      'StructureDiagram',
    ])
  })

  it('keeps legacy generate-menu labels for targets that still exist', () => {
    expect(getGenerateTarget('crud')?.label).toBe('CRUD User Interface')
    expect(getGenerateTarget('SimpleCpp')?.label).toBe('Simple C++ (under development)')
  })
})

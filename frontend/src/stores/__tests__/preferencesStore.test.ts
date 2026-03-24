// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { buildSuboptions } from '../preferencesStore'

describe('buildSuboptions', () => {
  it('keeps showmethods enabled for class trait diagrams', () => {
    const suboptions = buildSuboptions({
      showAttributes: true,
      showMethods: true,
      showTraits: true,
      showActions: true,
      showTransitionLabels: false,
      showGuards: true,
      showGuardLabels: false,
      showNaturalLanguage: true,
      showFeatureDependency: false,
      layoutAlgorithm: 'dot',
    }, 'class', false)

    expect(suboptions).toContain('showmethods')
  })
})

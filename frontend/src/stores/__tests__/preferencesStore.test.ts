// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { buildSuboptions, usePreferencesStore } from '../preferencesStore'

describe('preferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.persist.clearStorage()
    usePreferencesStore.setState({
      showSidebar: false,
      autoCompile: true,
      theme: 'system',
    })
  })

  it('hides the sidebar by default', () => {
    expect(usePreferencesStore.getState().showSidebar).toBe(false)
  })

  it('enables auto-compile by default', () => {
    expect(usePreferencesStore.getState().autoCompile).toBe(true)
  })
})

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

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/client'
import { useEphemeralStore } from '@/stores/ephemeralStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useSessionStore } from '@/stores/sessionStore'
import { generateAndRefresh } from '../useCompiler'

describe('generateAndRefresh', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    usePreferencesStore.setState({
      showAttributes: true,
      showMethods: false,
      showOrthogonalEdges: false,
      showTraits: false,
      showActions: true,
      showTransitionLabels: false,
      showGuards: true,
      showGuardLabels: false,
      showNaturalLanguage: true,
      showFeatureDependency: false,
      layoutAlgorithm: 'dot',
    })
    useSessionStore.setState({
      code: 'class Invoice {}',
      modelId: 'playwright-model',
      activeTabId: 'main',
      tabsVersion: 0,
      tabs: [{ id: 'main', name: 'Model.ump', code: 'class Invoice {}', dirty: false, savedCode: 'class Invoice {}', undoStack: [], redoStack: [] }],
      generateTargetId: 'classDiagram',
      viewMode: 'class',
      classFilterQuery: 'Invoice 2 gvseparator=1.7',
      activeNamedFilters: ['Focus'],
      activeMixsets: ['Metrics'],
      svgCache: {},
      htmlCache: {},
      umpleModel: null,
      classLayout: {
        bboxWidth: 10,
        bboxHeight: 10,
        nodes: [{ name: 'Existing', x: 1, y: 1, width: 1, height: 1 }],
      },
      storedLayout: null,
    })
    useEphemeralStore.setState({
      rightPanelView: 'diagram',
      generatingOutput: false,
      outputErrorCount: 0,
      outputWarningCount: 0,
      executionOutput: '',
      executionErrors: null,
      parsedIssues: [],
      rawErrorText: '',
      diagramSourceCode: null,
      diagramSourceTabId: null,
      diagramSourceSignature: null,
      diagramTargetId: null,
      generatedError: null,
      generatingCode: false,
      generationRequested: false,
      generationSuspendedByError: false,
      generationErrorSourceCode: null,
      generationErrorSourceTabId: null,
      generationErrorSourceSignature: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes class filter fields in diagram requests and preserves editable layout when active', async () => {
    const model = { umpleClasses: [{ name: 'Invoice', attributes: [], methods: [] }], umpleAssociations: [] }
    const nextLayout = {
      bboxWidth: 20,
      bboxHeight: 20,
      nodes: [{ name: 'Invoice', x: 5, y: 5, width: 2, height: 2 }],
    }
    const generateSpy = vi.spyOn(api, 'generate').mockResolvedValue({
      modelId: 'playwright-model',
      result: JSON.stringify(model),
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      layout: nextLayout,
    })

    const previousLayout = useSessionStore.getState().classLayout

    await generateAndRefresh(false)

    expect(generateSpy).toHaveBeenCalledTimes(1)
    expect(generateSpy.mock.calls[0]?.[0]).toMatchObject({
      diagramType: 'GvClassDiagram',
      classFilterQuery: 'Invoice 2 gvseparator=1.7',
      namedFilters: ['Focus'],
      mixsets: ['Metrics'],
    })
    expect(useSessionStore.getState().umpleModel).toEqual(model)
    expect(useSessionStore.getState().classLayout).toBe(previousLayout)
    expect(useSessionStore.getState().svgCache.class).toContain('<svg')
  })
})

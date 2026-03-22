import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export type DiagramView = 'class' | 'state' | 'feature' | 'structure'
export type RenderMode = 'reactflow' | 'graphviz'
export type GvLayoutAlgorithm = 'dot' | 'sfdp' | 'circo' | 'neato' | 'fdp' | 'twopi'

/** Maps frontend view modes to Umple Graphviz generation types */
export const VIEW_TO_GV_TYPE: Record<DiagramView, string> = {
  class: 'GvClassDiagram',
  state: 'GvStateDiagram',
  feature: 'GvFeatureDiagram',
  structure: 'GvClassTraitDiagram',
}

/** All display preference keys */
export type DisplayPrefKey =
  | 'showAttributes' | 'showMethods' | 'showTraits'
  | 'showActions' | 'showTransitionLabels' | 'showGuards' | 'showGuardLabels' | 'showNaturalLanguage'
  | 'showFeatureDependency'

interface DiagramState {
  viewMode: DiagramView
  renderMode: RenderMode
  nodes: Node[]
  edges: Edge[]
  stateNodes: Node[]
  stateEdges: Edge[]
  featureNodes: Node[]
  featureEdges: Edge[]
  structureText: string
  gvSvg: string
  /** Cached SVG per diagram view so switching back is instant */
  svgCache: Partial<Record<DiagramView, string>>
  selectedNodeId: string | null
  compiling: boolean
  lastError: string | null

  // Display preferences (class diagram)
  showAttributes: boolean
  showMethods: boolean
  showTraits: boolean
  // Display preferences (state diagram)
  showActions: boolean
  showTransitionLabels: boolean
  showGuards: boolean
  showGuardLabels: boolean
  showNaturalLanguage: boolean
  // Display preferences (feature diagram)
  showFeatureDependency: boolean
  // Graphviz layout algorithm
  layoutAlgorithm: GvLayoutAlgorithm

  setViewMode: (mode: DiagramView) => void
  setRenderMode: (mode: RenderMode) => void
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  setStateNodes: (nodes: Node[]) => void
  setStateEdges: (edges: Edge[]) => void
  setFeatureNodes: (nodes: Node[]) => void
  setFeatureEdges: (edges: Edge[]) => void
  setStructureText: (text: string) => void
  setGvSvg: (svg: string) => void
  setSvgForView: (view: DiagramView, svg: string) => void
  clearSvgCache: () => void
  setSelectedNode: (id: string | null) => void
  setCompiling: (compiling: boolean) => void
  setLastError: (error: string | null) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  setDisplayPref: (key: DisplayPrefKey, value: boolean) => void
  toggleDisplayPref: (key: DisplayPrefKey) => void
  setLayoutAlgorithm: (algo: GvLayoutAlgorithm) => void
}

export const useDiagramStore = create<DiagramState>((set) => ({
  viewMode: 'class',
  renderMode: 'reactflow',
  nodes: [],
  edges: [],
  stateNodes: [],
  stateEdges: [],
  featureNodes: [],
  featureEdges: [],
  structureText: '',
  gvSvg: '',
  svgCache: {},
  selectedNodeId: null,
  compiling: false,
  lastError: null,

  // Display preference defaults (match Umple compiler defaults)
  showAttributes: true,
  showMethods: false,
  showTraits: false,
  showActions: true,
  showTransitionLabels: false,
  showGuards: true,
  showGuardLabels: false,
  showNaturalLanguage: true,
  showFeatureDependency: false,
  layoutAlgorithm: 'dot',

  setViewMode: (viewMode) => set({ viewMode }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setStateNodes: (stateNodes) => set({ stateNodes }),
  setStateEdges: (stateEdges) => set({ stateEdges }),
  setFeatureNodes: (featureNodes) => set({ featureNodes }),
  setFeatureEdges: (featureEdges) => set({ featureEdges }),
  setStructureText: (structureText) => set({ structureText }),
  setGvSvg: (gvSvg) => set({ gvSvg }),
  setSvgForView: (view, svg) =>
    set((s) => ({ svgCache: { ...s.svgCache, [view]: svg } })),
  clearSvgCache: () => set({ svgCache: {} }),
  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
  setCompiling: (compiling) => set({ compiling }),
  setLastError: (lastError) => set({ lastError }),
  updateNodePosition: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n
      ),
    })),
  setDisplayPref: (key, value) => set({ [key]: value }),
  toggleDisplayPref: (key) => set((s) => ({ [key]: !s[key] })),
  setLayoutAlgorithm: (layoutAlgorithm) => set({ layoutAlgorithm }),
}))

/** Returns the effective diagram type, accounting for the Traits toggle.
 *  When showTraits is ON for class diagrams, use GvClassTraitDiagram instead. */
export function getEffectiveDiagramType(viewMode: DiagramView, showTraits: boolean): string {
  if (viewMode === 'class' && showTraits) return 'GvClassTraitDiagram'
  return VIEW_TO_GV_TYPE[viewMode]
}

/** Builds the suboptions array to send to the backend based on current display preferences.
 *  Only includes flags that differ from Umple's defaults. */
export function buildSuboptions(state: DiagramState, viewMode: DiagramView, isDark: boolean): string[] {
  const opts: string[] = []

  if (viewMode === 'class') {
    if (!state.showAttributes) opts.push('hideattributes')
    if (state.showMethods) opts.push('showmethods')
    // showTraits is handled via getEffectiveDiagramType, not a suboption
  } else if (viewMode === 'state') {
    if (!state.showActions) opts.push('hideactions')
    if (state.showTransitionLabels) opts.push('showtransitionlabels')
    if (!state.showGuards) opts.push('hideguards')
    if (state.showGuardLabels) opts.push('showguardlabels')
    if (!state.showNaturalLanguage) opts.push('hidenaturallanguage')
  } else if (viewMode === 'feature') {
    if (state.showFeatureDependency) opts.push('showFeatureDependency')
  }

  // Layout algorithm (dot is the default, so only send non-default)
  if (state.layoutAlgorithm !== 'dot') {
    opts.push('gv' + state.layoutAlgorithm)
  }

  if (isDark) opts.push('gvdark')

  return opts
}

/** Selector that returns a stable key representing all display preferences.
 *  Use as an effect dependency to trigger diagram refresh on pref changes. */
export function selectSuboptionsKey(s: DiagramState): string {
  return JSON.stringify([
    s.showAttributes, s.showMethods, s.showTraits,
    s.showActions, s.showTransitionLabels, s.showGuards, s.showGuardLabels, s.showNaturalLanguage,
    s.showFeatureDependency, s.layoutAlgorithm,
  ])
}

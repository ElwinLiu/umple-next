import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export type DiagramView = 'class' | 'state' | 'feature' | 'structure' | 'erd' | 'instance' | 'eventSequence' | 'stateTables'
type RenderMode = 'reactflow' | 'graphviz'
export type GvLayoutAlgorithm = 'dot' | 'sfdp' | 'circo' | 'neato' | 'fdp' | 'twopi'

/** Maps frontend view modes to Umple generation types.
 *  NOTE: 'structure' maps to StructureDiagram (composite structure with ports
 *  and bindings). Unlike the Graphviz diagram types, this generator returns
 *  HTML/JS that renders into an SVG canvas. */
const VIEW_TO_GV_TYPE: Record<DiagramView, string> = {
  class: 'GvClassDiagram',
  state: 'GvStateDiagram',
  feature: 'GvFeatureDiagram',
  structure: 'StructureDiagram',
  erd: 'GvEntityRelationshipDiagram',
  instance: 'InstanceDiagram',
  eventSequence: 'EventSequence',
  stateTables: 'StateTables',
}

/** Classifies each view by its backend output kind */
export const VIEW_OUTPUT_KIND: Record<DiagramView, 'gv' | 'html'> = {
  class: 'gv', state: 'gv', feature: 'gv', structure: 'html',
  erd: 'gv', instance: 'gv',
  eventSequence: 'html', stateTables: 'html',
}

/** All display preference keys */
export type DisplayPrefKey =
  | 'showAttributes' | 'showMethods' | 'showTraits'
  | 'showActions' | 'showTransitionLabels' | 'showGuards' | 'showGuardLabels' | 'showNaturalLanguage'
  | 'showFeatureDependency'

export interface DiagramElements {
  nodes: Node[]
  edges: Edge[]
}

export const EMPTY_DIAGRAM_ELEMENTS: DiagramElements = { nodes: [], edges: [] }

interface DiagramState {
  viewMode: DiagramView
  renderMode: RenderMode
  diagramData: Partial<Record<DiagramView, DiagramElements>>
  /** Cached SVG per diagram view so switching back is instant */
  svgCache: Partial<Record<DiagramView, string>>
  /** Cached HTML per diagram view (for EventSequence, StateTables) */
  htmlCache: Partial<Record<DiagramView, string>>
  selectedNodeId: string | null
  selectedEdgeId: string | null
  editingNodeId: string | null
  editingField: 'name' | 'newAttribute' | 'newMethod' | null
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
  setDiagramData: (view: DiagramView, nodes: Node[], edges: Edge[]) => void
  getDiagramData: (view: DiagramView) => DiagramElements
  clearDiagramData: (view?: DiagramView) => void
  setSvgForView: (view: DiagramView, svg: string) => void
  clearSvgCache: () => void
  setHtmlForView: (view: DiagramView, html: string) => void
  clearHtmlCache: () => void
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  setEditing: (nodeId: string | null, field: 'name' | 'newAttribute' | 'newMethod' | null) => void
  setCompiling: (compiling: boolean) => void
  setLastError: (error: string | null) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  /** Optimistic: add a node */
  addNode: (node: Node) => void
  /** Optimistic: remove a node by id */
  removeNode: (id: string) => void
  /** Optimistic: remove an edge by id */
  removeEdge: (id: string) => void
  /** Optimistic: rename a class node (updates id, data.name, and connected edges) */
  renameNode: (oldId: string, newName: string) => void
  toggleDisplayPref: (key: DisplayPrefKey) => void
  setLayoutAlgorithm: (algo: GvLayoutAlgorithm) => void
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  viewMode: 'class',
  renderMode: 'reactflow',
  diagramData: {},
  svgCache: {},
  htmlCache: {},
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,
  editingField: null,
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
  setDiagramData: (view, nodes, edges) =>
    set((s) => ({ diagramData: { ...s.diagramData, [view]: { nodes, edges } } })),
  getDiagramData: (view): DiagramElements => get().diagramData[view] ?? EMPTY_DIAGRAM_ELEMENTS,
  clearDiagramData: (view) =>
    set((s) => {
      if (!view) return { diagramData: {} }
      const next = { ...s.diagramData }
      delete next[view]
      return { diagramData: next }
    }),
  setSvgForView: (view, svg) =>
    set((s) => ({ svgCache: { ...s.svgCache, [view]: svg } })),
  clearSvgCache: () => set({ svgCache: {} }),
  setHtmlForView: (view, html) =>
    set((s) => ({ htmlCache: { ...s.htmlCache, [view]: html } })),
  clearHtmlCache: () => set({ htmlCache: {} }),
  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
  setSelectedEdge: (selectedEdgeId) => set({ selectedEdgeId }),
  setEditing: (editingNodeId, editingField) => set({ editingNodeId, editingField }),
  setCompiling: (compiling) => set({ compiling }),
  setLastError: (lastError) => set({ lastError }),
  updateNodePosition: (id, x, y) =>
    set((s) => {
      const current = s.diagramData.class
      if (!current) return s
      return {
        diagramData: {
          ...s.diagramData,
          class: {
            ...current,
            nodes: current.nodes.map((n) =>
              n.id === id ? { ...n, position: { x, y } } : n
            ),
          },
        },
      }
    }),
  addNode: (node) => set((s) => {
    const current = s.diagramData.class ?? EMPTY_DIAGRAM_ELEMENTS
    return {
      diagramData: {
        ...s.diagramData,
        class: { ...current, nodes: [...current.nodes, node] },
      },
    }
  }),
  removeNode: (id) => set((s) => {
    const current = s.diagramData.class ?? EMPTY_DIAGRAM_ELEMENTS
    return {
      diagramData: {
        ...s.diagramData,
        class: {
          nodes: current.nodes.filter((n) => n.id !== id),
          edges: current.edges.filter((e) => e.source !== id && e.target !== id),
        },
      },
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    }
  }),
  removeEdge: (id) => set((s) => {
    const current = s.diagramData.class ?? EMPTY_DIAGRAM_ELEMENTS
    return {
      diagramData: {
        ...s.diagramData,
        class: { ...current, edges: current.edges.filter((e) => e.id !== id) },
      },
      selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
    }
  }),
  renameNode: (oldId, newName) => set((s) => {
    const newId = `class-${newName}`
    return {
      diagramData: {
        ...s.diagramData,
        class: {
          nodes: (s.diagramData.class?.nodes ?? []).map((n) =>
            n.id === oldId
              ? { ...n, id: newId, data: { ...n.data, name: newName } }
              : n
          ),
          edges: (s.diagramData.class?.edges ?? []).map((e) => ({
            ...e,
            source: e.source === oldId ? newId : e.source,
            target: e.target === oldId ? newId : e.target,
          })),
        },
      },
      selectedNodeId: s.selectedNodeId === oldId ? newId : s.selectedNodeId,
    }
  }),
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

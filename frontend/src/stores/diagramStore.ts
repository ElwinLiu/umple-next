import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export type DiagramView = 'class' | 'state' | 'feature' | 'structure'
export type RenderMode = 'reactflow' | 'graphviz'

/** Maps frontend view modes to Umple Graphviz generation types */
export const VIEW_TO_GV_TYPE: Record<DiagramView, string> = {
  class: 'GvClassDiagram',
  state: 'GvStateDiagram',
  feature: 'GvFeatureDiagram',
  structure: 'GvClassTraitDiagram',
}

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
}))

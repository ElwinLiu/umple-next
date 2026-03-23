import type { DiagramView } from '../stores/diagramStore'

export interface GenerateTarget {
  id: string
  label: string
  action: 'generate' | 'diagram'
  requestLanguage?: string
  diagramView?: DiagramView
  executable?: boolean
}

export const GENERATE_TARGETS: GenerateTarget[] = [
  { id: 'Java', label: 'Java Code', action: 'generate', executable: true },
  { id: 'javadoc', label: 'Java API Doc', action: 'generate' },
  { id: 'Php', label: 'PHP Code', action: 'generate' },
  { id: 'Python', label: 'Python Code', action: 'generate', executable: true },
  { id: 'RTCpp', label: 'C++ Code (Beta)', action: 'generate' },
  { id: 'Ruby', label: 'Ruby Code', action: 'generate' },
  { id: 'Alloy', label: 'Alloy Model', action: 'generate' },
  { id: 'NuSMV', label: 'NuSMV Model', action: 'generate' },
  { id: 'Ecore', label: 'Ecore', action: 'generate' },
  { id: 'TextUml', label: 'TextUml', action: 'generate' },
  { id: 'Scxml', label: 'Scxml (Experimental)', action: 'generate' },
  { id: 'Papyrus', label: 'Papyrus XMI', action: 'generate' },
  { id: 'Yuml', label: 'Yuml Class Diagram', action: 'generate' },
  { id: 'classDiagram', label: 'GraphViz Class Diagram (SVG)', action: 'diagram', diagramView: 'class' },
  { id: 'Mermaid', label: 'Mermaid', action: 'generate' },
  { id: 'instanceDiagram', label: 'Instance Diagram', action: 'diagram', diagramView: 'instance' },
  { id: 'stateDiagram', label: 'State Diagram (GraphViz SVG)', action: 'diagram', diagramView: 'state' },
  { id: 'featureDiagram', label: 'Feature Diagram (GraphViz SVG)', action: 'diagram', diagramView: 'feature' },
  { id: 'entityRelationshipDiagram', label: 'Entity Relationship Diagram (GraphViz SVG)', action: 'diagram', diagramView: 'erd' },
  { id: 'StateTables', label: 'State Tables', action: 'diagram', diagramView: 'stateTables' },
  { id: 'EventSequence', label: 'Event Sequence', action: 'diagram', diagramView: 'eventSequence' },
  { id: 'StructureDiagram', label: 'Structure Diagram', action: 'diagram', diagramView: 'structure' },
  { id: 'Json', label: 'Json', action: 'generate' },
  { id: 'Sql', label: 'Sql', action: 'generate' },
  { id: 'SimpleMetrics', label: 'Simple Metrics', action: 'generate' },
  { id: 'PlainRequirementsDoc', label: 'Plain Requirements Doc', action: 'generate' },
  { id: 'CodeAnalysis', label: 'Code Analysis', action: 'generate' },
  { id: 'USE', label: 'USE Model', action: 'generate' },
  { id: 'UmpleSelf', label: 'Internal Umple Representation', action: 'generate' },
  { id: 'UmpleAnnotaiveToComposition', label: 'Compositional Mixsets from Inline Mixsets', action: 'generate' },

  // Existing non-legacy targets that remain useful in the rewrite UI.
  { id: 'Cpp', label: 'C++ Code', action: 'generate' },
  { id: 'SimpleCpp', label: 'Simple C++', action: 'generate' },
  { id: 'Umlet', label: 'Umlet', action: 'generate' },
  { id: 'SimulateJava', label: 'Simulate Java', action: 'generate' },
]

const TARGETS_BY_ID = new Map(GENERATE_TARGETS.map((target) => [target.id, target]))

export function getGenerateTarget(id: string): GenerateTarget | undefined {
  return TARGETS_BY_ID.get(id)
}

export function resolveGenerateRequestLanguage(target: GenerateTarget, viewMode: DiagramView): string {
  if (target.id === 'Mermaid') {
    return viewMode === 'state' ? 'Mermaid.state' : 'Mermaid.class'
  }
  return target.requestLanguage ?? target.id
}

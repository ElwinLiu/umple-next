// Types matching the Go backend API responses

export interface CompileRequest {
  code: string
  modelId?: string
}

export interface CompileResponse {
  result: string
  errors?: string
  modelId: string
}

export interface UmpleModel {
  umpleClasses?: UmpleClass[]
  umpleAssociations?: UmpleAssociation[]
  umpleInterfaces?: UmpleInterface[]
}

export interface UmpleClass {
  name: string
  position?: Position
  attributes?: UmpleAttribute[]
  methods?: UmpleMethod[]
  isAbstract?: boolean
  extendsClass?: string
  implementedInterfaces?: string[]
  displayColor?: string
}

export interface UmpleAttribute {
  name: string
  type: string
  value?: string
}

export interface UmpleMethod {
  name: string
  type: string
  parameters?: string
  visibility?: string
}

export interface UmpleAssociation {
  id?: string
  classOneId?: string
  classTwoId?: string
  name?: string
  multiplicityOne?: string
  multiplicityTwo?: string
  roleOne?: string
  roleTwo?: string
  isLeftNavigable?: string   // "true" / "false" from Umple JSON
  isRightNavigable?: string
  isLeftComposition?: string
  isRightComposition?: string
  isSymmetricReflexive?: string
  offsetOnePosition?: Position
  offsetTwoPosition?: Position
  end1?: AssociationEnd
  end2?: AssociationEnd
}

export interface AssociationEnd {
  className: string
  multiplicity: string
  roleName: string
  isNavigable?: boolean
}

export interface UmpleInterface {
  name: string
  position?: Position
  methods?: UmpleMethod[]
  extendsInterfaces?: string[]
}

export interface Position {
  x: number
  y: number
  width: number
  height: number
}

export interface GvTextLine {
  text: string
  bold?: boolean
}

export interface GvPoint {
  x: number
  y: number
}

export interface GvNodeLayout {
  name: string
  x: number
  y: number
  width: number
  height: number
  shape?: string
  textLines?: GvTextLine[]
}

export interface GvEdgeLayout {
  source: string
  target: string
  label?: string
  headLabel?: string
  tailLabel?: string
  points?: GvPoint[]
  labelPos?: GvPoint
  headLabelPos?: GvPoint
  tailLabelPos?: GvPoint
}

export interface GvLayout {
  bboxWidth: number
  bboxHeight: number
  nodes: GvNodeLayout[]
  edges?: GvEdgeLayout[]
}

export interface DiagramResponse {
  svg: string
  html?: string
  layout?: GvLayout
  errors?: string
  modelId: string
}

export interface ExampleEntry {
  name: string
  filename: string
}

export interface ExampleCategory {
  name: string
  examples: ExampleEntry[]
}

export interface GenerateRequest {
  code: string
  language: string
  modelId?: string
}

export interface GeneratedArtifact {
  label: string
  url: string
  filename?: string
}

export interface GenerateResponse {
  output: string
  language: string
  errors?: string
  modelId?: string
  kind?: 'text' | 'html' | 'iframe'
  html?: string
  iframeUrl?: string
  downloads?: GeneratedArtifact[]
}

// Task types
export interface TaskCreateRequest {
  title: string
  description: string
  code: string
}

export interface TaskCreateResponse {
  id: string
  url: string
}

export interface TaskResponse {
  id: string
  title: string
  description: string
  code: string
}

export interface TaskSubmitResponse {
  status: string
}

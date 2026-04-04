// Types matching the Go backend API responses

export interface CompileRequest {
  code: string
  modelId?: string
  diagramType?: string
  suboptions?: string[]
  needsLayout?: boolean
  tabs?: ApiTab[]
  activeTabId?: string
}

export interface ApiTab {
  id: string
  name: string
  code: string
}

export interface GetModelResponse {
  modelId: string
  code: string
  tabs?: ApiTab[]
  activeTabId?: string
}

export interface CompileResponse {
  result: string
  errors?: string
  modelId: string
  svg?: string
  html?: string
  layout?: GvLayout
  storedLayout?: StoredLayoutMetadata
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

export interface StoredLayoutMetadata {
  hasStoredLayout: boolean
  nodeNames?: string[]
  associationNames?: string[]
}

export interface DiagramResponse {
  svg: string
  html?: string
  layout?: GvLayout
  storedLayout?: StoredLayoutMetadata
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

// CRUD schema types (from POST /api/crud/schema)

export interface CrudSchemaResponse {
  schema: CrudSchema
  errors?: string
  modelId: string
}

export interface CrudSchema {
  classes: CrudClass[]
  enums: CrudEnum[]
}

export interface CrudClass {
  name: string
  isAbstract: boolean
  extendsClass?: string
  attributes: CrudAttribute[]
  associations: CrudAssociation[]
}

export interface CrudAttribute {
  name: string
  type: string
  typeKind: 'primitive' | 'enum' | 'class'
  isInherited: boolean
  inheritedFrom?: string
}

export interface CrudAssociation {
  targetClass: string
  roleName: string
  reverseRoleName: string
  multiplicity: CrudMultiplicity
  isNavigable: boolean
  isComposition: boolean
  isReflexive?: boolean
}

export interface CrudMultiplicity {
  min: number
  max: number // -1 means unbounded
  raw: string
}

export interface CrudEnum {
  name: string
  values: string[]
}

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
  // Legacy nested format (kept for backward compat with any transforming middleware)
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

// State machine types (parsed from GV files by the backend)
export interface UmpleStateMachine {
  name: string
  className: string
  states: UmpleState[]
}

export interface UmpleState {
  name: string
  entryActions?: string[]
  exitActions?: string[]
  nestedStates?: UmpleState[]
  transitions?: UmpleTransition[]
  isInitial?: boolean
}

export interface UmpleTransition {
  event: string
  guard?: string
  action?: string
  nextState: string
}

export interface GvNodeLayout {
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface GvLayout {
  bboxWidth: number
  bboxHeight: number
  nodes: GvNodeLayout[]
}

export interface ExampleEntry {
  name: string
  filename: string
}

export interface ExampleCategory {
  name: string
  examples: ExampleEntry[]
}

export interface ModelResponse {
  id: string
  code: string
}

export interface GenerateRequest {
  code: string
  language: string
  modelId?: string
}

export interface GenerateResponse {
  output: string
  language: string
  errors?: string
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

// AI types
export interface AiRequirementsRequest {
  requirements: string
}

export interface AiRequirementsResponse {
  code: string
}

export interface AiExplainRequest {
  code: string
}

export interface AiExplainResponse {
  explanation: string
}

export const UMPLE_TARGETS = [
  'Java', 'Php', 'Python', 'Ruby', 'Cpp', 'RTCpp', 'SimpleCpp',
  'Json', 'Sql', 'Alloy', 'NuSMV', 'USE', 'Ecore', 'TextUml', 'Umlet', 'SimulateJava',
] as const

import { create } from 'zustand'
import { api } from '@/api/client'
import type { CrudSchema, CrudAssociation, CrudAttribute, CrudClass } from '@/api/types'
import { useSessionStore } from './sessionStore'

export interface CrudInstance {
  _id: number
  [key: string]: unknown
}

/** Stable key for the model input used to fetch a CRUD schema.
 *  Keyed on code only — the modelId is a backend implementation detail
 *  and should not trigger refetches when it changes (e.g. crudModelId
 *  set from a response). */
export function buildCrudSchemaRequestKey(code: string) {
  return code
}

/** Key used to store an association value inside a CrudInstance. */
export function assocKey(roleName: string) {
  return `__assoc__${roleName}` as const
}

export interface ValidationError {
  field: string     // attribute name or assocKey
  message: string
}

export interface ReconcileResult {
  instances: Record<string, CrudInstance[]>
  adjustments: string[]
}

export interface GlobalValidationResult {
  messages: string[]
  count: number
}

interface CrudState {
  // Schema from backend
  schema: CrudSchema | null
  schemaLoading: boolean
  schemaError: string | null
  schemaRequestKey: string | null
  crudModelId: string | null

  // Instances keyed by class name
  instances: Record<string, CrudInstance[]>
  nextId: number

  // UI
  selectedClass: string | null
  editingInstance: { className: string; instanceId: number | null } | null
  validationErrors: ValidationError[]
  adjustmentMessages: string[]
  globalValidationErrors: string[]
  globalValidationCount: number

  // Actions
  fetchSchema: (code: string, modelId?: string) => Promise<void>
  setSelectedClass: (name: string | null) => void
  createInstance: (className: string, data: Record<string, unknown>) => number
  updateInstance: (className: string, instanceId: number, data: Record<string, unknown>) => void
  deleteInstance: (className: string, instanceId: number) => void
  clearAllInstances: (className: string) => void
  openEditor: (className: string, instanceId: number | null) => void
  closeEditor: () => void
  setValidationErrors: (errors: ValidationError[]) => void
  resetInstances: () => void
  exportJson: () => string
  importJson: (json: string) => boolean
  generateRandom: (className: string, count: number) => void
  generateRandomAll: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Get the IDs stored in an association slot (normalises to number[]). */
function getAssocIds(instance: CrudInstance, role: string): number[] {
  const val = instance[assocKey(role)]
  if (val === undefined || val === null) return []
  if (Array.isArray(val)) return val as number[]
  if (typeof val === 'number') return [val]
  return []
}

/** Set association IDs on an instance (mutates). */
function setAssocIds(instance: CrudInstance, role: string, ids: number[], max = -1) {
  if (ids.length === 0) {
    instance[assocKey(role)] = undefined
    return
  }
  instance[assocKey(role)] = max === 1 ? ids[0] : ids
}

/** Remove a single ID from an association slot on an instance (mutates). */
function removeAssocId(instance: CrudInstance, role: string, targetId: number, max = -1) {
  const ids = getAssocIds(instance, role).filter((id) => id !== targetId)
  setAssocIds(instance, role, ids, max)
}

/** Find the association definition on a class by role name. */
function findAssoc(schema: CrudSchema, className: string, roleName: string): CrudAssociation | undefined {
  const cls = schema.classes.find((c) => c.name === className)
  return cls?.associations.find((a) => a.roleName === roleName)
}

function findReverseAssoc(schema: CrudSchema, assoc: CrudAssociation): CrudAssociation | undefined {
  if (!assoc.reverseRoleName) return undefined
  return findAssoc(schema, assoc.targetClass, assoc.reverseRoleName)
}

export function classHasCompositionChildren(schema: CrudSchema | null, className: string): boolean {
  if (!schema) return false
  return schema.classes.some((candidate) =>
    candidate.associations.some((assoc) => assoc.isComposition && assoc.targetClass === className),
  )
}

/** Check for hierarchical cycles: would linking sourceId → targetId via a reflexive
 *  association create a cycle? Walks up from targetId following the same role. */
function wouldCreateCycle(
  instances: CrudInstance[],
  sourceId: number,
  targetId: number,
  role: string,
): boolean {
  const visited = new Set<number>()
  let current: number | undefined = targetId
  while (current !== undefined && current !== null) {
    if (current === sourceId) return true
    if (visited.has(current)) return false // already a cycle elsewhere, don't loop
    visited.add(current)
    const inst = instances.find((i) => i._id === current)
    if (!inst) return false
    const parentIds = getAssocIds(inst, role)
    // For to-one reflexive (parent pointer), follow first link
    current = parentIds[0]
  }
  return false
}

// ── Random data generation ───────────────────────────────────────────

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack']
const LAST_NAMES = ['Smith', 'Jones', 'Brown', 'Lee', 'Wilson', 'Clark', 'Hall', 'Young', 'King', 'Wright']
const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'omega', 'sigma', 'theta', 'lambda', 'kappa', 'zeta']

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randomValue(type: string, typeKind: string, schema: import('@/api/types').CrudSchema): unknown {
  if (typeKind === 'enum') {
    const enumDef = schema.enums.find((e) => e.name === type)
    return enumDef ? pick(enumDef.values) : ''
  }

  const t = type.toLowerCase()
  if (t === 'boolean') return Math.random() > 0.5
  if (t === 'integer' || t === 'int') return Math.floor(Math.random() * 100) + 1
  if (t === 'float' || t === 'double') return Math.round(Math.random() * 1000) / 10
  if (t === 'date') {
    const d = new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000))
    return d.toISOString().slice(0, 10)
  }
  if (t === 'time') {
    const h = String(Math.floor(Math.random() * 24)).padStart(2, '0')
    const m = String(Math.floor(Math.random() * 60)).padStart(2, '0')
    return `${h}:${m}`
  }
  // String — generate contextual names based on attribute name patterns
  if (t === 'string' || t === '') {
    return `${pick(WORDS)}-${Math.floor(Math.random() * 1000)}`
  }
  return ''
}

/** Collect instances for a target class, including concrete subclass instances
 *  (needed when an association targets an abstract class). */
function collectTargetInstances(
  schema: CrudSchema,
  instances: Record<string, CrudInstance[]>,
  className: string,
): CrudInstance[] {
  const result: CrudInstance[] = [...(instances[className] ?? [])]
  for (const cls of schema.classes) {
    if (cls.extendsClass === className) {
      result.push(...collectTargetInstances(schema, instances, cls.name))
    }
  }
  return result
}

interface PendingGlobalValidation {
  className: string
  instanceId: number | null
  newInstance: CrudInstance
}

const EMPTY_GLOBAL_VALIDATION_RESULT: GlobalValidationResult = {
  messages: [],
  count: 0,
}

function hasMeaningfulCrudValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

function cloneInstances(instances: Record<string, CrudInstance[]>): Record<string, CrudInstance[]> {
  const snapshot: Record<string, CrudInstance[]> = {}

  for (const [className, list] of Object.entries(instances)) {
    snapshot[className] = list.map((instance) => ({ ...instance }))
  }

  return snapshot
}

function formatAssociationRequirement(assoc: CrudAssociation) {
  const { min, max } = assoc.multiplicity
  const instanceWord = max === 1 ? 'instance' : 'instances'

  if (max !== -1 && max === min) {
    return `exactly ${min} ${assoc.targetClass} ${instanceWord}`
  }

  if (max === -1) {
    return `at least ${min} ${assoc.targetClass} ${instanceWord}`
  }

  if (max > min) {
    return `between ${min} and ${max} ${assoc.targetClass} ${instanceWord}`
  }

  return `at least ${min} ${assoc.targetClass} ${instanceWord}`
}

function computeGlobalValidationState(
  schema: CrudSchema | null,
  instances: Record<string, CrudInstance[]>,
) {
  if (!schema) return { globalValidationErrors: [], globalValidationCount: 0 }

  const result = validateGlobalModel(schema, instances)
  return {
    globalValidationErrors: result.messages,
    globalValidationCount: result.count,
  }
}

// ── Validation ───────────────────────────────────────────────────────

export function validateInstance(
  schema: CrudSchema,
  className: string,
  data: Record<string, unknown>,
  instances: Record<string, CrudInstance[]>,
  editingId: number | null,
): ValidationError[] {
  const cls = schema.classes.find((c) => c.name === className)
  if (!cls) return []
  const errors: ValidationError[] = []

  // Check association multiplicity constraints
  for (const assoc of cls.associations) {
    if (!assoc.isNavigable) continue
    const key = assocKey(assoc.roleName)
    const ids = toIdArray(data[key])

    const { min, max } = assoc.multiplicity

    if (ids.length < min) {
      errors.push({
        field: key,
        message: `Requires at least ${min} ${assoc.targetClass} (have ${ids.length})`,
      })
    }
    if (max !== -1 && ids.length > max) {
      errors.push({
        field: key,
        message: `At most ${max} ${assoc.targetClass} allowed (have ${ids.length})`,
      })
    }

    const reverseAssoc = findReverseAssoc(schema, assoc)
    if (reverseAssoc && reverseAssoc.multiplicity.max !== -1) {
      const targetInstances = instances[assoc.targetClass] ?? []
      for (const tid of ids) {
        const targetInst = targetInstances.find((inst) => inst._id === tid)
        if (!targetInst) continue
        const reverseIds = getAssocIds(targetInst, assoc.reverseRoleName)
        const occupiedByOthers = reverseIds.filter((id) => id !== editingId)
        if (occupiedByOthers.length >= reverseAssoc.multiplicity.max) {
          errors.push({
            field: key,
            message: `${assoc.targetClass} #${tid} already has the maximum number of ${assoc.reverseRoleName} links`,
          })
        }
      }
    }

    // Reflexive cycle detection — only for hierarchical (to-one) self-links
    // like a parent pointer, where cycles would form an infinite loop.
    // To-many reflexive links (e.g. symmetric "friends") are valid and skipped.
    if (assoc.isReflexive && editingId !== null && assoc.multiplicity.max === 1) {
      const classInstances = instances[className] ?? []
      for (const tid of ids) {
        if (tid === editingId) {
          errors.push({ field: key, message: `Cannot associate with itself` })
        } else if (wouldCreateCycle(classInstances, editingId, tid, assoc.roleName)) {
          errors.push({ field: key, message: `Would create a circular reference` })
        }
      }
    }

  }

  return errors
}

export function validateGlobalModel(
  schema: CrudSchema,
  instances: Record<string, CrudInstance[]>,
  pendingUpdate?: PendingGlobalValidation,
): GlobalValidationResult {
  if (!schema) return EMPTY_GLOBAL_VALIDATION_RESULT

  const snapshot = cloneInstances(instances)

  if (pendingUpdate) {
    const list = [...(snapshot[pendingUpdate.className] ?? [])]

    if (pendingUpdate.instanceId === null) {
      list.push({ ...pendingUpdate.newInstance })
    } else {
      const idx = list.findIndex((instance) => instance._id === pendingUpdate.instanceId)
      if (idx === -1) {
        list.push({ ...pendingUpdate.newInstance })
      } else {
        list[idx] = { ...pendingUpdate.newInstance }
      }
    }

    snapshot[pendingUpdate.className] = list
  }

  const messages: string[] = []
  let totalViolations = 0

  for (const cls of schema.classes) {
    const sourceList = snapshot[cls.name] ?? []

    for (const assoc of cls.associations) {
      if (!assoc.isNavigable) continue

      const { min, max } = assoc.multiplicity
      if (min <= 0 && max === -1) continue

      let missingCount = 0
      let overMaxCount = 0
      let firstMissingId: number | null = null
      let firstOverMaxId: number | null = null

      for (const instance of sourceList) {
        const ids = getAssocIds(instance, assoc.roleName)
        const linkCount = ids.length

        if (linkCount < min) {
          missingCount++
          if (firstMissingId === null) firstMissingId = instance._id
        }

        if (max !== -1 && linkCount > max) {
          overMaxCount++
          if (firstOverMaxId === null) firstOverMaxId = instance._id
        }
      }

      if (missingCount > 0) {
        totalViolations += missingCount
        const availableTargets = collectTargetInstances(schema, snapshot, assoc.targetClass)

        if (availableTargets.length === 0) {
          messages.push(
            `Conflict: ${cls.name} cannot exist without ${assoc.targetClass} according to the updated association. ` +
            `Create at least one ${assoc.targetClass} instance and associate it with the existing ${cls.name} instances.`,
          )
        } else {
          const targetLabel = firstMissingId === null ? cls.name : `${cls.name} #${firstMissingId}`
          messages.push(
            `Please associate ${targetLabel} with ${formatAssociationRequirement(assoc)} ` +
            `to satisfy association '${assoc.roleName}'.`,
          )
        }
      }

      if (overMaxCount > 0) {
        totalViolations += overMaxCount
        const maxText = max === 1 ? 'one' : String(max)

        if (firstOverMaxId === null) {
          messages.push(
            `Some ${cls.name} instances exceed the maximum allowed number of ${assoc.targetClass} links ` +
            `for association '${assoc.roleName}'.`,
          )
        } else {
          messages.push(
            `Please reduce the number of associated ${assoc.targetClass} instances for ${cls.name} #${firstOverMaxId} ` +
            `to at most ${maxText} to satisfy association '${assoc.roleName}'.`,
          )
        }
      }
    }
  }

  return {
    messages: [...new Set(messages)],
    count: totalViolations,
  }
}

function buildClassMap(schema: CrudSchema) {
  return new Map(schema.classes.map((cls) => [cls.id ?? cls.name, cls]))
}

function buildAttributeMap(cls: CrudClass) {
  return new Map(cls.attributes.map((attr) => [attr.name, attr]))
}

function buildAssociationMap(cls: CrudClass) {
  return new Map(cls.associations.map((assoc) => [assoc.endId ?? assoc.id ?? assoc.roleName, assoc]))
}

function buildInstanceKey(className: string, instanceId: number) {
  return `${className}:${instanceId}`
}

function getClassIdentity(cls: Pick<CrudClass, 'id' | 'name'>) {
  return cls.id ?? cls.name
}

function getAssociationIdentity(assoc: Pick<CrudAssociation, 'id' | 'endId' | 'roleName'>) {
  return assoc.endId ?? assoc.id ?? assoc.roleName
}

function getAssociationTargetIdentity(assoc: Pick<CrudAssociation, 'targetClass' | 'targetClassId'>) {
  return assoc.targetClassId ?? assoc.targetClass
}

function normalizeCrudTypeName(type: string) {
  const normalized = type.trim().toLowerCase().replace(/\s+/g, '')
  if (normalized === 'integer') return 'int'
  if (normalized === 'bool') return 'boolean'
  if (normalized === 'char') return 'character'
  return normalized
}

function buildAttributeCompatibilitySignature(attr: CrudAttribute) {
  const typeName = attr.typeKind === 'enum' ? attr.type.trim() : normalizeCrudTypeName(attr.type)
  return [attr.typeKind, typeName].join(':')
}

function attributeTypesChanged(oldAttr: CrudAttribute, newAttr: CrudAttribute) {
  return buildAttributeCompatibilitySignature(oldAttr) !== buildAttributeCompatibilitySignature(newAttr)
}

function buildAttributeRenameMap(oldClass: CrudClass, newClass: CrudClass) {
  const oldByName = new Map(oldClass.attributes.map((attr) => [attr.name, attr]))
  const newByName = new Map(newClass.attributes.map((attr) => [attr.name, attr]))
  const oldOnly = oldClass.attributes.filter((attr) => !newByName.has(attr.name))
  const newOnly = newClass.attributes.filter((attr) => !oldByName.has(attr.name))
  const usedOldNames = new Set<string>()
  const renameMap = new Map<string, string>()

  for (const newAttr of newOnly) {
    const candidates = oldOnly.filter((oldAttr) =>
      !usedOldNames.has(oldAttr.name) &&
      buildAttributeCompatibilitySignature(oldAttr) === buildAttributeCompatibilitySignature(newAttr),
    )

    if (candidates.length === 1) {
      const matchedOld = candidates[0]!
      renameMap.set(newAttr.name, matchedOld.name)
      usedOldNames.add(matchedOld.name)
    }
  }

  return renameMap
}

function buildClassAttributeSignature(cls: CrudClass) {
  return [...cls.attributes]
    .map((attr) => [
      attr.name,
      normalizeCrudTypeName(attr.type),
      attr.typeKind,
      attr.isInherited ? '1' : '0',
      attr.inheritedFrom ?? '',
    ].join(':'))
    .sort()
    .join(';')
}

function buildClassAssociationSignature(cls: CrudClass) {
  return cls.associations
    .filter((assoc) => assoc.isNavigable)
    .map((assoc) => [
      assoc.targetClass,
      assoc.multiplicity.min,
      assoc.multiplicity.max,
      assoc.reverseRoleName ? '1' : '0',
      assoc.isComposition ? '1' : '0',
    ].join('|'))
    .sort()
    .join(';')
}

function buildClassStructuralSignature(cls: CrudClass) {
  return [
    cls.isAbstract ? '1' : '0',
    cls.extendsClass ?? '',
    buildClassAttributeSignature(cls),
    buildClassAssociationSignature(cls),
  ].join('||')
}

function buildClassSourceMap(oldSchema: CrudSchema | null, newSchema: CrudSchema) {
  const sourceMap = new Map<string, string>()
  if (!oldSchema) return sourceMap

  const oldClassesByIdentity = buildClassMap(oldSchema)
  const oldClassesByName = new Map(oldSchema.classes.map((cls) => [cls.name, cls]))
  const matchedOldNames = new Set<string>()
  const matchedNewNames = new Set<string>()

  for (const newClass of newSchema.classes) {
    const oldByIdentity = oldClassesByIdentity.get(getClassIdentity(newClass))
    if (oldByIdentity) {
      sourceMap.set(newClass.name, oldByIdentity.name)
      matchedOldNames.add(oldByIdentity.name)
      matchedNewNames.add(newClass.name)
      continue
    }

    const oldByName = oldClassesByName.get(newClass.name)
    if (oldByName) {
      sourceMap.set(newClass.name, oldByName.name)
      matchedOldNames.add(oldByName.name)
      matchedNewNames.add(newClass.name)
    }
  }

  const unmatchedOld = oldSchema.classes.filter((cls) => !matchedOldNames.has(cls.name))
  const unmatchedNew = newSchema.classes.filter((cls) => !matchedNewNames.has(cls.name))
  const oldSignatures = new Map(unmatchedOld.map((cls) => [cls.name, buildClassStructuralSignature(cls)]))
  const usedHeuristicOldNames = new Set<string>()

  for (const newClass of unmatchedNew) {
    const newSignature = buildClassStructuralSignature(newClass)
    const candidates = unmatchedOld.filter((oldClass) =>
      !usedHeuristicOldNames.has(oldClass.name) && oldSignatures.get(oldClass.name) === newSignature,
    )

    if (candidates.length === 1) {
      const matchedOld = candidates[0]!
      sourceMap.set(newClass.name, matchedOld.name)
      usedHeuristicOldNames.add(matchedOld.name)
    }
  }

  return sourceMap
}

function associationTargetsMatch(
  oldAssoc: CrudAssociation,
  newAssoc: CrudAssociation,
  classSourceMap: Map<string, string>,
) {
  if (getAssociationTargetIdentity(oldAssoc) === getAssociationTargetIdentity(newAssoc)) return true
  return classSourceMap.get(newAssoc.targetClass) === oldAssoc.targetClass
}

export function resolveSelectedClassName(
  oldSchema: CrudSchema | null,
  newSchema: CrudSchema,
  selectedClassName: string | null,
) {
  if (!selectedClassName) return null
  if (newSchema.classes.some((cls) => cls.name === selectedClassName)) return selectedClassName
  if (!oldSchema) return null

  const classSourceMap = buildClassSourceMap(oldSchema, newSchema)
  for (const [newClassName, oldClassName] of classSourceMap.entries()) {
    if (oldClassName === selectedClassName) return newClassName
  }
  return null
}

function coercePrimitiveValue(value: unknown, type: string): unknown {
  const normalized = type.toLowerCase()

  if (normalized === 'string' || normalized === '') {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return undefined
  }

  if (normalized === 'boolean') {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase()
      if (lowered === 'true') return true
      if (lowered === 'false') return false
    }
    return undefined
  }

  if (normalized === 'integer' || normalized === 'int') {
    if (typeof value === 'number' && Number.isInteger(value)) return value
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '') return undefined
      const parsed = Number(trimmed)
      if (Number.isInteger(parsed)) return parsed
    }
    return undefined
  }

  if (normalized === 'float' || normalized === 'double') {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '') return undefined
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) return parsed
    }
    return undefined
  }

  if (normalized === 'date' || normalized === 'time') {
    return typeof value === 'string' && value.trim() !== '' ? value : undefined
  }

  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined
}

function coerceAttributeValue(value: unknown, attr: CrudAttribute, schema: CrudSchema): unknown {
  if (value === undefined) return undefined

  if (attr.typeKind === 'enum') {
    if (typeof value !== 'string') return undefined
    const enumDef = schema.enums.find((candidate) => candidate.name === attr.type)
    if (!enumDef) return undefined
    return enumDef.values.includes(value) ? value : undefined
  }

  if (attr.typeKind === 'primitive') {
    return coercePrimitiveValue(value, attr.type)
  }

  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined
}

function addAssocId(instance: CrudInstance, role: string, targetId: number, max = -1): boolean {
  const ids = getAssocIds(instance, role)
  if (ids.includes(targetId)) return true
  if (max !== -1 && ids.length >= max) return false
  setAssocIds(instance, role, [...ids, targetId], max)
  return true
}

function clearAssociationFields(instances: Record<string, CrudInstance[]>) {
  for (const list of Object.values(instances)) {
    for (const instance of list) {
      for (const key of Object.keys(instance)) {
        if (key.startsWith('__assoc__')) delete instance[key]
      }
    }
  }
}

export function reconcileInstancesDetailed(
  oldSchema: CrudSchema | null,
  newSchema: CrudSchema,
  oldInstances: Record<string, CrudInstance[]>,
): ReconcileResult {
  const nextInstances: Record<string, CrudInstance[]> = {}
  const adjustments: string[] = []

  if (!oldSchema) {
    for (const cls of newSchema.classes) nextInstances[cls.name] = []
    return { instances: nextInstances, adjustments }
  }

  const oldClassesByName = new Map(oldSchema.classes.map((cls) => [cls.name, cls]))
  const classSourceMap = buildClassSourceMap(oldSchema, newSchema)
  const associationCandidates = new Map<string, Record<string, number[]>>()

  for (const newClass of newSchema.classes) {
    const oldClassName = classSourceMap.get(newClass.name)
    const oldClass = oldClassName ? oldClassesByName.get(oldClassName) : undefined

    if (!oldClass || newClass.isAbstract) {
      nextInstances[newClass.name] = []
      continue
    }

    const sourceList = oldInstances[oldClass.name] ?? []
    const oldAttributes = buildAttributeMap(oldClass)
    const oldAssociations = buildAssociationMap(oldClass)
    const attributeRenameMap = buildAttributeRenameMap(oldClass, newClass)
    const migratedList: CrudInstance[] = []
    const attributeRenameMoves = new Map<string, { oldName: string; movedCount: number }>()
    const attributeTypeChanges = new Map<string, { oldType: string; newType: string; kept: number; removed: number }>()

    for (const oldInstance of sourceList) {
      const nextInstance: CrudInstance = { _id: oldInstance._id }

      for (const attr of newClass.attributes) {
        const oldAttr = oldAttributes.get(attr.name)

        if (oldAttr) {
          const oldValue = oldInstance[attr.name]
          const migrated = coerceAttributeValue(oldValue, attr, newSchema)

          if (migrated !== undefined) nextInstance[attr.name] = migrated

          if (attributeTypesChanged(oldAttr, attr) && hasMeaningfulCrudValue(oldValue)) {
            const summary = attributeTypeChanges.get(attr.name) ?? {
              oldType: oldAttr.type,
              newType: attr.type,
              kept: 0,
              removed: 0,
            }

            if (migrated !== undefined) {
              summary.kept++
            } else {
              summary.removed++
            }

            attributeTypeChanges.set(attr.name, summary)
          }
          continue
        }

        const renamedFrom = attributeRenameMap.get(attr.name)
        if (!renamedFrom) continue

        const oldValue = oldInstance[renamedFrom]
        if (!hasMeaningfulCrudValue(oldValue)) continue

        const migrated = coerceAttributeValue(oldValue, attr, newSchema)
        if (migrated === undefined || nextInstance[attr.name] !== undefined) continue

        nextInstance[attr.name] = migrated

        const summary = attributeRenameMoves.get(attr.name) ?? { oldName: renamedFrom, movedCount: 0 }
        summary.movedCount++
        attributeRenameMoves.set(attr.name, summary)
      }

      const instanceAssocCandidates: Record<string, number[]> = {}
      for (const assoc of newClass.associations) {
        const assocIdentity = getAssociationIdentity(assoc)
        const oldAssoc = oldAssociations.get(assocIdentity) ?? oldAssociations.get(assoc.roleName)
        if (!oldAssoc || !associationTargetsMatch(oldAssoc, assoc, classSourceMap)) continue
        const ids = toIdArray(oldInstance[assocKey(oldAssoc.roleName)])
        if (ids.length > 0) instanceAssocCandidates[assocIdentity] = ids
      }

      associationCandidates.set(buildInstanceKey(newClass.name, oldInstance._id), instanceAssocCandidates)
      migratedList.push(nextInstance)
    }

    nextInstances[newClass.name] = migratedList

    if (oldClass.name !== newClass.name && migratedList.length > 0) {
      adjustments.push(
        `Class '${oldClass.name}' was renamed to '${newClass.name}'. Existing instances were preserved because the class still matched uniquely.`,
      )
    }

    for (const [newAttrName, summary] of attributeRenameMoves.entries()) {
      if (summary.movedCount <= 0) continue
      adjustments.push(
        `Attribute '${summary.oldName}' in class '${newClass.name}' was renamed to '${newAttrName}'. Existing data was preserved because the attribute type did not change.`,
      )
    }

    for (const [attrName, summary] of attributeTypeChanges.entries()) {
      if (summary.kept > 0 && summary.removed === 0) {
        adjustments.push(
          `Data type of attribute '${attrName}' in class '${newClass.name}' was updated from ${summary.oldType} to ${summary.newType}. Existing data was kept because it is compatible with the new type.`,
        )
      } else if (summary.kept > 0 && summary.removed > 0) {
        adjustments.push(
          `Data type of attribute '${attrName}' in class '${newClass.name}' was updated from ${summary.oldType} to ${summary.newType}. Existing data was adjusted: compatible values were kept where possible, and incompatible values were removed from ${summary.removed} instance(s).`,
        )
      } else if (summary.removed > 0) {
        adjustments.push(
          `Data type of attribute '${attrName}' in class '${newClass.name}' was updated from ${summary.oldType} to ${summary.newType}. Existing data was removed from ${summary.removed} instance(s) because it is not compatible with the new type.`,
        )
      }
    }
  }

  clearAssociationFields(nextInstances)
  const associationAdjustments = new Map<string, { fromClass: string; roleName: string; targetClass: string; removedCount: number }>()

  for (const cls of newSchema.classes) {
    for (const assoc of cls.associations) {
      const reverseAssoc = findReverseAssoc(newSchema, assoc)
      const sourceList = nextInstances[cls.name] ?? []
      const targetById = new Map(
        collectTargetInstances(newSchema, nextInstances, assoc.targetClass).map((instance) => [instance._id, instance]),
      )

      for (const source of sourceList) {
        const candidateIds = associationCandidates.get(buildInstanceKey(cls.name, source._id))?.[getAssociationIdentity(assoc)] ?? []
        const filteredIds = [...new Set(candidateIds)]
          .filter((id) => targetById.has(id))
          .filter((id) => !assoc.isReflexive || id !== source._id)

        const trimmedIds = assoc.multiplicity.max === -1
          ? filteredIds
          : filteredIds.slice(0, assoc.multiplicity.max)

        const adjustmentKey = `${cls.name}:${assoc.roleName}`
        const adjustment = associationAdjustments.get(adjustmentKey) ?? {
          fromClass: cls.name,
          roleName: assoc.roleName,
          targetClass: assoc.targetClass,
          removedCount: 0,
        }
        adjustment.removedCount += filteredIds.length - trimmedIds.length
        associationAdjustments.set(adjustmentKey, adjustment)

        for (const targetId of trimmedIds) {
          const target = targetById.get(targetId)
          if (!target) continue
          const added = addAssocId(source, assoc.roleName, targetId, assoc.multiplicity.max)
          if (!added) continue

          if (assoc.reverseRoleName && reverseAssoc) {
            const accepted = addAssocId(target, assoc.reverseRoleName, source._id, reverseAssoc.multiplicity.max)
            if (!accepted) {
              removeAssocId(source, assoc.roleName, targetId, assoc.multiplicity.max)
              adjustment.removedCount++
            }
          }
        }
      }
    }
  }

  for (const adjustment of associationAdjustments.values()) {
    if (adjustment.removedCount <= 0) continue
    adjustments.push(
      `Existing links for association '${adjustment.roleName}' from ${adjustment.fromClass} to ${adjustment.targetClass} were trimmed to satisfy the updated multiplicity constraints.`,
    )
  }

  return {
    instances: nextInstances,
    adjustments: [...new Set(adjustments)],
  }
}

export function reconcileInstances(
  oldSchema: CrudSchema | null,
  newSchema: CrudSchema,
  oldInstances: Record<string, CrudInstance[]>,
): Record<string, CrudInstance[]> {
  return reconcileInstancesDetailed(oldSchema, newSchema, oldInstances).instances
}

// ── Session storage persistence ─────────────────────────────────────

const CRUD_STORAGE_KEY = 'umple-crud-instances'

function restoreFromSession(schemaKey: string): { instances: Record<string, CrudInstance[]>; nextId: number } | null {
  try {
    const raw = sessionStorage.getItem(CRUD_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    // Any code change produces a different key — discard everything on mismatch
    // to avoid confusing users with stale/partial data.
    if (data.schemaKey !== schemaKey || !data.instances) return null
    return {
      instances: data.instances as Record<string, CrudInstance[]>,
      nextId: typeof data.nextId === 'number' ? data.nextId : 1,
    }
  } catch {
    return null
  }
}

function saveToSession(schemaKey: string | null, instances: Record<string, CrudInstance[]>, nextId: number) {
  try {
    const hasData = Object.values(instances).some((list) => list.length > 0)
    if (!schemaKey || !hasData) {
      sessionStorage.removeItem(CRUD_STORAGE_KEY)
      return
    }
    sessionStorage.setItem(CRUD_STORAGE_KEY, JSON.stringify({ schemaKey, instances, nextId }))
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

// ── Store ────────────────────────────────────────────────────────────

export const useCrudStore = create<CrudState>((set, get) => ({
  schema: null,
  schemaLoading: false,
  schemaError: null,
  schemaRequestKey: null,
  crudModelId: null,
  instances: {},
  nextId: 1,
  selectedClass: null,
  editingInstance: null,
  validationErrors: [],
  adjustmentMessages: [],
  globalValidationErrors: [],
  globalValidationCount: 0,

  fetchSchema: async (code, modelId) => {
    const schemaRequestKey = buildCrudSchemaRequestKey(code)
    set({
      schemaLoading: true,
      schemaError: null,
      schemaRequestKey,
      adjustmentMessages: [],
      globalValidationErrors: [],
      globalValidationCount: 0,
    })
    try {
      const activeTabId = useSessionStore.getState().activeTabId
      const res = await api.crudSchema({ code, modelId, activeTabId })
      // Ignore stale responses: if another fetch was started while we were
      // awaiting, the stored schemaRequestKey will have changed.
      if (get().schemaRequestKey !== schemaRequestKey) return
      const schema = res.schema
      const state = get()
      let selected = resolveSelectedClassName(state.schema, schema, state.selectedClass)
      if (!selected || !schema.classes.some((c) => c.name === selected)) {
        selected = schema.classes.find((c) => !c.isAbstract)?.name ?? null
      }
      const restored = restoreFromSession(schemaRequestKey)
      const reconciliation = state.schema
        ? reconcileInstancesDetailed(state.schema, schema, state.instances)
        : { instances: restored?.instances ?? {}, adjustments: [] }
      const reconciledInstances = reconciliation.instances
      const globalValidation = validateGlobalModel(schema, reconciledInstances)
      set({
        schema,
        schemaLoading: false,
        schemaError: res.errors || null,
        schemaRequestKey,
        crudModelId: res.modelId || null,
        selectedClass: selected,
        instances: reconciledInstances,
        nextId: state.schema ? state.nextId : (restored?.nextId ?? 1),
        editingInstance: null,
        validationErrors: [],
        adjustmentMessages: reconciliation.adjustments,
        globalValidationErrors: globalValidation.messages,
        globalValidationCount: globalValidation.count,
      })
    } catch (err) {
      if (get().schemaRequestKey !== schemaRequestKey) return
      set({
        schemaLoading: false,
        schemaError: err instanceof Error ? err.message : 'Failed to fetch schema',
        schemaRequestKey,
      })
    }
  },

  setSelectedClass: (name) => set({ selectedClass: name, editingInstance: null, validationErrors: [] }),

  createInstance: (className, data) => {
    const { schema, nextId } = get()
    const id = nextId
    const instance: CrudInstance = { _id: id, ...data }

    set((s) => {
      const newInstances = { ...s.instances }
      newInstances[className] = [...(newInstances[className] ?? []), instance]

      // Bidirectional association sync
      if (schema) {
        syncReverseLinks(schema, newInstances, className, id, data, {})
      }

      return {
        nextId: s.nextId + 1,
        instances: newInstances,
        validationErrors: [],
        ...computeGlobalValidationState(schema, newInstances),
      }
    })
    return id
  },

  updateInstance: (className, instanceId, data) => {
    const { schema } = get()

    set((s) => {
      const newInstances = { ...s.instances }
      const list = [...(newInstances[className] ?? [])]
      const idx = list.findIndex((i) => i._id === instanceId)
      if (idx === -1) return s

      const oldInst = list[idx]!
      const newInst: CrudInstance = { ...oldInst, ...data }
      list[idx] = newInst
      newInstances[className] = list

      // Bidirectional sync: diff old vs new association values
      if (schema) {
        const oldAssocData: Record<string, unknown> = {}
        for (const key of Object.keys(oldInst)) {
          if (key.startsWith('__assoc__')) oldAssocData[key] = oldInst[key]
        }
        syncReverseLinks(schema, newInstances, className, instanceId, data, oldAssocData)
      }

      return {
        instances: newInstances,
        validationErrors: [],
        ...computeGlobalValidationState(schema, newInstances),
      }
    })
  },

  deleteInstance: (className, instanceId) => {
    const { schema } = get()

    set((s) => {
      const newInstances = { ...s.instances }
      deleteInstancesInPlace(schema, newInstances, [{ cls: className, id: instanceId }])

      return {
        instances: newInstances,
        ...computeGlobalValidationState(schema, newInstances),
      }
    })
  },

  clearAllInstances: (className) => {
    const { schema } = get()

    set((s) => {
      const newInstances = { ...s.instances }
      if (!schema) {
        newInstances[className] = []
        return {
          instances: newInstances,
          ...computeGlobalValidationState(schema, newInstances),
        }
      }

      const seeds = (newInstances[className] ?? []).map((inst) => ({ cls: className, id: inst._id }))
      deleteInstancesInPlace(schema, newInstances, seeds)
      return {
        instances: newInstances,
        ...computeGlobalValidationState(schema, newInstances),
      }
    })
  },

  openEditor: (className, instanceId) => set({ editingInstance: { className, instanceId }, validationErrors: [] }),

  closeEditor: () => set({ editingInstance: null, validationErrors: [] }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  resetInstances: () => {
    saveToSession(null, {}, 1)
    set({
      instances: {},
      nextId: 1,
      editingInstance: null,
      validationErrors: [],
      globalValidationErrors: [],
      globalValidationCount: 0,
    })
  },

  exportJson: () => {
    const { instances, schema, nextId } = get()
    return JSON.stringify({ instances, nextId, schemaHash: schema?.classes.map((c) => c.name).join(',') }, null, 2)
  },

  importJson: (json) => {
    try {
      const data = JSON.parse(json)
      if (!data.instances || typeof data.instances !== 'object') return false
      // Filter to only classes present in the current schema
      const { schema } = get()
      if (schema) {
        const validClassNames = new Set(schema.classes.map((c) => c.name))
        const filtered: Record<string, CrudInstance[]> = {}
        for (const [cls, list] of Object.entries(data.instances)) {
          if (validClassNames.has(cls) && Array.isArray(list)) {
            filtered[cls] = list as CrudInstance[]
          }
        }
        data.instances = filtered
      }
      set({
        instances: data.instances as Record<string, CrudInstance[]>,
        nextId: typeof data.nextId === 'number' ? data.nextId : 1,
        editingInstance: null,
        validationErrors: [],
        ...computeGlobalValidationState(schema, data.instances as Record<string, CrudInstance[]>),
      })
      return true
    } catch {
      return false
    }
  },

  generateRandom: (className, count) => {
    const { schema } = get()
    if (!schema) return
    const cls = schema.classes.find((c) => c.name === className)
    if (!cls || cls.isAbstract) return

    set((s) => {
      const newInstances = { ...s.instances }
      const list = [...(newInstances[className] ?? [])]
      let nextId = s.nextId

      for (let i = 0; i < count; i++) {
        const data: Record<string, unknown> = {}
        for (const attr of cls.attributes) {
          data[attr.name] = randomValue(attr.type, attr.typeKind, schema)
        }
        list.push({ _id: nextId, ...data })
        nextId++
      }

      newInstances[className] = list
      return {
        instances: newInstances,
        nextId,
        ...computeGlobalValidationState(schema, newInstances),
      }
    })
  },

  generateRandomAll: () => {
    const { schema } = get()
    if (!schema) return

    const concreteClasses = schema.classes.filter((c) => !c.isAbstract)
    if (concreteClasses.length === 0) return

    // Step 1: Generate 1-2 instances per concrete class with random attributes
    const newInstances: Record<string, CrudInstance[]> = {}
    let nextId = 1

    for (const cls of concreteClasses) {
      const count = Math.random() < 0.5 ? 1 : 2
      const list: CrudInstance[] = []
      for (let i = 0; i < count; i++) {
        const data: Record<string, unknown> = {}
        for (const attr of cls.attributes) {
          data[attr.name] = randomValue(attr.type, attr.typeKind, schema)
        }
        list.push({ _id: nextId, ...data })
        nextId++
      }
      newInstances[cls.name] = list
    }

    // Step 2: Generate random associations respecting multiplicity constraints
    const processed = new Set<string>()

    for (const cls of concreteClasses) {
      for (const assoc of cls.associations) {
        if (!assoc.isNavigable) continue

        // Deduplicate bidirectional: skip if reverse direction already handled
        if (assoc.reverseRoleName) {
          const reverseKey = `${assoc.targetClass}:${assoc.reverseRoleName}`
          if (processed.has(reverseKey)) continue
          processed.add(`${cls.name}:${assoc.roleName}`)
        }

        const sourceList = newInstances[cls.name] ?? []
        const targetList = collectTargetInstances(schema, newInstances, assoc.targetClass)
        if (sourceList.length === 0 || targetList.length === 0) continue

        const reverseAssoc = findReverseAssoc(schema, assoc)
        const maxReverse = reverseAssoc?.multiplicity.max ?? -1

        // Track how many reverse links each target has accumulated
        const reverseCount = new Map<number, number>()
        for (const t of targetList) reverseCount.set(t._id, 0)

        for (const source of sourceList) {
          const available = targetList.filter((t) => {
            if (assoc.isReflexive && t._id === source._id) return false
            // For reflexive to-one (tree/parent), only link to lower IDs to prevent cycles
            if (assoc.isReflexive && assoc.multiplicity.max === 1 && t._id >= source._id) return false
            if (maxReverse !== -1 && (reverseCount.get(t._id) ?? 0) >= maxReverse) return false
            return true
          })

          const { min, max } = assoc.multiplicity
          const effectiveMax = max === -1 ? available.length : Math.min(max, available.length)
          const effectiveMin = Math.min(min, available.length)
          if (effectiveMax < effectiveMin) continue

          const linkCount = effectiveMin + Math.floor(Math.random() * (effectiveMax - effectiveMin + 1))
          // Shuffle available targets and pick
          const shuffled = [...available].sort(() => Math.random() - 0.5)
          const picked = shuffled.slice(0, linkCount)

          if (picked.length > 0) {
            setAssocIds(source, assoc.roleName, picked.map((t) => t._id), max)

            if (reverseAssoc) {
              for (const target of picked) {
                const existing = getAssocIds(target, assoc.reverseRoleName)
                setAssocIds(
                  target,
                  assoc.reverseRoleName,
                  [...existing, source._id],
                  reverseAssoc.multiplicity.max,
                )
                reverseCount.set(target._id, (reverseCount.get(target._id) ?? 0) + 1)
              }
            }
          }
        }
      }
    }

    set({
      instances: newInstances,
      nextId,
      editingInstance: null,
      validationErrors: [],
      ...computeGlobalValidationState(schema, newInstances),
    })
  },
}))

// ── Auto-persist to sessionStorage (debounced) ──────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null

useCrudStore.subscribe((state, prev) => {
  if (state.instances === prev.instances && state.nextId === prev.nextId) return
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    const { schemaRequestKey, instances, nextId } = useCrudStore.getState()
    saveToSession(schemaRequestKey, instances, nextId)
  }, 300)
})

// ── Reverse link sync helper ─────────────────────────────────────────

/**
 * Syncs bidirectional association links.
 * Compares newData vs oldData for __assoc__ keys and updates reverse ends.
 * Mutates newInstances in place.
 */
function syncReverseLinks(
  schema: CrudSchema,
  newInstances: Record<string, CrudInstance[]>,
  className: string,
  instanceId: number,
  newData: Record<string, unknown>,
  oldData: Record<string, unknown>,
) {
  const clsDef = schema.classes.find((c) => c.name === className)
  if (!clsDef) return
  const sourceList = newInstances[className] ?? []
  const source = sourceList.find((inst) => inst._id === instanceId)

  for (const assoc of clsDef.associations) {
    if (!assoc.reverseRoleName) continue
    const key = assocKey(assoc.roleName)
    const reverseAssoc = findReverseAssoc(schema, assoc)

    const oldVal = oldData[key]
    const newVal = newData[key]

    const oldIds = toIdArray(oldVal)
    const newIds = toIdArray(newVal)

    const added = newIds.filter((id) => !oldIds.includes(id))
    const removed = oldIds.filter((id) => !newIds.includes(id))

    const targetList = newInstances[assoc.targetClass] ?? []

    // Add reverse links for newly added targets
    for (const tid of added) {
      const target = targetList.find((i) => i._id === tid)
      if (!target) continue
      const reverseIds = getAssocIds(target, assoc.reverseRoleName)
      const occupiedByOthers = reverseIds.filter((id) => id !== instanceId)

      if (
        reverseAssoc &&
        reverseAssoc.multiplicity.max !== -1 &&
        occupiedByOthers.length >= reverseAssoc.multiplicity.max
      ) {
        // Reject the forward link when the reverse end is already full.
        if (source) {
          removeAssocId(source, assoc.roleName, tid, assoc.multiplicity.max)
        }
        continue
      }

      if (!reverseIds.includes(instanceId)) {
        setAssocIds(
          target,
          assoc.reverseRoleName,
          [...reverseIds, instanceId],
          reverseAssoc?.multiplicity.max,
        )
      }
    }

    // Remove reverse links for removed targets
    for (const tid of removed) {
      const target = targetList.find((i) => i._id === tid)
      if (target) {
        removeAssocId(target, assoc.reverseRoleName, instanceId, reverseAssoc?.multiplicity.max)
      }
    }
  }
}

/** Normalise a stored association value to a number[]. */
export function toIdArray(val: unknown): number[] {
  if (val === undefined || val === null) return []
  if (Array.isArray(val)) return val as number[]
  if (typeof val === 'number') return [val]
  return []
}

function enqueueCompositionChildren(
  schema: CrudSchema,
  instances: Record<string, CrudInstance[]>,
  className: string,
  instanceId: number,
  cascadeQueue: Array<{ cls: string; id: number }>,
) {
  for (const childCls of schema.classes) {
    for (const assoc of childCls.associations) {
      if (!assoc.isComposition || assoc.targetClass !== className) continue
      for (const child of instances[childCls.name] ?? []) {
        if (getAssocIds(child, assoc.roleName).includes(instanceId)) {
          cascadeQueue.push({ cls: childCls.name, id: child._id })
        }
      }
    }
  }
}

function removeReverseLinksForInstance(
  schema: CrudSchema,
  instances: Record<string, CrudInstance[]>,
  className: string,
  inst: CrudInstance,
) {
  const clsDef = schema.classes.find((c) => c.name === className)
  if (!clsDef) return

  for (const assoc of clsDef.associations) {
    if (!assoc.reverseRoleName) continue
    const reverseAssoc = findReverseAssoc(schema, assoc)
    const targetIds = getAssocIds(inst, assoc.roleName)

    for (const tid of targetIds) {
      const targetList = instances[assoc.targetClass]
      const targetInst = targetList?.find((candidate) => candidate._id === tid)
      if (targetInst) {
        removeAssocId(targetInst, assoc.reverseRoleName, inst._id, reverseAssoc?.multiplicity.max)
      }
    }
  }
}

function deleteInstancesInPlace(
  schema: CrudSchema | null,
  instances: Record<string, CrudInstance[]>,
  seeds: Array<{ cls: string; id: number }>,
) {
  const cascadeQueue = [...seeds]
  const deleted = new Set<string>()

  while (cascadeQueue.length > 0) {
    const { cls, id } = cascadeQueue.pop()!
    const key = `${cls}:${id}`
    if (deleted.has(key)) continue
    deleted.add(key)

    const list = instances[cls] ?? []
    const inst = list.find((candidate) => candidate._id === id)
    if (!inst) continue

    if (schema) {
      enqueueCompositionChildren(schema, instances, cls, id, cascadeQueue)
      removeReverseLinksForInstance(schema, instances, cls, inst)
    }

    instances[cls] = list.filter((candidate) => candidate._id !== id)
  }
}

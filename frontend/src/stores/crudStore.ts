import { create } from 'zustand'
import { api } from '@/api/client'
import type { CrudSchema, CrudAssociation } from '@/api/types'
import { getActiveTabName } from './sessionStore'

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

  fetchSchema: async (code, modelId) => {
    const schemaRequestKey = buildCrudSchemaRequestKey(code)
    set({ schemaLoading: true, schemaError: null, schemaRequestKey })
    try {
      const entryFile = getActiveTabName()
      const res = await api.crudSchema({ code, modelId, entryFile })
      // Ignore stale responses: if another fetch was started while we were
      // awaiting, the stored schemaRequestKey will have changed.
      if (get().schemaRequestKey !== schemaRequestKey) return
      const schema = res.schema
      const state = get()
      let selected = state.selectedClass
      if (!selected || !schema.classes.some((c) => c.name === selected)) {
        selected = schema.classes.find((c) => !c.isAbstract)?.name ?? null
      }
      set({
        schema,
        schemaLoading: false,
        schemaError: res.errors || null,
        schemaRequestKey,
        crudModelId: res.modelId || null,
        selectedClass: selected,
        instances: {},
        nextId: 1,
        editingInstance: null,
        validationErrors: [],
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

      return { nextId: s.nextId + 1, instances: newInstances, validationErrors: [] }
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

      return { instances: newInstances, validationErrors: [] }
    })
  },

  deleteInstance: (className, instanceId) => {
    const { schema } = get()

    set((s) => {
      const newInstances = { ...s.instances }
      deleteInstancesInPlace(schema, newInstances, [{ cls: className, id: instanceId }])

      return { instances: newInstances }
    })
  },

  clearAllInstances: (className) => {
    const { schema } = get()

    set((s) => {
      const newInstances = { ...s.instances }
      if (!schema) {
        newInstances[className] = []
        return { instances: newInstances }
      }

      const seeds = (newInstances[className] ?? []).map((inst) => ({ cls: className, id: inst._id }))
      deleteInstancesInPlace(schema, newInstances, seeds)
      return { instances: newInstances }
    })
  },

  openEditor: (className, instanceId) => set({ editingInstance: { className, instanceId }, validationErrors: [] }),

  closeEditor: () => set({ editingInstance: null, validationErrors: [] }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  resetInstances: () => set({ instances: {}, nextId: 1, editingInstance: null, validationErrors: [] }),

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
      return { instances: newInstances, nextId }
    })
  },
}))

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

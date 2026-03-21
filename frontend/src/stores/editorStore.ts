import { create } from 'zustand'

export interface Tab {
  id: string
  name: string
  code: string
  dirty: boolean
  /** Snapshot of code when tab was created or last saved */
  savedCode: string
}

interface EditorState {
  code: string
  modelId: string | null
  tabs: Tab[]
  activeTabId: string

  setCode: (code: string) => void
  setModelId: (id: string) => void
  markSaved: (id?: string) => void
  addTab: (tab: Omit<Tab, 'dirty' | 'savedCode'>) => void
  addNewTab: () => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  renameTab: (id: string, name: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
}

const DEFAULT_CODE = `// Umple model
class Student {
  name;
  id;
}

class Course {
  title;
  code;
}

association {
  * Student -- * Course;
}
`

let nextTabCounter = 1

export const useEditorStore = create<EditorState>((set) => ({
  code: DEFAULT_CODE,
  modelId: null,
  tabs: [{ id: 'main', name: 'model.ump', code: DEFAULT_CODE, dirty: false, savedCode: DEFAULT_CODE }],
  activeTabId: 'main',

  setCode: (code) => set((s) => ({
    code,
    tabs: s.tabs.map((t) =>
      t.id === s.activeTabId
        ? { ...t, code, dirty: code !== t.savedCode }
        : t
    ),
  })),

  setModelId: (modelId) => set({ modelId }),

  markSaved: (id) => set((s) => {
    const targetId = id ?? s.activeTabId
    return {
      tabs: s.tabs.map((t) =>
        t.id === targetId ? { ...t, dirty: false, savedCode: t.code } : t
      ),
    }
  }),

  addTab: (tab) => set((s) => ({
    tabs: [...s.tabs, { ...tab, dirty: false, savedCode: tab.code }],
    activeTabId: tab.id,
    code: tab.code,
  })),

  addNewTab: () => {
    const id = `tab-${Date.now()}`
    const name = `untitled-${nextTabCounter++}.ump`
    const code = '// New Umple model\n'
    set((s) => ({
      tabs: [...s.tabs, { id, name, code, dirty: false, savedCode: code }],
      activeTabId: id,
      code,
    }))
  },

  removeTab: (id) => set((s) => {
    const remaining = s.tabs.filter((t) => t.id !== id)
    if (remaining.length === 0) return s

    if (s.activeTabId === id) {
      const removedIndex = s.tabs.findIndex((t) => t.id === id)
      const nextTab = remaining[Math.min(removedIndex, remaining.length - 1)]
      return {
        tabs: remaining,
        activeTabId: nextTab.id,
        code: nextTab.code,
      }
    }
    return { tabs: remaining }
  }),

  setActiveTab: (activeTabId) => set((s) => {
    const updatedTabs = s.tabs.map((t) =>
      t.id === s.activeTabId ? { ...t, code: s.code } : t
    )
    const nextTab = updatedTabs.find((t) => t.id === activeTabId)
    if (!nextTab) return s
    return {
      tabs: updatedTabs,
      activeTabId,
      code: nextTab.code,
    }
  }),

  renameTab: (id, name) => set((s) => ({
    tabs: s.tabs.map((t) => t.id === id ? { ...t, name } : t),
  })),

  reorderTabs: (fromIndex, toIndex) => set((s) => {
    const newTabs = [...s.tabs]
    const [moved] = newTabs.splice(fromIndex, 1)
    newTabs.splice(toIndex, 0, moved)
    return { tabs: newTabs }
  }),
}))

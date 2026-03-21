import { create } from 'zustand'

interface ModelState {
  loadedExample: string | null
  bookmarkId: string | null
  isReadOnly: boolean

  setLoadedExample: (name: string | null) => void
  setBookmarkId: (id: string | null) => void
  setReadOnly: (readOnly: boolean) => void
}

export const useModelStore = create<ModelState>((set) => ({
  loadedExample: null,
  bookmarkId: null,
  isReadOnly: false,

  setLoadedExample: (loadedExample) => set({ loadedExample }),
  setBookmarkId: (bookmarkId) => set({ bookmarkId }),
  setReadOnly: (isReadOnly) => set({ isReadOnly }),
}))

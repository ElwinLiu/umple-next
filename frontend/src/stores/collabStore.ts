import { create } from 'zustand'

export interface CollabUser {
  clientId: number
  name: string
  color: string
}

interface CollabState {
  isCollaborating: boolean
  roomId: string | null
  connected: boolean
  connectedUsers: CollabUser[]

  startCollab: (roomId: string) => void
  stopCollab: () => void
  setConnected: (v: boolean) => void
  setConnectedUsers: (users: CollabUser[]) => void
}

export const useCollabStore = create<CollabState>()((set) => ({
  isCollaborating: false,
  roomId: null,
  connected: false,
  connectedUsers: [],

  startCollab: (roomId) => set({ isCollaborating: true, roomId }),
  stopCollab: () => set({ isCollaborating: false, roomId: null, connected: false, connectedUsers: [] }),
  setConnected: (connected) => set({ connected }),
  setConnectedUsers: (connectedUsers) => set({ connectedUsers }),
}))

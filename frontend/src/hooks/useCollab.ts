import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useCollabStore, type CollabUser } from '../stores/collabStore'
import { useSessionStore } from '../stores/sessionStore'
import { generateIdentity } from '../lib/identity'

// Module-level refs — non-serializable objects kept outside Zustand
let ydoc: Y.Doc | null = null
let provider: WebsocketProvider | null = null

export function getYDoc() { return ydoc }
export function getProvider() { return provider }
export function getAwareness() { return provider?.awareness ?? null }

/**
 * Main collab orchestration hook. Watches collabStore.roomId and manages
 * the Yjs provider lifecycle, awareness, and initial sync.
 *
 * Collab is single-tab: the shared Y.Text("code") syncs with the active
 * tab's code. Tabs are local-only — each user manages their own tabs.
 */
export function useCollab() {
  const roomId = useCollabStore((s) => s.roomId)
  const identityRef = useRef(generateIdentity())

  useEffect(() => {
    if (!roomId) {
      // Clean up on leave
      if (provider) {
        provider.awareness.setLocalState(null)
        provider.destroy()
        provider = null
      }
      if (ydoc) {
        ydoc.destroy()
        ydoc = null
      }
      useCollabStore.getState().setConnected(false)
      useCollabStore.getState().setConnectedUsers([])
      return
    }

    // Create YDoc and provider
    const doc = new Y.Doc()
    ydoc = doc

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    const wsProvider = new WebsocketProvider(wsUrl, `ws/collab/${roomId}`, doc, {
      // Disable BroadcastChannel — we want distinct clients per tab
      disableBc: true,
    })
    provider = wsProvider

    // Awareness changes → update connectedUsers
    // MUST be registered BEFORE setLocalStateField so the handler catches
    // the initial local state change. Without this, a solo user sees 0 users.
    const awarenessHandler = () => {
      const states = wsProvider.awareness.getStates() as Map<number, { user?: { name: string; color: string } }>
      const users: CollabUser[] = []
      states.forEach((state, clientId) => {
        if (state.user) {
          users.push({
            clientId,
            name: state.user.name,
            color: state.user.color,
          })
        }
      })
      // Only update store if the user list actually changed
      // Sort by clientId for stable comparison (Map iteration order can differ across clients)
      users.sort((a, b) => a.clientId - b.clientId)
      const prev = useCollabStore.getState().connectedUsers
      if (prev.length !== users.length || prev.some((u, i) => u.clientId !== users[i].clientId)) {
        useCollabStore.getState().setConnectedUsers(users)
      }
    }
    wsProvider.awareness.on('change', awarenessHandler)

    // Set up awareness with local identity (after handler registration)
    const identity = identityRef.current
    wsProvider.awareness.setLocalStateField('user', {
      name: identity.name,
      color: identity.color,
    })

    // Track WS connection for disconnect detection, but don't set
    // collabStore.connected yet — that gates the editor binding and must
    // wait until the YDoc is populated (see sync handler below).
    wsProvider.on('status', ({ status }: { status: string }) => {
      if (status !== 'connected') {
        useCollabStore.getState().setConnected(false)
      }
    })

    // Sync event — populate or hydrate, THEN mark connected.
    // The order matters: Y.Text must have content before yCollab binds
    // to the editor, otherwise the editor's existing text and the Y.Text
    // insert merge together and duplicate the code.
    const handleSync = (synced: boolean) => {
      if (!synced) return

      const ytext = doc.getText('code')

      if (ytext.length === 0) {
        // Room creator: populate Y.Text from current editor code
        const { code } = useSessionStore.getState()
        if (code) {
          ytext.insert(0, code)
        }
      } else {
        // Joiner: hydrate sessionStore from Y.Text
        useSessionStore.getState().setCode(ytext.toString())
      }

      // NOW mark connected — the Y.Text is populated, so yCollab can
      // safely bind without duplicating content.
      useCollabStore.getState().setConnected(true)
      awarenessHandler()
    }
    wsProvider.on('sync', handleSync)

    return () => {
      wsProvider.awareness.off('change', awarenessHandler)
      wsProvider.off('sync', handleSync)
      wsProvider.awareness.setLocalState(null)
      wsProvider.destroy()
      provider = null
      doc.destroy()
      ydoc = null
      useCollabStore.getState().setConnected(false)
      useCollabStore.getState().setConnectedUsers([])
    }
  }, [roomId])
}

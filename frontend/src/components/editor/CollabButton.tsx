import { useState, useCallback, useRef, useEffect } from 'react'
import { Users, Copy, Check, LogOut } from 'lucide-react'
import { useCollabStore } from '../../stores/collabStore'
import { useSessionStore } from '../../stores/sessionStore'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function CollabButton() {
  const isCollaborating = useCollabStore((s) => s.isCollaborating)
  const connected = useCollabStore((s) => s.connected)
  const connectedUsers = useCollabStore((s) => s.connectedUsers)
  const startCollab = useCollabStore((s) => s.startCollab)
  const stopCollab = useCollabStore((s) => s.stopCollab)

  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  const getCollabUrl = useCallback(() => {
    const modelId = useSessionStore.getState().modelId
    const roomId = modelId ?? crypto.randomUUID()
    const url = new URL(window.location.href)
    url.searchParams.delete('model')
    url.searchParams.set('collab', roomId)
    return { roomId, url: url.toString() }
  }, [])

  const handleStartCollab = useCallback(() => {
    const { roomId, url } = getCollabUrl()
    window.history.replaceState({}, '', url)
    startCollab(roomId)
  }, [getCollabUrl, startCollab])

  const handleCopyUrl = useCallback(async () => {
    const roomId = useCollabStore.getState().roomId
    if (!roomId) return
    const url = new URL(window.location.href)
    url.searchParams.set('collab', roomId)
    await navigator.clipboard.writeText(url.toString())
    setCopied(true)
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleStopCollab = useCallback(() => {
    stopCollab()
    // URL cleanup is handled by useCollabFromURL
  }, [stopCollab])

  if (!isCollaborating) {
    return (
      <Tip content="Share for collaboration" side="bottom">
        <button
          onClick={handleStartCollab}
          className="flex items-center gap-1.5 px-2.5 h-full text-ink-faint hover:text-ink-muted transition-colors cursor-pointer shrink-0"
          aria-label="Share for collaboration"
          data-testid="collab-share-btn"
        >
          <Users className="size-3.5" />
          <span className="text-xs">Share</span>
        </button>
      </Tip>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 h-full text-ink-muted hover:text-ink transition-colors cursor-pointer shrink-0"
          aria-label="Collaboration settings"
          data-testid="collab-status-btn"
        >
          {/* User dots */}
          <div className="flex -space-x-1">
            {connectedUsers.slice(0, 4).map((user) => (
              <span
                key={user.clientId}
                className="size-3 rounded-full border border-surface-0"
                style={{ backgroundColor: user.color }}
                title={user.name}
              />
            ))}
          </div>
          <span className="text-xs">{connectedUsers.length}</span>
          {/* Connection indicator */}
          <span
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-status-success' : 'bg-status-warning'
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-3">
          <div className="text-xs font-medium text-ink">
            {connectedUsers.length} collaborator{connectedUsers.length !== 1 ? 's' : ''}
          </div>

          {/* User list */}
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {connectedUsers.map((user) => (
              <div key={user.clientId} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: user.color }}
                />
                <span className="truncate text-ink-muted">{user.name}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border">
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-ink-muted hover:text-ink hover:bg-surface-1 rounded transition-colors cursor-pointer"
            >
              {copied ? <Check className="size-3 text-status-success" /> : <Copy className="size-3" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={handleStopCollab}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-status-error hover:bg-surface-1 rounded transition-colors cursor-pointer"
            >
              <LogOut className="size-3" />
              Stop collaborating
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

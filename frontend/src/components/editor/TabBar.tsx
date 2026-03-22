import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore, type Tab } from '../../stores/editorStore'
import { useUiStore } from '../../stores/uiStore'
import { Plus, X, ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu'

// ── TabBar ────────────────────────────────────────────────────────────

export function TabBar() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const removeTab = useEditorStore((s) => s.removeTab)
  const addNewTab = useEditorStore((s) => s.addNewTab)
  const renameTab = useEditorStore((s) => s.renameTab)
  const closeOtherTabs = useEditorStore((s) => s.closeOtherTabs)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // ── Overflow detection via IntersectionObserver ──

  const leftSentinelRef = useRef<HTMLDivElement>(null)
  const rightSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === leftSentinelRef.current) {
            setCanScrollLeft(!entry.isIntersecting)
          }
          if (entry.target === rightSentinelRef.current) {
            setCanScrollRight(!entry.isIntersecting)
          }
        }
      },
      { root: container, threshold: 0.9 }
    )

    if (leftSentinelRef.current) observer.observe(leftSentinelRef.current)
    if (rightSentinelRef.current) observer.observe(rightSentinelRef.current)

    return () => observer.disconnect()
  }, [tabs.length])

  const scroll = useCallback((direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -150 : 150,
      behavior: 'smooth',
    })
  }, [])

  // ── Keyboard navigation (arrow keys within tablist) ──

  const handleTablistKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tabElements = scrollRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')
      if (!tabElements?.length) return

      const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
      let nextIndex: number | null = null

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % tabs.length
          break
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = tabs.length - 1
          break
        case 'Delete':
          if (tabs.length > 1) removeTab(activeTabId)
          e.preventDefault()
          return
        default:
          return
      }

      if (nextIndex !== null) {
        e.preventDefault()
        setActiveTab(tabs[nextIndex].id)
        tabElements[nextIndex]?.focus()
      }
    },
    [tabs, activeTabId, setActiveTab, removeTab]
  )

  const showSidebar = useUiStore((s) => s.showSidebar)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <div className="flex items-end h-[38px] shrink-0 bg-surface-2 border-b border-border">
      {/* Sidebar toggle (visible when sidebar is closed) */}
      {!showSidebar && (
        <Tip content="Show sidebar" side="bottom">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center size-7 rounded-full text-ink-faint hover:text-ink-muted hover:bg-surface-1 transition-colors cursor-pointer shrink-0 ml-2 mb-[3px]"
            aria-label="Show sidebar"
          >
            <PanelLeft className="size-3.5" />
          </button>
        </Tip>
      )}

      {/* Scroll left */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="flex items-center justify-center w-7 self-stretch text-ink-faint hover:text-ink-muted transition-colors shrink-0"
          aria-label="Scroll tabs left"
          tabIndex={-1}
        >
          <ChevronLeft className="size-3.5" />
        </button>
      )}

      {/* Scrollable tab strip */}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Open files"
        aria-orientation="horizontal"
        onKeyDown={handleTablistKeyDown}
        className="flex items-end gap-1 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pl-2"
        style={canScrollLeft || canScrollRight ? {
          maskImage: `linear-gradient(to right, ${canScrollLeft ? 'transparent, black 1.5rem' : 'black'}, ${canScrollRight ? 'black calc(100% - 1.5rem), transparent' : 'black'})`,
        } : undefined}
      >
        {/* Left sentinel for overflow detection */}
        <div ref={leftSentinelRef} className="w-px shrink-0" aria-hidden="true" />

        {tabs.map((tab) => (
          <ChromeTab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isOnly={tabs.length === 1}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => removeTab(tab.id)}
            onRename={(name) => renameTab(tab.id, name)}
            onCloseOthers={() => closeOtherTabs(tab.id)}
          />
        ))}

        {/* New tab button (inline after last tab) */}
        <button
          onClick={addNewTab}
          className="flex items-center justify-center size-7 rounded-full text-ink-faint hover:text-ink-muted hover:bg-surface-1 transition-colors cursor-pointer shrink-0 ml-1 mb-[3px]"
          aria-label="New file"
          tabIndex={-1}
        >
          <Plus className="size-3.5" />
        </button>

        {/* Right sentinel for overflow detection */}
        <div ref={rightSentinelRef} className="w-px shrink-0" aria-hidden="true" />
      </div>

      {/* Scroll right */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="flex items-center justify-center w-7 self-stretch text-ink-faint hover:text-ink-muted transition-colors shrink-0"
          aria-label="Scroll tabs right"
          tabIndex={-1}
        >
          <ChevronRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// ── ChromeTab ─────────────────────────────────────────────────────────

interface ChromeTabProps {
  tab: Tab
  isActive: boolean
  isOnly: boolean
  onActivate: () => void
  onClose: () => void
  onRename: (name: string) => void
  onCloseOthers: () => void
}

function ChromeTab({ tab, isActive, isOnly, onActivate, onClose, onRename, onCloseOthers }: ChromeTabProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitRename = () => {
    if (editValue.trim()) {
      onRename(editValue.trim())
    }
    setEditing(false)
  }

  const startRename = () => {
    setEditValue(tab.name)
    setEditing(true)
  }

  // Middle-click to close
  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1 && !isOnly) {
      e.preventDefault()
      onClose()
    }
  }

  // Prevent middle-click autoscroll
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }

  // Close button: always visible on active tab, on hover for inactive.
  // When dirty: show dot instead, X replaces dot on hover.
  const showClose = !isOnly && (tab.dirty ? hovered : (isActive || hovered))
  const showDirtyDot = tab.dirty && !showClose

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={editing}>
        <div
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={isActive}
          aria-controls={`tabpanel-${tab.id}`}
          tabIndex={isActive ? 0 : -1}
          className={`
            group relative flex items-center h-[34px] pl-3 pr-1.5 shrink-0 cursor-pointer
            select-none text-sm font-medium transition-colors rounded-t-[8px]
            ${isActive
              ? 'chrome-tab-active bg-surface-0 text-ink mb-[-1px]'
              : 'text-ink-muted hover:text-ink hover:bg-surface-tab'
            }
          `}
          onClick={onActivate}
          onAuxClick={handleAuxClick}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Tab label or rename input */}
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="w-20 bg-transparent text-sm text-ink outline-none border-b border-brand"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate max-w-[120px]">{tab.name}</span>
          )}

          {/* Close / dirty indicator — fixed-width area to prevent layout shift */}
          <div className="w-5 h-5 ml-1.5 shrink-0 flex items-center justify-center">
            {showDirtyDot ? (
              <span className="w-2 h-2 rounded-full bg-ink-muted" />
            ) : showClose ? (
              <button
                onClick={(e) => { e.stopPropagation(); onClose() }}
                className={`
                  flex items-center justify-center w-5 h-5 rounded-full transition-colors
                  ${isActive
                    ? 'text-ink-muted hover:text-ink hover:bg-surface-2'
                    : 'text-ink-faint hover:text-ink-muted hover:bg-surface-2'
                  }
                `}
                aria-label={`Close ${tab.name}`}
                tabIndex={-1}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={startRename}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={onClose} disabled={isOnly}>Close</ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers} disabled={isOnly}>Close Others</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

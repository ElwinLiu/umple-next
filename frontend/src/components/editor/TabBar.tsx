import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore, type Tab } from '../../stores/editorStore'
import { useUiStore } from '../../stores/uiStore'
import { Plus, X, ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'
import { OutputBadges } from './ExecutionPanel'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'

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

  // ── Delete key (Radix handles ArrowLeft/Right, Home, End) ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' && tabs.length > 1) {
        e.preventDefault()
        removeTab(activeTabId)
      }
    },
    [tabs.length, activeTabId, removeTab]
  )

  const showSidebar = useUiStore((s) => s.showSidebar)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  const activeIndex = tabs.findIndex((t) => t.id === activeTabId)

  return (
    <Tabs value={activeTabId} onValueChange={setActiveTab} className="shrink-0">
      <div className="flex items-center h-[38px] shrink-0 border-b border-border">
        {/* Sidebar toggle (visible when sidebar is closed) */}
        {!showSidebar && (
          <Tip content="Show sidebar" side="bottom">
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center w-9 h-full text-ink-faint hover:text-ink-muted transition-colors cursor-pointer shrink-0"
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
            className="flex items-center justify-center w-7 h-full text-ink-faint hover:text-ink-muted transition-colors shrink-0"
            aria-label="Scroll tabs left"
            tabIndex={-1}
          >
            <ChevronLeft className="size-3.5" />
          </button>
        )}

        {/* Scrollable tab strip */}
        <TabsList
          variant="line"
          ref={scrollRef}
          onKeyDown={handleKeyDown}
          className="flex h-full flex-1 min-w-0 w-auto rounded-none p-0 px-1 justify-start gap-0 bg-transparent overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={canScrollLeft || canScrollRight ? {
            maskImage: `linear-gradient(to right, ${canScrollLeft ? 'transparent, black 1.5rem' : 'black'}, ${canScrollRight ? 'black calc(100% - 1.5rem), transparent' : 'black'})`,
          } : undefined}
        >
          {/* Left sentinel for overflow detection */}
          <div ref={leftSentinelRef} className="w-px shrink-0" aria-hidden="true" />

          {tabs.map((tab, index) => (
            <EditorTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              isOnly={tabs.length === 1}
              showSeparator={
                index < tabs.length - 1 &&
                index !== activeIndex &&
                index !== activeIndex - 1
              }
              onClose={() => removeTab(tab.id)}
              onRename={(name) => renameTab(tab.id, name)}
              onCloseOthers={() => closeOtherTabs(tab.id)}
            />
          ))}

          {/* New tab button (inline after last tab) */}
          <button
            onClick={addNewTab}
            className="flex items-center justify-center size-7 text-ink-faint hover:text-ink-muted transition-colors cursor-pointer shrink-0"
            aria-label="New file"
            tabIndex={-1}
          >
            <Plus className="size-3.5" />
          </button>

          {/* Right sentinel for overflow detection */}
          <div ref={rightSentinelRef} className="w-px shrink-0" aria-hidden="true" />
        </TabsList>

        {/* Scroll right */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="flex items-center justify-center w-7 h-full text-ink-faint hover:text-ink-muted transition-colors shrink-0"
            aria-label="Scroll tabs right"
            tabIndex={-1}
          >
            <ChevronRight className="size-3.5" />
          </button>
        )}

        {/* Error/warning badges (right-aligned) */}
        <OutputBadges />
      </div>
    </Tabs>
  )
}

// ── EditorTab ─────────────────────────────────────────────────────────

const triggerClassName = cn(
  'h-full flex-none rounded-none border-none px-3 pr-1.5 text-[13px] font-medium cursor-pointer select-none',
  'after:!bottom-0 after:!bg-brand after:!inset-x-0 after:!h-0.5',
  'data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-ink',
  'data-[state=inactive]:text-ink-muted data-[state=inactive]:hover:text-ink',
)

interface EditorTabProps {
  tab: Tab
  isActive: boolean
  isOnly: boolean
  showSeparator: boolean
  onClose: () => void
  onRename: (name: string) => void
  onCloseOthers: () => void
}

function EditorTab({
  tab,
  isActive,
  isOnly,
  showSeparator,
  onClose,
  onRename,
  onCloseOthers,
}: EditorTabProps) {
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
      <ContextMenuTrigger
        disabled={editing}
        className="shrink-0 flex items-stretch"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {editing ? (
          <div className="relative flex items-center h-full px-3 text-[13px]">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="w-20 bg-transparent text-[13px] text-ink outline-none border-b border-brand"
            />
          </div>
        ) : (
          <TabsTrigger
            value={tab.id}
            className={triggerClassName}
            onAuxClick={handleAuxClick}
            onMouseDown={handleMouseDown}
          >
            {/* Separator between inactive tabs */}
            {showSeparator && !hovered && (
              <span className="absolute right-0 top-[22%] bottom-[22%] w-px bg-border" />
            )}

            <span className="truncate max-w-[120px]">{tab.name}</span>

            {/* Close / dirty indicator — fixed-width to prevent layout shift */}
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              {showDirtyDot ? (
                <span className="w-1.5 h-1.5 rounded-full bg-brand opacity-70" />
              ) : showClose ? (
                <button
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); onClose() }}
                  className={cn(
                    'flex items-center justify-center w-5 h-5 rounded transition-colors cursor-pointer',
                    isActive
                      ? 'text-ink-muted hover:text-ink hover:bg-surface-1'
                      : 'text-ink-faint hover:text-ink-muted hover:bg-surface-2',
                  )}
                  aria-label={`Close ${tab.name}`}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          </TabsTrigger>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={startRename}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={onClose} disabled={isOnly}>Close</ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers} disabled={isOnly}>Close Others</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

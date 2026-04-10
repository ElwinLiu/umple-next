import { useState, useEffect, useCallback, useMemo } from 'react'
import { useEphemeralStore } from '../../stores/ephemeralStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useGenerate } from '../../hooks/useGenerate'
import { useExamples } from '../../hooks/useExamples'
import { GENERATE_ONLY_TARGET_GROUPS } from '../../generation/targets'
import { DIAGRAM_VIEW_ICON, VIEW_MODE_GROUPS } from '../../constants/diagram'
import { EXAMPLE_CATEGORY_LABELS } from '../../constants/examples'
import type { ExampleCategoryId } from '../../api/types'
import {
  LayoutGrid, Workflow, GitBranch, Network,
  Code, Layers, Maximize2, Minimize2,
  Terminal, FileCode,
  ChevronRight, ChevronLeft, BookOpen, FolderOpen,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command'

const CATEGORY_ICONS: Partial<Record<ExampleCategoryId, React.ReactNode>> = {
  class: <LayoutGrid />,
  state: <Workflow />,
  structure: <Network />,
  feature: <GitBranch />,
}

export function CommandPalette() {
  const {
    commandPaletteOpen, closeCommandPalette,
    setDiagramOnly, diagramOnly, toggleOutputPanel,
    setRenderMode, renderMode, commandPaletteInitialPage,
  } = useEphemeralStore()
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const viewMode = useSessionStore((s) => s.viewMode)
  const umpleModel = useSessionStore((s) => s.umpleModel)
  const generate = useGenerate()
  const { categories, loadExample, loading } = useExamples()

  const [pages, setPages] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const page = pages[pages.length - 1]

  // Reset state when palette closes
  useEffect(() => {
    if (!commandPaletteOpen) {
      setPages([])
      setSearch('')
      return
    }
    if (commandPaletteInitialPage) {
      setPages(commandPaletteInitialPage)
      setSearch('')
    }
  }, [commandPaletteOpen, commandPaletteInitialPage])

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        const state = useEphemeralStore.getState()
        if (state.commandPaletteOpen) {
          state.closeCommandPalette()
        } else {
          state.openCommandPalette()
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  const pushPage = useCallback((p: string) => {
    setPages((prev) => [...prev, p])
    setSearch('')
  }, [])

  const popPage = useCallback(() => {
    setPages((prev) => prev.slice(0, -1))
    setSearch('')
  }, [])

  const handleCommandKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Backspace' && !search && pages.length > 0) {
        e.preventDefault()
        popPage()
      }
    },
    [search, pages.length, popPage],
  )

  const handleGenerate = useCallback(async (language: string) => {
    closeCommandPalette()
    generate(language)
  }, [closeCommandPalette, generate])

  const currentCategory = useMemo(() => {
    if (!page || page === 'examples') return undefined
    return categories.find((c) => c.id === page)
  }, [categories, page])
  const canToggleRenderer = viewMode === 'class' && !!umpleModel?.umpleClasses?.length

  const breadcrumb = pages
    .map((p) => (p === 'examples' ? 'Examples' : EXAMPLE_CATEGORY_LABELS[p as ExampleCategoryId] ?? p))
    .join(' \u203A ')

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={(open) => { if (!open) closeCommandPalette() }}
      showCloseButton={false}
      className="sm:max-w-[520px]"
      data-testid="command-palette"
      onCommandKeyDown={handleCommandKeyDown}
    >
      <CommandInput
        placeholder={!page ? 'Type a command...' : 'Search...'}
        data-testid="command-palette-input"
        value={search}
        onValueChange={setSearch}
      />

      {pages.length > 0 && (
        <div
          className="flex items-center gap-1.5 border-b border-border px-3 py-1.5"
          data-testid="command-palette-breadcrumb"
        >
          <button
            type="button"
            onClick={popPage}
            aria-label="Go back"
            className="flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            data-testid="command-palette-back"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs text-muted-foreground">{breadcrumb}</span>
        </div>
      )}

      <CommandList data-testid="command-palette-results">
        <CommandEmpty>No results found</CommandEmpty>

        {/* Root page */}
        {!page && (
          <>
            {VIEW_MODE_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.modes.map((mode) => (
                  <CommandItem
                    key={mode.value}
                    onSelect={() => {
                      setViewMode(mode.value)
                      useEphemeralStore.getState().setRightPanelView('diagram')
                      closeCommandPalette()
                    }}
                    data-testid={`command-item-diagram-${mode.value}`}
                  >
                    <DIAGRAM_VIEW_ICON />
                    {mode.longLabel ?? mode.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            <CommandSeparator />

            {GENERATE_ONLY_TARGET_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.targets.map((target) => (
                  <CommandItem
                    key={target.id}
                    onSelect={() => handleGenerate(target.id)}
                    data-testid={`command-item-gen-${target.id}`}
                  >
                    <Code />
                    {target.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            <CommandSeparator />
            <CommandGroup heading="View">
              {canToggleRenderer && (
                <CommandItem
                  onSelect={() => {
                    setRenderMode(renderMode === 'editable' ? 'graphviz' : 'editable')
                    closeCommandPalette()
                  }}
                  data-testid="command-item-view-renderer"
                >
                  <Layers />
                  Switch to {renderMode === 'editable' ? 'Graphviz' : 'Editable'} Rendering
                </CommandItem>
              )}
              <CommandItem
                onSelect={() => {
                  setDiagramOnly(!diagramOnly)
                  closeCommandPalette()
                }}
                data-testid="command-item-view-diagram-only"
              >
                {diagramOnly ? <Minimize2 /> : <Maximize2 />}
                {diagramOnly ? 'Exit Diagram Only Mode' : 'Diagram Only Mode'}
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  toggleOutputPanel()
                  closeCommandPalette()
                }}
                data-testid="command-item-view-output-panel"
              >
                <Terminal />
                Toggle Output Panel
                <CommandShortcut>Ctrl+'</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="Examples">
              {loading ? (
                <div className="py-2 text-center text-xs text-muted-foreground">Loading examples...</div>
              ) : categories.length > 0 ? (
                <CommandItem
                  onSelect={() => pushPage('examples')}
                  data-testid="command-item-examples-browse"
                >
                  <BookOpen />
                  Browse Examples...
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </CommandItem>
              ) : null}
            </CommandGroup>
          </>
        )}

        {/* Examples: category list */}
        {page === 'examples' && (
          <CommandGroup heading="Categories">
            {categories.map((cat) => (
              <CommandItem
                key={cat.id}
                onSelect={() => pushPage(cat.id)}
                data-testid={`command-item-category-${cat.label}`}
              >
                {CATEGORY_ICONS[cat.id] ?? <FolderOpen />}
                {cat.label}
                <span className="ml-auto text-xs text-muted-foreground">
                  {cat.examples.length}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Examples: example list within a category */}
        {currentCategory && (
          <CommandGroup heading={currentCategory.label}>
            {currentCategory.examples.map((ex) => (
                <CommandItem
                  key={ex.name}
                  onSelect={() => {
                    closeCommandPalette()
                    loadExample(ex.name, {
                      categoryId: currentCategory.id,
                      switchToDefaultView: true,
                    })
                  }}
                  data-testid={`command-item-example-${ex.name}`}
                >
                  <FileCode />
                  {ex.label || ex.name}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

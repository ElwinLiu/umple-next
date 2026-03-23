import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { useEditorStore } from '../../stores/editorStore'
import { useGenerate } from '../../hooks/useGenerate'
import { api } from '../../api/client'
import type { ExampleCategory } from '../../api/types'
import { GENERATE_TARGETS } from '../../generation/targets'
import { getViewForExampleCategory } from '../../constants/diagram'
import {
  LayoutGrid, Workflow, GitBranch, Network,
  Code, Layers, Maximize2, Minimize2,
  Terminal, ClipboardList, FileCode,
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

const DIAGRAM_VIEWS: { value: DiagramView; label: string; icon: React.ReactNode }[] = [
  { value: 'class', label: 'Class Diagram', icon: <LayoutGrid /> },
  { value: 'state', label: 'State Diagram', icon: <Workflow /> },
  { value: 'feature', label: 'Feature Diagram', icon: <GitBranch /> },
  { value: 'structure', label: 'Structure Diagram', icon: <Network /> },
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Class Diagrams': <LayoutGrid />,
  'State Machines': <Workflow />,
  'Composite Structure': <Network />,
  'Feature Diagrams': <GitBranch />,
}

export function CommandPalette() {
  const {
    commandPaletteOpen, closeCommandPalette,
    toggleTaskPanel, setDiagramOnly, diagramOnly, toggleOutputPanel,
  } = useUiStore()
  const { setViewMode, setRenderMode, renderMode } = useDiagramStore()
  const loadExample = useEditorStore((s) => s.loadExample)
  const generate = useGenerate()

  const [categories, setCategories] = useState<ExampleCategory[]>([])
  const [pages, setPages] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const page = pages[pages.length - 1]

  // Load categories on first open
  useEffect(() => {
    if (commandPaletteOpen && categories.length === 0) {
      api.listExamples().then(setCategories).catch(() => {})
    }
  }, [commandPaletteOpen, categories.length])

  // Reset state when palette closes
  useEffect(() => {
    if (!commandPaletteOpen) {
      setPages([])
      setSearch('')
    }
  }, [commandPaletteOpen])

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        const state = useUiStore.getState()
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

  const handleLoadExample = useCallback(async (name: string, category: string) => {
    closeCommandPalette()
    try {
      const res = await api.getExample(name)
      loadExample(res.name, res.code)
      const view = getViewForExampleCategory(category)
      if (view) {
        setViewMode(view)
      }
      useUiStore.getState().setRightPanelView('diagram')
    } catch { /* ignore */ }
  }, [closeCommandPalette, loadExample, setViewMode])

  const currentCategory = useMemo(
    () => page && page !== 'examples' ? categories.find((c) => c.name === page) : undefined,
    [categories, page],
  )

  const breadcrumb = pages.map((p) => (p === 'examples' ? 'Examples' : p)).join(' \u203A ')

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
            <CommandGroup heading="Diagram">
              {DIAGRAM_VIEWS.map((dt) => (
                <CommandItem
                  key={dt.value}
                  onSelect={() => {
                    setViewMode(dt.value)
                    useUiStore.getState().setRightPanelView('diagram')
                    closeCommandPalette()
                  }}
                  data-testid={`command-item-diagram-${dt.value}`}
                >
                  {dt.icon}
                  {dt.label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="Generate">
              {GENERATE_TARGETS.map((target) => (
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

            <CommandSeparator />
            <CommandGroup heading="View">
              <CommandItem
                onSelect={() => {
                  setRenderMode(renderMode === 'reactflow' ? 'graphviz' : 'reactflow')
                  closeCommandPalette()
                }}
              >
                <Layers />
                Switch to {renderMode === 'reactflow' ? 'GraphViz' : 'ReactFlow'} Rendering
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setDiagramOnly(!diagramOnly)
                  closeCommandPalette()
                }}
              >
                {diagramOnly ? <Minimize2 /> : <Maximize2 />}
                {diagramOnly ? 'Exit Diagram Only Mode' : 'Diagram Only Mode'}
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  toggleOutputPanel()
                  closeCommandPalette()
                }}
              >
                <Terminal />
                Toggle Output Panel
                <CommandShortcut>Ctrl+'</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  toggleTaskPanel()
                  closeCommandPalette()
                }}
              >
                <ClipboardList />
                Task Panel
              </CommandItem>
            </CommandGroup>

            {categories.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Examples">
                  <CommandItem
                    onSelect={() => pushPage('examples')}
                    data-testid="command-item-examples-browse"
                  >
                    <BookOpen />
                    Browse Examples...
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </>
        )}

        {/* Examples: category list */}
        {page === 'examples' && (
          <CommandGroup heading="Categories">
            {categories.map((cat) => (
              <CommandItem
                key={cat.name}
                onSelect={() => pushPage(cat.name)}
                data-testid={`command-item-category-${cat.name}`}
              >
                {CATEGORY_ICONS[cat.name] ?? <FolderOpen />}
                {cat.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {cat.examples.length}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Examples: example list within a category */}
        {currentCategory && (
          <CommandGroup heading={page}>
            {currentCategory.examples.map((ex) => (
                <CommandItem
                  key={ex.name}
                  onSelect={() => handleLoadExample(ex.name, currentCategory.name)}
                  data-testid={`command-item-example-${ex.name}`}
                >
                  <FileCode />
                  {ex.name}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

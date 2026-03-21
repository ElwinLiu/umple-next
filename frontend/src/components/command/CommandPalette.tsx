import { useState, useEffect, useCallback } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { useEditorStore } from '../../stores/editorStore'
import { api } from '../../api/client'
import { UMPLE_TARGETS, type ExampleEntry } from '../../api/types'
import {
  LayoutGrid, Workflow, GitBranch, Network,
  Code, Layers, Maximize2, Minimize2,
  Terminal, Sparkles, ClipboardList, FileCode,
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

export function CommandPalette() {
  const {
    commandPaletteOpen, closeCommandPalette,
    setGeneratedOutput, setGeneratingCode, setGeneratedError,
    toggleAiPanel, toggleTaskPanel, setDiagramOnly, diagramOnly, toggleExecutionPanel,
  } = useUiStore()
  const { setViewMode, setRenderMode, renderMode } = useDiagramStore()
  const code = useEditorStore((s) => s.code)
  const modelId = useEditorStore((s) => s.modelId)
  const setCode = useEditorStore((s) => s.setCode)

  const [examples, setExamples] = useState<ExampleEntry[]>([])

  // Load examples on first open
  useEffect(() => {
    if (commandPaletteOpen && examples.length === 0) {
      api.listExamples().then(setExamples).catch(() => {})
    }
  }, [commandPaletteOpen, examples.length])

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

  const handleGenerate = useCallback(async (language: string) => {
    closeCommandPalette()
    if (!code.trim()) return
    setGeneratingCode(true)
    setGeneratedError(null)
    try {
      const res = await api.generate({ code, language, modelId: modelId ?? undefined })
      setGeneratedOutput(res.output, language)
      if (res.errors) setGeneratedError(res.errors)
    } catch (err: any) {
      setGeneratedError(err.message || 'Generation failed')
    } finally {
      setGeneratingCode(false)
    }
  }, [code, modelId, closeCommandPalette, setGeneratedOutput, setGeneratingCode, setGeneratedError])

  const handleLoadExample = useCallback(async (name: string) => {
    closeCommandPalette()
    try {
      const res = await api.getExample(name)
      setCode(res.code)
    } catch { /* ignore */ }
  }, [closeCommandPalette, setCode])

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={(open) => { if (!open) closeCommandPalette() }}
      showCloseButton={false}
      className="sm:max-w-[520px]"
      data-testid="command-palette"
    >
      <CommandInput placeholder="Type a command..." data-testid="command-palette-input" />
      <CommandList data-testid="command-palette-results">
        <CommandEmpty>No results found</CommandEmpty>

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
          {UMPLE_TARGETS.map((target) => (
            <CommandItem
              key={target}
              onSelect={() => handleGenerate(target)}
              data-testid={`command-item-gen-${target}`}
            >
              <Code />
              {target}
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
              toggleExecutionPanel()
              closeCommandPalette()
            }}
          >
            <Terminal />
            Toggle Output Panel
            <CommandShortcut>Ctrl+'</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleAiPanel()
              closeCommandPalette()
            }}
          >
            <Sparkles />
            AI Assistant
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

        {examples.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Examples">
              {examples.map((ex) => (
                <CommandItem
                  key={ex.name}
                  onSelect={() => handleLoadExample(ex.name)}
                  data-testid={`command-item-example-${ex.name}`}
                >
                  <FileCode />
                  {ex.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

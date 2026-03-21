import { useState, useEffect, useCallback } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useDiagramStore, type DiagramView } from '../../stores/diagramStore'
import { useEditorStore } from '../../stores/editorStore'
import { api } from '../../api/client'
import type { ExampleEntry } from '../../api/types'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'

const UMPLE_TARGETS = [
  'Java', 'Php', 'Python', 'Ruby', 'Cpp', 'RTCpp', 'SimpleCpp',
  'Json', 'Sql', 'Alloy', 'NuSMV', 'USE', 'Ecore', 'TextUml', 'Umlet', 'SimulateJava',
] as const

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
          {([
            { value: 'class' as DiagramView, label: 'Class Diagram' },
            { value: 'state' as DiagramView, label: 'State Diagram' },
            { value: 'feature' as DiagramView, label: 'Feature Diagram' },
            { value: 'structure' as DiagramView, label: 'Structure Diagram' },
          ]).map((dt) => (
            <CommandItem
              key={dt.value}
              onSelect={() => {
                setViewMode(dt.value)
                useUiStore.getState().setRightPanelView('diagram')
                closeCommandPalette()
              }}
              data-testid={`command-item-diagram-${dt.value}`}
            >
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
              Generate {target}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              setRenderMode(renderMode === 'reactflow' ? 'graphviz' : 'reactflow')
              closeCommandPalette()
            }}
          >
            Switch to {renderMode === 'reactflow' ? 'GraphViz' : 'ReactFlow'} Rendering
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="View">
          <CommandItem
            onSelect={() => {
              setDiagramOnly(!diagramOnly)
              closeCommandPalette()
            }}
          >
            {diagramOnly ? 'Exit Diagram Only Mode' : 'Diagram Only Mode'}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleExecutionPanel()
              closeCommandPalette()
            }}
          >
            Toggle Output Panel
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="AI">
          <CommandItem
            onSelect={() => {
              toggleAiPanel()
              closeCommandPalette()
            }}
          >
            Open AI Assistant
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Tasks">
          <CommandItem
            onSelect={() => {
              toggleTaskPanel()
              closeCommandPalette()
            }}
          >
            Open Task Panel
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

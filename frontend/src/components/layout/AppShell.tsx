import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './Sidebar'
import { EditorPanel } from '../editor/EditorPanel'
import { ExecutionPanel } from '../editor/ExecutionPanel'
import { DiagramPanel } from '../diagram/DiagramPanel'
import { AiPanel } from '../ai/AiPanel'
import { TaskPanel } from '../task/TaskPanel'
import { CommandPalette } from '../command/CommandPalette'
import { useUiStore } from '../../stores/uiStore'
import { useCompiler } from '../../hooks/useCompiler'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppShell() {
  const { showEditor, diagramOnly, showExecutionPanel, showAiPanel, showTaskPanel } = useUiStore()

  useCompiler()

  const editorVisible = showEditor && !diagramOnly

  return (
    <TooltipProvider>
    <div className="h-screen flex bg-surface-1" data-testid="app-shell">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 p-2.5">
          <PanelGroup direction="horizontal" className="h-full">
            {editorVisible && (
              <>
                <Panel defaultSize={50} minSize={20}>
                  {showExecutionPanel ? (
                    <PanelGroup direction="vertical" className="h-full">
                      <Panel defaultSize={65} minSize={20}>
                        <div className="h-full rounded-lg overflow-hidden bg-surface-0">
                          <EditorPanel />
                        </div>
                      </Panel>
                      <PanelResizeHandle className="h-2.5 cursor-row-resize" />
                      <Panel defaultSize={35} minSize={10}>
                        <div className="h-full rounded-lg overflow-hidden bg-surface-0">
                          <ExecutionPanel />
                        </div>
                      </Panel>
                    </PanelGroup>
                  ) : (
                    <div className="h-full rounded-lg overflow-hidden bg-surface-0">
                      <EditorPanel />
                    </div>
                  )}
                </Panel>
                <PanelResizeHandle className="w-2.5 cursor-col-resize" />
              </>
            )}
            <Panel defaultSize={editorVisible ? 50 : 100} minSize={30}>
              <div className="h-full rounded-lg overflow-hidden bg-surface-0">
                <DiagramPanel />
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {showAiPanel && <AiPanel />}
        {showTaskPanel && <TaskPanel />}
        <CommandPalette />
      </div>
    </div>
    </TooltipProvider>
  )
}

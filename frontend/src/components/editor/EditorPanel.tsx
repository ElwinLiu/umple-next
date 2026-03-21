import { useCallback } from 'react'
import { TabBar } from './TabBar'
import { UmpleEditor } from './UmpleEditor'
import { useEditorStore } from '../../stores/editorStore'

export function EditorPanel() {
  const { code, setCode, activeTabId } = useEditorStore()

  const handleChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [setCode])

  return (
    <div className="flex h-full flex-col" data-testid="editor-panel">
      <TabBar />
      <div className="min-h-0 flex-1 overflow-hidden bg-surface-0">
        <UmpleEditor key={activeTabId} code={code} onChange={handleChange} />
      </div>
    </div>
  )
}

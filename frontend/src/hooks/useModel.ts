import { useEffect } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useModelStore } from '../stores/modelStore'
import { useUiStore } from '../stores/uiStore'
import { useDiagramStore } from '../stores/diagramStore'
import { api } from '../api/client'
import type { DiagramView } from '../stores/diagramStore'

const VALID_DIAGRAM_TYPES: DiagramView[] = ['class', 'state', 'feature', 'structure']

export function useModel() {
  const setCode = useEditorStore((s) => s.setCode)
  const setModelId = useEditorStore((s) => s.setModelId)
  const setLoadedExample = useModelStore((s) => s.setLoadedExample)
  const setReadOnly = useModelStore((s) => s.setReadOnly)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const example = params.get('example')
    const model = params.get('model')
    const text = params.get('text')
    const readOnly = params.has('readOnly')

    if (readOnly) setReadOnly(true)

    // Diagram type: ?diagramtype=class|state|feature|structure
    const diagramType = params.get('diagramtype')
    if (diagramType && VALID_DIAGRAM_TYPES.includes(diagramType as DiagramView)) {
      useDiagramStore.getState().setViewMode(diagramType as DiagramView)
    }

    // Hide text editor: ?notext
    if (params.has('notext')) {
      const uiState = useUiStore.getState()
      if (uiState.showEditor) uiState.toggleEditor()
    }

    // Load content from URL params
    if (text) {
      setCode(decodeURIComponent(text))
    } else if (example) {
      api.getExample(example).then((res) => {
        setCode(res.code)
        setLoadedExample(res.name)
      }).catch(console.error)
    } else if (model) {
      api.getModel(model).then((res) => {
        setCode(res.code)
        setModelId(res.id)
      }).catch(console.error)
    }
  }, [setCode, setModelId, setLoadedExample, setReadOnly])
}

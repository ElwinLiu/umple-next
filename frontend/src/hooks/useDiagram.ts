import { useCallback } from 'react'
import type { GvLayout, UmpleModel } from '../api/types'
import { useDiagramStore } from '../stores/diagramStore'
import { convertClassDiagram } from './diagrams/classConverter'

export function useDiagram() {
  const { setDiagramData } = useDiagramStore()

  const updateClassDiagram = useCallback((
    model: UmpleModel,
    gvLayout?: GvLayout,
  ) => {
    const result = convertClassDiagram(model, gvLayout)
    setDiagramData('class', result.nodes, result.edges)
  }, [setDiagramData])

  return { updateClassDiagram }
}

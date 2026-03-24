import { useCallback } from 'react'
import type { GvLayout, UmpleModel } from '../api/types'
import { useSessionStore } from '../stores/sessionStore'
import { convertClassDiagram } from './diagrams/classConverter'

export function useDiagram() {
  const { setDiagramData } = useSessionStore()

  const updateClassDiagram = useCallback((
    model: UmpleModel,
    gvLayout?: GvLayout,
  ) => {
    const result = convertClassDiagram(model, gvLayout)
    setDiagramData('class', result.nodes, result.edges)
  }, [setDiagramData])

  return { updateClassDiagram }
}

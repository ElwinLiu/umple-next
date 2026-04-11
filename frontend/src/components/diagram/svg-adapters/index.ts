import type { DiagramView } from '@/constants/diagram'
import type { SvgDiagramAdapter } from './types'
import { stateSvgAdapter } from './state'

const ADAPTERS = new Map<DiagramView, SvgDiagramAdapter>([
  ['state', stateSvgAdapter],
])

export function getSvgDiagramAdapter(viewMode?: DiagramView): SvgDiagramAdapter | null {
  if (!viewMode) return null
  return ADAPTERS.get(viewMode) ?? null
}

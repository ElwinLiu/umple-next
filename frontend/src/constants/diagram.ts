import type { DiagramView } from '../stores/sessionStore'
import type { DisplayPrefKey } from '../stores/preferencesStore'

export const EXAMPLE_CATEGORY_TO_VIEW: Partial<Record<string, DiagramView>> = {
  'Class Diagrams': 'class',
  'State Machines': 'state',
  'Composite Structure': 'structure',
  'Feature Diagrams': 'feature',
  'Entity Relationships': 'erd',
}

export function getViewForExampleCategory(category: string): DiagramView | null {
  return EXAMPLE_CATEGORY_TO_VIEW[category] ?? null
}

/** Grouped diagram view modes following the legacy UmpleOnline live-view menu.
 *  Editable class view is controlled separately by render mode, so it is not listed here.
 */
export const VIEW_MODE_GROUPS: {
  label: string
  modes: { value: DiagramView; label: string; longLabel?: string }[]
}[] = [
  {
    label: 'Class Views',
    modes: [
      { value: 'class', label: 'Class', longLabel: 'Class Diagram' },
      { value: 'erd', label: 'Entity Relationship', longLabel: 'Entity Relationship Diagram' },
      { value: 'crud', label: 'CRUD UI', longLabel: 'CRUD UI' },
    ],
  },
  {
    label: 'State Views',
    modes: [
      { value: 'state', label: 'State', longLabel: 'State Machine Diagram' },
      { value: 'stateTables', label: 'State Tables', longLabel: 'State Tables Diagram' },
    ],
  },
  {
    label: 'Special Views',
    modes: [
      { value: 'structure', label: 'Structure', longLabel: 'Composite Structure Diagram' },
      { value: 'feature', label: 'Feature', longLabel: 'Feature Diagram' },
    ],
  },
  {
    label: 'Instance Views',
    modes: [
      { value: 'instance', label: 'Instance', longLabel: 'Instance Diagram' },
      { value: 'eventSequence', label: 'Event Sequence', longLabel: 'Event Sequence Diagram' },
    ],
  },
]

export const ALL_VIEW_MODES = VIEW_MODE_GROUPS.flatMap((g) => g.modes)

/** Display preference toggles per diagram view */
export const DISPLAY_TOGGLES: Record<DiagramView, { key: DisplayPrefKey; label: string }[]> = {
  class: [
    { key: 'showAttributes', label: 'Attributes' },
    { key: 'showMethods', label: 'Methods' },
    { key: 'showTraits', label: 'Traits' },
  ],
  state: [
    { key: 'showActions', label: 'Actions' },
    { key: 'showTransitionLabels', label: 'Transition Labels' },
    { key: 'showGuards', label: 'Guards' },
    { key: 'showGuardLabels', label: 'Guard Labels' },
    { key: 'showNaturalLanguage', label: 'Natural Language' },
  ],
  feature: [
    { key: 'showFeatureDependency', label: 'Feature Dependency' },
  ],
  structure: [],
  erd: [],
  instance: [],
  eventSequence: [],
  stateTables: [],
  crud: [],
}

/** Layout algorithm options for Graphviz */
export const LAYOUT_OPTIONS = [
  { value: 'dot', label: 'Dot (default)' },
  { value: 'sfdp', label: 'SFDP' },
  { value: 'circo', label: 'Circo' },
  { value: 'neato', label: 'Neato' },
  { value: 'fdp', label: 'FDP' },
  { value: 'twopi', label: 'Twopi' },
]

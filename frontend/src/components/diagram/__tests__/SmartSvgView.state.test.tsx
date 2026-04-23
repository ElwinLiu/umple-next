// @vitest-environment jsdom
import * as Y from 'yjs'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SmartSvgView } from '../SmartSvgView'
import { useCollabStore } from '@/stores/collabStore'
import { useSessionStore } from '@/stores/sessionStore'
import { TooltipProvider } from '@/components/ui/tooltip'

let currentDoc: Y.Doc | null = null

vi.mock('@/hooks/useCollab', () => ({
  getYDoc: () => currentDoc,
}))

const svgGraphicsPrototype = SVGGraphicsElement.prototype as SVGGraphicsElement & {
  getBBox?: () => { x: number; y: number; width: number; height: number }
}
const originalGetBBox = svgGraphicsPrototype.getBBox
const originalMatchMedia = window.matchMedia

const STATE_CODE = `class Phone {
  screenLight {
    Off {
      callReceived -> On;
    }

    On {
      hangUp -> Off;
    }
  }
}
`

const STATE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="180" height="120" viewBox="0 0 180 120">
    <g class="node">
      <title>Phone_screenLight_Off</title>
      <a xlink:title="Class Phone, SM state, State Off">
        <rect x="10" y="10" width="60" height="24"></rect>
        <text x="20" y="26">Off</text>
      </a>
    </g>
    <g class="node">
      <title>Phone_screenLight_On</title>
      <a xlink:title="Class Phone, SM state, State On">
        <rect x="100" y="10" width="60" height="24"></rect>
        <text x="120" y="26">On</text>
      </a>
    </g>
    <g class="edge">
      <title>Phone_screenLight_On->Phone_screenLight_Off</title>
      <g id="a_edge1">
        <a xlink:title="From On to Off on hangUp">
          <path d="M120,34 C120,60 60,60 40,34"></path>
        </a>
      </g>
      <g id="a_edge1-label">
        <a xlink:title="From On to Off on hangUp">
          <text x="86" y="58">hangUp</text>
        </a>
      </g>
    </g>
  </svg>
`

beforeAll(() => {
  Object.defineProperty(svgGraphicsPrototype, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 180, height: 120 }),
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

afterAll(() => {
  if (originalGetBBox) {
    Object.defineProperty(svgGraphicsPrototype, 'getBBox', {
      configurable: true,
      value: originalGetBBox,
    })
  } else {
    Reflect.deleteProperty(svgGraphicsPrototype, 'getBBox')
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
})

afterEach(() => {
  cleanup()
  currentDoc?.destroy()
  currentDoc = null
  useCollabStore.setState({
    isCollaborating: false,
    roomId: null,
    connected: false,
    ready: false,
    connectedUsers: [],
  })
  useSessionStore.setState({
    code: '',
    modelId: null,
    activeTabId: 'main',
    syncPending: false,
    tabs: [{
      id: 'main',
      name: 'Model.ump',
      code: '',
      dirty: false,
      savedCode: '',
      undoStack: [],
      redoStack: [],
    }],
  })
})

describe('SmartSvgView state interactions', () => {
  it('dispatches edge metadata when clicking a transition label', () => {
    const events: Array<CustomEvent<{ name: string; kind: string; anchorTitle?: string | null }>> = []
    const handler = (event: Event) => {
      events.push(event as CustomEvent<{ name: string; kind: string; anchorTitle?: string | null }>)
    }
    window.addEventListener('umple:diagram-select', handler)

    render(
      <TooltipProvider>
        <SmartSvgView svg={STATE_SVG} viewMode="state" />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByText('hangUp'))

    expect(events).toHaveLength(1)
    expect(events[0].detail).toEqual({
      name: 'Phone_screenLight_On->Phone_screenLight_Off',
      kind: 'edge',
      anchorTitle: 'From On to Off on hangUp',
    })

    window.removeEventListener('umple:diagram-select', handler)
  })

  it('opens a state node menu and renames the selected state', async () => {
    useSessionStore.setState({
      code: STATE_CODE,
      modelId: 'model-1',
      tabs: [{
        id: 'main',
        name: 'Model.ump',
        code: STATE_CODE,
        dirty: false,
        savedCode: STATE_CODE,
        undoStack: [],
        redoStack: [],
      }],
    })

    const { container } = render(
      <TooltipProvider>
        <SmartSvgView svg={STATE_SVG} viewMode="state" />
      </TooltipProvider>,
    )

    fireEvent.contextMenu(container.querySelector('g.node') as Element)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename State' }))
    fireEvent.change(screen.getByTestId('svg-text-input-dialog-input'), { target: { value: 'Dark' } })
    fireEvent.click(screen.getByTestId('svg-text-input-dialog-submit'))

    await waitFor(() => {
      expect(useSessionStore.getState().code).toContain('Dark {')
      expect(useSessionStore.getState().code).toContain('hangUp -> Dark;')
    })

    const [activeTab] = useSessionStore.getState().tabs
    expect(activeTab.undoStack).toEqual([STATE_CODE])
  })

  it('opens a transition menu and updates the guard', async () => {
    useSessionStore.setState({
      code: STATE_CODE,
      modelId: 'model-1',
      tabs: [{
        id: 'main',
        name: 'Model.ump',
        code: STATE_CODE,
        dirty: false,
        savedCode: STATE_CODE,
        undoStack: [],
        redoStack: [],
      }],
    })

    const { container } = render(
      <TooltipProvider>
        <SmartSvgView svg={STATE_SVG} viewMode="state" />
      </TooltipProvider>,
    )

    fireEvent.contextMenu(container.querySelector('g.edge') as Element)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Change Guard' }))
    fireEvent.change(screen.getByTestId('svg-text-input-dialog-input'), { target: { value: '[lineAvailable]' } })
    fireEvent.click(screen.getByTestId('svg-text-input-dialog-submit'))

    await waitFor(() => {
      expect(useSessionStore.getState().code).toContain('hangUp [lineAvailable] -> Off;')
    })
  })

  it('adds a transition from the state menu', async () => {
    useSessionStore.setState({
      code: STATE_CODE,
      modelId: 'model-1',
      tabs: [{
        id: 'main',
        name: 'Model.ump',
        code: STATE_CODE,
        dirty: false,
        savedCode: STATE_CODE,
        undoStack: [],
        redoStack: [],
      }],
    })

    const { container } = render(
      <TooltipProvider>
        <SmartSvgView svg={STATE_SVG} viewMode="state" />
      </TooltipProvider>,
    )

    const offNode = container.querySelector('[data-node-id="Phone_screenLight_Off"]')

    fireEvent.contextMenu(offNode as Element)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add Transition' }))
    fireEvent.change(screen.getByTestId('svg-text-input-dialog-input'), { target: { value: 'reset' } })
    fireEvent.click(screen.getByTestId('svg-text-input-dialog-submit'))
    await waitFor(() => {
      expect(screen.getByTestId('svg-text-input-dialog-input')).toBeDefined()
    })
    fireEvent.change(screen.getByTestId('svg-text-input-dialog-input'), { target: { value: 'On' } })
    fireEvent.click(screen.getByTestId('svg-text-input-dialog-submit'))

    await waitFor(() => {
      expect(useSessionStore.getState().code).toContain('reset -> On;')
    })
  })

  it('lets users undo SVG menu edits', async () => {
    useSessionStore.setState({
      code: STATE_CODE,
      modelId: 'model-1',
      tabs: [{
        id: 'main',
        name: 'Model.ump',
        code: STATE_CODE,
        dirty: false,
        savedCode: STATE_CODE,
        undoStack: [],
        redoStack: [],
      }],
    })

    const { container } = render(
      <TooltipProvider>
        <SmartSvgView svg={STATE_SVG} viewMode="state" />
      </TooltipProvider>,
    )

    fireEvent.contextMenu(container.querySelector('g.node') as Element)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename State' }))
    fireEvent.change(screen.getByTestId('svg-text-input-dialog-input'), { target: { value: 'Dark' } })
    fireEvent.click(screen.getByTestId('svg-text-input-dialog-submit'))

    await waitFor(() => {
      expect(useSessionStore.getState().code).toContain('Dark {')
    })

    useSessionStore.getState().undo()

    expect(useSessionStore.getState().code).toBe(STATE_CODE)
  })

  it('writes SVG edits into the shared Yjs tab when collaborating', async () => {
    currentDoc = new Y.Doc()
    currentDoc.getText('tab:main').insert(0, STATE_CODE)

    useCollabStore.setState({
      isCollaborating: true,
      roomId: 'room-1',
      connected: true,
      ready: true,
      connectedUsers: [],
    })
    useSessionStore.setState({
      code: STATE_CODE,
      modelId: 'model-1',
      activeTabId: 'main',
      tabs: [{
        id: 'main',
        name: 'Model.ump',
        code: STATE_CODE,
        dirty: false,
        savedCode: STATE_CODE,
        undoStack: [],
        redoStack: [],
      }],
    })

    const { container } = render(
      <TooltipProvider>
        <SmartSvgView svg={STATE_SVG} viewMode="state" />
      </TooltipProvider>,
    )

    fireEvent.contextMenu(container.querySelector('g.node') as Element)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename State' }))
    fireEvent.change(screen.getByTestId('svg-text-input-dialog-input'), { target: { value: 'Dark' } })
    fireEvent.click(screen.getByTestId('svg-text-input-dialog-submit'))

    await waitFor(() => {
      expect(currentDoc?.getText('tab:main').toString()).toContain('Dark {')
      expect(currentDoc?.getText('tab:main').toString()).toContain('hangUp -> Dark;')
    })
  })
})

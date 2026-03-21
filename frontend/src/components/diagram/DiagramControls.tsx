import { useReactFlow } from '@xyflow/react'
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock } from 'lucide-react'
import { useState } from 'react'

export function DiagramControls() {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow()
  const [locked, setLocked] = useState(false)

  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-0.5 bg-surface-0 border border-border rounded-lg shadow-sm p-0.5">
      <ControlButton onClick={() => zoomIn()} title="Zoom in" disabled={locked}>
        <ZoomIn className="size-3.5" />
      </ControlButton>
      <ControlButton onClick={() => zoomOut()} title="Zoom out" disabled={locked}>
        <ZoomOut className="size-3.5" />
      </ControlButton>
      <div className="h-px bg-border mx-0.5" />
      <ControlButton onClick={() => fitView({ padding: 0.1 })} title="Fit to view" disabled={locked} data-diagram-fit-view>
        <Maximize className="size-3.5" />
      </ControlButton>
      <ControlButton
        onClick={() => setLocked(!locked)}
        title={locked ? 'Unlock interactions' : 'Lock interactions'}
        active={locked}
      >
        {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </ControlButton>
    </div>
  )
}

function ControlButton({
  onClick,
  title,
  active,
  disabled,
  children,
  ...rest
}: {
  onClick: () => void
  title: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      {...rest}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'text-brand bg-brand-light'
          : 'text-ink-muted hover:text-ink hover:bg-surface-1'
      }`}
    >
      {children}
    </button>
  )
}

import { useReactFlow } from '@xyflow/react'
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock } from 'lucide-react'
import { useState } from 'react'
import { Tip } from '@/components/ui/tooltip'

export function DiagramControls() {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow()
  const [locked, setLocked] = useState(false)

  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-0.5 bg-surface-0 border border-border rounded-lg shadow-sm p-0.5">
      <ControlButton onClick={() => zoomIn()} label="Zoom in" disabled={locked}>
        <ZoomIn className="size-3.5" />
      </ControlButton>
      <ControlButton onClick={() => zoomOut()} label="Zoom out" disabled={locked}>
        <ZoomOut className="size-3.5" />
      </ControlButton>
      <div className="h-px bg-border mx-0.5" />
      <ControlButton onClick={() => fitView({ padding: 0.1 })} label="Fit to view" disabled={locked} data-diagram-fit-view>
        <Maximize className="size-3.5" />
      </ControlButton>
      <ControlButton
        onClick={() => setLocked(!locked)}
        label={locked ? 'Unlock interactions' : 'Lock interactions'}
        active={locked}
      >
        {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </ControlButton>
    </div>
  )
}

function ControlButton({
  onClick,
  label,
  active,
  disabled,
  children,
  ...rest
}: {
  onClick: () => void
  label: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <Tip content={label} side="right">
      <button
        onClick={onClick}
        aria-label={label}
        disabled={disabled}
        {...rest}
        className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1 ${
          active
            ? 'text-brand bg-brand-light'
            : 'text-ink-muted hover:text-ink hover:bg-surface-1'
        }`}
      >
        {children}
      </button>
    </Tip>
  )
}

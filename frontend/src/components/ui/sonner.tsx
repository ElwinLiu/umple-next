import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = usePreferencesStore((s) => s.theme)

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      closeButton
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'border shadow-lg text-sm',
          closeButton: 'bg-surface-0 border-border text-ink-muted hover:text-ink',
          info: 'bg-surface-0 text-ink border-border',
          warning: 'bg-surface-0 text-ink border-status-warning/40 [&>[data-icon]]:text-status-warning',
          error: 'bg-surface-0 text-ink border-status-error/40 [&>[data-icon]]:text-status-error',
          success: 'bg-surface-0 text-ink border-status-success/40 [&>[data-icon]]:text-status-success',
          description: 'text-ink-muted',
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-surface-0)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

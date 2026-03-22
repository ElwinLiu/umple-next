import * as React from "react"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-ink-faint selection:bg-brand/20 flex h-8 w-full min-w-0 rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-xs text-ink outline-none transition-colors file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:opacity-50",
        "hover:bg-surface-1 focus:border-brand focus:ring-1 focus:ring-brand",
        className
      )}
      {...props}
    />
  )
}

export { Input }

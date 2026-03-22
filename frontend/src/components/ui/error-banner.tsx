import { cn } from '@/lib/utils'

interface ErrorBannerProps {
  children: React.ReactNode
  className?: string
}

export function ErrorBanner({ children, className }: ErrorBannerProps) {
  return (
    <div className={cn('px-3 py-2 bg-brand-light border border-status-error rounded text-status-error text-xs', className)}>
      {children}
    </div>
  )
}

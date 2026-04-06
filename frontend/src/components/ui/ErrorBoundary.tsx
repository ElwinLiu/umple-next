import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface-0 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-brand-light">
            <AlertCircle className="size-6 text-status-error" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Something went wrong</h2>
            <p className="mt-1 text-xs text-ink-muted">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <RotateCcw className="size-3" />
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface State {
  failed: boolean
}

/**
 * Catches render errors and failed route chunks (e.g. after a deploy) so one bad screen
 * never blanks the whole app. Only a generic message is shown; details go to the console.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error.message, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Card role="alert" className="max-w-xl gap-3 p-6">
        <div>
          <p className="text-base font-medium">Something went wrong on this page</p>
          <p className="mt-1 text-sm text-muted-foreground">Your data is safe. Reload to try again, or go back to the dashboard.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" asChild>
            <a href="/">Go to dashboard</a>
          </Button>
        </div>
      </Card>
    )
  }
}

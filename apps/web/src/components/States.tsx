import type { ReactNode } from 'react'
import { Button } from '@/components/ui/primitives'
import type { AsyncState } from '@/hooks/useAsync'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse py-10 text-center text-sm text-muted">
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** Renders loading / error / empty / data states for an async resource. */
export function AsyncBoundary<T>({
  state,
  isEmpty,
  empty,
  children,
}: {
  state: AsyncState<T>
  isEmpty?: (d: T) => boolean
  empty?: ReactNode
  children: (d: T) => ReactNode
}) {
  if (state.loading && state.data === undefined) return <Loading />
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />
  if (state.data === undefined) return null
  if (isEmpty?.(state.data)) return <>{empty}</>
  return <>{children(state.data)}</>
}

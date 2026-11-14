import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { AsyncState } from '@/hooks/useAsync'

export function Loading({ label = 'Loading', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-5" style={{ width: `${92 - i * 11}%` }} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-5">
      <div>
        <p className="text-sm font-medium">That didn&apos;t load</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 p-5">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Renders loading / error / empty / data states for an async resource. */
export function AsyncBoundary<T>({
  state,
  isEmpty,
  empty,
  loading,
  children,
}: {
  state: AsyncState<T>
  isEmpty?: (d: T) => boolean
  empty?: ReactNode
  loading?: ReactNode
  children: (d: T) => ReactNode
}) {
  if (state.loading && state.data === undefined) return <>{loading ?? <Loading />}</>
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />
  if (state.data === undefined) return null
  if (isEmpty?.(state.data)) return <>{empty}</>
  return <>{children(state.data)}</>
}

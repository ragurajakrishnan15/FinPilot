import { cn } from '@/lib/utils'

/**
 * The product's signature detail: a cockpit annunciator lamp. It is lit for as long as everything
 * here is simulated, and it is the only place the amber lamp colour appears outside warnings.
 */
export function Annunciator({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-lamp-soft px-2.5 text-xs font-medium text-lamp-ink',
        className,
      )}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-lamp shadow-[0_0_0_3px_var(--lamp-soft)]" />
      <span>Synthetic data · Payments are simulated</span>
    </div>
  )
}

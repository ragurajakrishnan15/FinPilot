import { X } from 'lucide-react'
import { Amount } from '@/components/Amount'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Payment } from '@/types/api'

/**
 * The receipt, built as a ticket stub: a perforated tear line with notches, set in mono.
 * It is the one rendered object on the payments screen, and it always carries the simulation stamp.
 */
export function ReceiptTicket({ payment, onDismiss, className }: { payment: Payment; onDismiss?: () => void; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Payment receipt"
      className={cn('relative w-full max-w-md rounded-xl border border-border bg-card text-card-foreground', className)}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-6">
        <div>
          <p className="text-sm text-muted-foreground">Payment executed</p>
          <p className="mt-1 text-3xl font-medium tracking-[-0.02em]">
            <Amount cents={payment.amount_minor} currency={payment.currency} />
          </p>
          <p className="mt-1 text-sm">to {payment.vendor_name}</p>
        </div>
        {onDismiss ? (
          <Button variant="ghost" size="icon" className="-mr-2 -mt-2" onClick={onDismiss} aria-label="Dismiss receipt">
            <X strokeWidth={1.5} className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* the tear line, with a notch cut into each edge */}
      <div aria-hidden className="relative h-0">
        <span className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border border-border bg-background" />
        <span className="absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full border border-border bg-background" />
        <div className="mx-5 border-t-2 border-dashed border-border" />
      </div>

      <div className="space-y-3 p-5 pt-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 font-mono text-xs">
          <dt className="text-muted-foreground">Receipt</dt>
          <dd className="break-all text-right">{payment.id}</dd>
          <dt className="text-muted-foreground">Executed</dt>
          <dd className="text-right">{new Date(payment.executed_at).toLocaleString()}</dd>
        </dl>
        <p className="rounded-md border border-lamp/60 bg-lamp-soft px-3 py-2 text-center text-xs font-medium text-lamp-ink">
          {payment.receipt_label}
        </p>
      </div>
    </div>
  )
}

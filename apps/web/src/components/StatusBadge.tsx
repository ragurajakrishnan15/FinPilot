import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'positive' | 'negative' | 'lamp'

const dot: Record<Tone, string> = {
  neutral: 'bg-chart-out',
  positive: 'bg-positive',
  negative: 'bg-negative',
  lamp: 'bg-lamp',
}

const map: Record<string, { label: string; tone: Tone }> = {
  // invoices
  draft: { label: 'Draft', tone: 'neutral' },
  unpaid: { label: 'Unpaid', tone: 'lamp' },
  paid: { label: 'Paid', tone: 'positive' },
  overdue: { label: 'Overdue', tone: 'negative' },
  // payment drafts
  pending_confirmation: { label: 'Awaiting confirmation', tone: 'lamp' },
  executed: { label: 'Executed', tone: 'positive' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'negative' },
  // audit events and tool calls
  succeeded: { label: 'Succeeded', tone: 'positive' },
  failed: { label: 'Failed', tone: 'negative' },
}

/** A status is always a dot plus a word, never colour alone. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = map[status] ?? { label: status, tone: 'neutral' as Tone }
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-normal text-foreground', className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', dot[m.tone])} />
      {m.label}
    </Badge>
  )
}

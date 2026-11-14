import type { ReactNode } from 'react'
import { Amount } from '@/components/Amount'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** A stat is a label, a figure and what it compares to. Nothing else. */
export function StatCard({ label, cents, note, tone }: { label: string; cents: number; note: ReactNode; tone?: 'positive' | 'negative' }) {
  return (
    <Card className="gap-1 px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-2xl font-medium tracking-[-0.02em]',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
        )}
      >
        <Amount cents={cents} />
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  )
}

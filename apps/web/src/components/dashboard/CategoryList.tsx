import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/States'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategoryPoint } from '@/types/api'

/** A ranked list with thin bars: a different kind of view from the main chart, not a second chart. */
export function CategoryList({ categories }: { categories: CategoryPoint[] }) {
  const top = categories[0]?.amount_minor ?? 0 // sorted descending; used only to scale bar widths
  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="border-b border-border py-4">
        <CardTitle className="text-sm font-medium">Where the money goes</CardTitle>
        <p className="text-xs text-muted-foreground">Expenses by category, last 6 months</p>
      </CardHeader>
      {categories.length === 0 ? (
        <EmptyState title="No expenses yet" />
      ) : (
        <ul className="flex flex-col gap-4 p-5" aria-label="Expenses by category">
          {categories.slice(0, 8).map((c) => (
            <li key={c.category}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{c.category}</span>
                <Amount cents={c.amount_minor} className="text-muted-foreground" />
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-muted" aria-hidden>
                <div
                  className="h-1 rounded-full bg-foreground/80"
                  style={{ width: `${Math.max(2, top > 0 ? (c.amount_minor / top) * 100 : 0)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

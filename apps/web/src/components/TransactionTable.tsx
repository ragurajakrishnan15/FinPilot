import { Amount } from '@/components/Amount'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/money'
import type { Transaction } from '@/types/api'

// On narrow screens the category folds under the description so the amount is never clipped.
export function TransactionTable({ items, onSelect }: { items: Transaction[]; onSelect?: (t: Transaction) => void }) {
  return (
    <Table>
      <caption className="sr-only">Transactions</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="hidden sm:table-cell">Category</TableHead>
          <TableHead className="pr-5 text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => (
          <TableRow key={t.id} className={onSelect ? 'cursor-pointer' : undefined} onClick={onSelect ? () => onSelect(t) : undefined}>
            <TableCell className="whitespace-nowrap pl-5 align-top text-muted-foreground">{formatDate(t.date)}</TableCell>
            <TableCell className="whitespace-normal align-top">
              {onSelect ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(t)
                  }}
                  className="rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t.description}
                </button>
              ) : (
                t.description
              )}
              <span className="mt-1 block sm:hidden">
                <Badge variant="secondary" className="font-normal">
                  {t.category}
                </Badge>
              </span>
            </TableCell>
            <TableCell className="hidden align-top sm:table-cell">
              <Badge variant="secondary" className="font-normal">
                {t.category}
              </Badge>
            </TableCell>
            <TableCell className="pr-5 text-right align-top">
              <Amount cents={t.amount_minor} currency={t.currency} direction={t.type} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

import { Badge } from '@/components/ui/primitives'
import { formatDate, formatMoney } from '@/lib/money'
import type { Transaction } from '@/types/api'

// On narrow screens the Category column folds under the description so Amount is never clipped.
export function TransactionTable({ items }: { items: Transaction[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Transactions</caption>
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium sm:px-4">
              Date
            </th>
            <th scope="col" className="px-3 py-2 font-medium sm:px-4">
              Description
            </th>
            <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">
              Category
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium sm:px-4">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-t border-border align-top">
              <td className="px-3 py-2 sm:whitespace-nowrap sm:px-4">{formatDate(t.date)}</td>
              <td className="px-3 py-2 sm:px-4">
                {t.description}
                <span className="mt-1 block sm:hidden">
                  <Badge>{t.category}</Badge>
                </span>
              </td>
              <td className="hidden px-4 py-2 sm:table-cell">
                <Badge>{t.category}</Badge>
              </td>
              <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums sm:px-4 ${t.type === 'inflow' ? 'text-ok' : ''}`}>
                {t.type === 'inflow' ? '+' : '-'}
                {formatMoney(t.amount_minor, t.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

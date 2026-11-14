import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { TxnType } from '@/types/api'

/** Money from integer cents, one format everywhere (cents always shown), tabular so columns align. */
export function Amount({
  cents,
  currency = 'USD',
  direction,
  className,
}: {
  cents: number
  currency?: string
  direction?: TxnType
  className?: string
}) {
  const sign = direction === 'inflow' ? '+' : direction === 'outflow' ? '-' : ''
  return (
    <span
      className={cn('num whitespace-nowrap', direction === 'inflow' && 'text-positive', className)}
    >{`${sign}${formatMoney(cents, currency)}`}</span>
  )
}

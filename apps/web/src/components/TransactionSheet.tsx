import { Link } from 'react-router-dom'
import { Amount } from '@/components/Amount'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDate } from '@/lib/money'
import type { Transaction } from '@/types/api'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

export function TransactionSheet({ txn, onClose }: { txn: Transaction | undefined; onClose: () => void }) {
  return (
    <Sheet open={txn !== undefined} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {txn ? (
          <>
            <SheetHeader className="p-6 pb-4">
              <SheetDescription>{txn.type === 'inflow' ? 'Money in' : 'Money out'}</SheetDescription>
              <SheetTitle className="text-3xl font-medium tracking-[-0.02em]">
                <Amount cents={txn.amount_minor} currency={txn.currency} direction={txn.type} />
              </SheetTitle>
              <p className="text-sm">{txn.description}</p>
            </SheetHeader>
            <Separator />
            <dl className="divide-y divide-border px-6">
              <Row label="Date">{formatDate(txn.date)}</Row>
              <Row label="Category">
                <Badge variant="secondary" className="font-normal">
                  {txn.category}
                </Badge>
              </Row>
              <Row label="Vendor">
                {txn.vendor_id ? (
                  <Link to={`/vendors/${txn.vendor_id}`} className="text-signal-ink underline-offset-4 hover:underline" onClick={onClose}>
                    {txn.vendor_name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">None (customer payment)</span>
                )}
              </Row>
              <Row label="Account">
                <span className="font-mono text-xs">{txn.account_id}</span>
              </Row>
              <Row label="Transaction ID">
                <span className="break-all font-mono text-xs">{txn.id}</span>
              </Row>
            </dl>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

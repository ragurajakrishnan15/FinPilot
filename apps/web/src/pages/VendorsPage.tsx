import { Link, useParams } from 'react-router-dom'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { TransactionTable } from '@/components/TransactionTable'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { formatMoney } from '@/lib/money'
import { api } from '@/services/api'

export function VendorsPage() {
  const state = useAsync(() => api.getVendors())
  return (
    <>
      <PageHeader title="Vendors" description="Fictional suppliers and their spend totals." />
      <AsyncBoundary state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No vendors yet" />}>
        {(vendors) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => (
              <Link key={v.id} to={`/vendors/${v.id}`}>
                <Card className="h-full p-4 hover:border-brand">
                  <p className="font-medium">{v.name}</p>
                  <Badge className="mt-1">{v.category}</Badge>
                  <p className="mt-3 text-lg font-semibold tabular-nums">{formatMoney(v.total_spend_minor)}</p>
                  <p className="text-xs text-muted">{v.transaction_count} transactions</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </>
  )
}

export function VendorDetailPage() {
  const { id = '' } = useParams()
  const state = useAsync(() => api.getVendor(id), [id])
  return (
    <>
      <p className="mb-2 text-sm">
        <Link to="/vendors" className="text-brand">
          ← All vendors
        </Link>
      </p>
      <AsyncBoundary state={state}>
        {({ vendor, transactions }) => (
          <>
            <PageHeader title={vendor.name} description={`${vendor.category} · ${vendor.contact_email} · ${vendor.contact_phone}`} />
            <Card className="mb-4 p-4">
              <p className="text-xs text-muted">Total spend</p>
              <p className="text-2xl font-semibold tabular-nums">{formatMoney(vendor.total_spend_minor)}</p>
            </Card>
            <Card>
              <CardHeader title="Transaction history" />
              {transactions.length === 0 ? (
                <EmptyState title="No transactions for this vendor" />
              ) : (
                <TransactionTable items={transactions} />
              )}
            </Card>
          </>
        )}
      </AsyncBoundary>
    </>
  )
}

import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Amount } from '@/components/Amount'
import { PageHeader } from '@/components/PageHeader'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { TransactionSheet } from '@/components/TransactionSheet'
import { TransactionTable } from '@/components/TransactionTable'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAsync } from '@/hooks/useAsync'
import { api } from '@/services/api'
import type { Transaction } from '@/types/api'

export function VendorsPage() {
  const state = useAsync(() => api.getVendors())
  return (
    <>
      <PageHeader title="Vendors" description="Suppliers you pay, with what you have spent on each." />
      <Card className="gap-0 overflow-hidden py-0">
        <AsyncBoundary state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No vendors yet" />}>
          {(vendors) => (
            <Table>
              <caption className="sr-only">Vendors</caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Vendor</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Payments</TableHead>
                  <TableHead className="pr-5 text-right">Total spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...vendors]
                  .sort((a, b) => b.total_spend_minor - a.total_spend_minor)
                  .map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="pl-5">
                        <Link to={`/vendors/${v.id}`} className="font-medium underline-offset-4 hover:underline">
                          {v.name}
                        </Link>
                        <span className="mt-1 block text-xs text-muted-foreground sm:hidden">{v.category}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className="font-normal">
                          {v.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{v.contact_email}</TableCell>
                      <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">{v.transaction_count}</TableCell>
                      <TableCell className="pr-5 text-right">
                        <Amount cents={v.total_spend_minor} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </AsyncBoundary>
      </Card>
    </>
  )
}

export function VendorDetailPage() {
  const { id = '' } = useParams()
  const state = useAsync(() => api.getVendor(id), [id])
  const [selected, setSelected] = useState<Transaction>()
  return (
    <>
      <Link to="/vendors" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft strokeWidth={1.5} className="size-4" />
        All vendors
      </Link>
      <AsyncBoundary state={state}>
        {({ vendor, transactions }) => (
          <>
            <PageHeader
              title={vendor.name}
              description={
                <>
                  {vendor.category} · {vendor.contact_email} · <span className="font-mono text-xs">{vendor.contact_phone}</span>
                </>
              }
            />
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Card className="gap-1 px-5 py-4">
                <p className="text-sm text-muted-foreground">Total spend</p>
                <p className="text-2xl font-medium tracking-[-0.02em]">
                  <Amount cents={vendor.total_spend_minor} />
                </p>
                <p className="text-xs text-muted-foreground">All time</p>
              </Card>
              <Card className="gap-1 px-5 py-4">
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="num text-2xl font-medium tracking-[-0.02em]">{vendor.transaction_count}</p>
                <p className="text-xs text-muted-foreground">Payments to this vendor</p>
              </Card>
            </div>
            <Card className="gap-0 overflow-hidden py-0">
              {transactions.length === 0 ? (
                <EmptyState title="No transactions for this vendor" />
              ) : (
                <TransactionTable items={transactions} onSelect={setSelected} />
              )}
            </Card>
            <TransactionSheet txn={selected} onClose={() => setSelected(undefined)} />
          </>
        )}
      </AsyncBoundary>
    </>
  )
}

import { useState } from 'react'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { TransactionTable } from '@/components/TransactionTable'
import { Button, Card, Field, Input, PageHeader, Select } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { parseMoneyToCents } from '@/lib/money'
import { api } from '@/services/api'
import { toCsv } from '@/lib/csv'
import type { Transaction, TransactionQuery, TxnType } from '@/types/api'

const PAGE_SIZE = 10

export default function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TxnType | ''>('')
  const [category, setCategory] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const minC = min ? parseMoneyToCents(min) : null
  const maxC = max ? parseMoneyToCents(max) : null
  const minErr = min && minC === null ? 'Enter a valid amount' : undefined
  const maxErr = max && maxC === null ? 'Enter a valid amount' : undefined

  const query: TransactionQuery = {
    search,
    type,
    category,
    from: from || undefined,
    to: to || undefined,
    min_minor: minC ?? undefined,
    max_minor: maxC ?? undefined,
    page,
    page_size: PAGE_SIZE,
  }
  const cats = useAsync(() => api.getCategories())
  const state = useAsync(() => api.getTransactions(query), [search, type, category, min, max, from, to, page])

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }

  async function exportCsv() {
    // The API caps page_size at 100, so export by paging (bounded to 50 pages = 5,000 rows).
    const rows: Transaction[] = []
    for (let p = 1; p <= 50; p++) {
      const res = await api.getTransactions({ ...query, page: p, page_size: 100 })
      rows.push(...res.items)
      if (rows.length >= res.total) break
    }
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'finpilot-synthetic-transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search and filter synthetic transactions."
        action={
          <Button variant="outline" onClick={() => void exportCsv()}>
            Export CSV
          </Button>
        }
      />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search" htmlFor="f-search">
          <Input id="f-search" value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Description or vendor" />
        </Field>
        <Field label="Type" htmlFor="f-type">
          <Select id="f-type" value={type} onChange={(e) => reset(setType)(e.target.value as TxnType | '')}>
            <option value="">All</option>
            <option value="inflow">Inflow</option>
            <option value="outflow">Outflow</option>
          </Select>
        </Field>
        <Field label="Category" htmlFor="f-cat">
          <Select id="f-cat" value={category} onChange={(e) => reset(setCategory)(e.target.value)}>
            <option value="">All</option>
            {cats.data?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <div />
        <Field label="Min amount ($)" htmlFor="f-min" error={minErr}>
          <Input id="f-min" inputMode="decimal" value={min} onChange={(e) => reset(setMin)(e.target.value)} />
        </Field>
        <Field label="Max amount ($)" htmlFor="f-max" error={maxErr}>
          <Input id="f-max" inputMode="decimal" value={max} onChange={(e) => reset(setMax)(e.target.value)} />
        </Field>
        <Field label="From" htmlFor="f-from">
          <Input id="f-from" type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="f-to">
          <Input id="f-to" type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        </Field>
      </Card>
      <Card>
        <AsyncBoundary
          state={state}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState title="No transactions match your filters" hint="Try clearing a filter." />}
        >
          {(d) => (
            <>
              <TransactionTable items={d.items} />
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <span className="text-muted">
                  {d.total} results · page {d.page} of {Math.max(1, Math.ceil(d.total / d.page_size))}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= d.total} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </AsyncBoundary>
      </Card>
    </>
  )
}

import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { TransactionSheet } from '@/components/TransactionSheet'
import { TransactionTable } from '@/components/TransactionTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { toCsv } from '@/lib/csv'
import { parseMoneyToCents } from '@/lib/money'
import { api } from '@/services/api'
import type { Transaction, TransactionQuery, TxnType } from '@/types/api'

const PAGE_SIZE = 10
const ALL = 'all'

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TxnType | ''>('')
  const [category, setCategory] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Transaction>()
  const [exporting, setExporting] = useState(false)

  const debouncedSearch = useDebounced(search)
  const minC = min ? parseMoneyToCents(min) : null
  const maxC = max ? parseMoneyToCents(max) : null
  const minErr = min && minC === null ? 'Enter an amount like 100 or 99.50' : undefined
  const maxErr = max && maxC === null ? 'Enter an amount like 100 or 99.50' : undefined
  const active = Boolean(search || type || category || min || max || from || to)

  const query: TransactionQuery = {
    search: debouncedSearch,
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
  const state = useAsync(() => api.getTransactions(query), [debouncedSearch, type, category, min, max, from, to, page])

  // Changing any filter returns to the first page.
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }

  function clear() {
    setSearch('')
    setType('')
    setCategory('')
    setMin('')
    setMax('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  async function exportCsv() {
    setExporting(true)
    try {
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
      toast.success(`Exported ${rows.length} transactions`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every inflow and outflow in the workspace. Select a row for its details."
        action={
          <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
            <Download strokeWidth={1.5} className="size-4" />
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="f-search">
            <Input id="f-search" value={search} onChange={(e) => filter(setSearch)(e.target.value)} placeholder="Description or vendor" />
          </Field>
          <Field label="Type" htmlFor="f-type">
            <Select value={type || ALL} onValueChange={(v) => filter(setType)(v === ALL ? '' : (v as TxnType))}>
              <SelectTrigger id="f-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                <SelectItem value="inflow">Money in</SelectItem>
                <SelectItem value="outflow">Money out</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category" htmlFor="f-cat">
            <Select value={category || ALL} onValueChange={(v) => filter(setCategory)(v === ALL ? '' : v)}>
              <SelectTrigger id="f-cat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {cats.data?.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="hidden lg:block" />
          <Field label="Min amount" htmlFor="f-min" error={minErr}>
            <Input id="f-min" inputMode="decimal" value={min} onChange={(e) => filter(setMin)(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Max amount" htmlFor="f-max" error={maxErr}>
            <Input id="f-max" inputMode="decimal" value={max} onChange={(e) => filter(setMax)(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="From" htmlFor="f-from">
            <Input id="f-from" type="date" value={from} onChange={(e) => filter(setFrom)(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="f-to">
            <Input id="f-to" type="date" value={to} onChange={(e) => filter(setTo)(e.target.value)} />
          </Field>
        </div>
        {active ? (
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={clear}>
              <X strokeWidth={1.5} className="size-4" />
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <AsyncBoundary
          state={state}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              title="No transactions match"
              hint="Loosen or clear a filter to see more."
              action={
                <Button variant="outline" size="sm" onClick={clear}>
                  Clear filters
                </Button>
              }
            />
          }
        >
          {(d) => (
            <>
              <TransactionTable items={d.items} onSelect={setSelected} />
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm">
                <span className="text-muted-foreground">
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

      <TransactionSheet txn={selected} onClose={() => setSelected(undefined)} />
    </>
  )
}

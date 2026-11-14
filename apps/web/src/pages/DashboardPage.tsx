import { Link } from 'react-router-dom'
import { Amount } from '@/components/Amount'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { CategoryList } from '@/components/dashboard/CategoryList'
import { StatCard } from '@/components/dashboard/StatCard'
import { PageHeader } from '@/components/PageHeader'
import { AsyncBoundary, EmptyState, Loading } from '@/components/States'
import { StatusBadge } from '@/components/StatusBadge'
import { TransactionTable } from '@/components/TransactionTable'
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { monthLong, monthName } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/money'
import { api } from '@/services/api'
import type { Invoice } from '@/types/api'

function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="text-sm text-signal-ink underline-offset-4 hover:underline">
      {label}
    </Link>
  )
}

function DueInvoices({ invoices }: { invoices: Invoice[] }) {
  const open = invoices
    .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)
  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="border-b border-border py-4">
        <CardTitle className="text-sm font-medium">Invoices to settle</CardTitle>
        <CardAction>
          <ViewAll to="/invoices" label="View all" />
        </CardAction>
      </CardHeader>
      {open.length === 0 ? (
        <EmptyState title="Nothing to settle" hint="Unpaid and overdue invoices show up here." />
      ) : (
        <ul className="divide-y divide-border">
          {open.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{i.vendor_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{i.number}</span> · due {formatDate(i.due_date)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Amount cents={i.amount_minor} currency={i.currency} className="text-sm" />
                <StatusBadge status={i.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[372px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[372px] rounded-xl" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const state = useAsync(() => api.getDashboard())
  const accounts = useAsync(() => api.getAccounts())
  const invoices = useAsync(() => api.getInvoices())

  return (
    <AsyncBoundary state={state} loading={<DashboardSkeleton />}>
      {(d) => {
        const latest = d.monthly[d.monthly.length - 1]
        const prev = d.monthly[d.monthly.length - 2]
        const prevName = prev ? monthName(prev.month) : undefined
        const vs = (cents: number | undefined) =>
          prevName && cents !== undefined ? `${formatMoney(cents)} in ${prevName}` : 'First month on record'
        return (
          <>
            <PageHeader
              title={latest ? monthLong(latest.month) : 'Dashboard'}
              description="Month to date, shown against the previous full month."
            />
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total balance"
                  cents={d.total_balance_minor}
                  note={accounts.data ? `Across ${accounts.data.length} accounts` : 'All accounts'}
                />
                <StatCard label="Money in" cents={d.month_income_minor} tone="positive" note={vs(prev?.inflow_minor)} />
                <StatCard label="Money out" cents={d.month_expense_minor} note={vs(prev?.outflow_minor)} />
                <StatCard
                  label="Net cash flow"
                  cents={d.month_net_minor}
                  tone={d.month_net_minor >= 0 ? 'positive' : 'negative'}
                  note={prev ? vs(prev.inflow_minor - prev.outflow_minor) : 'First month on record'}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 [&>*]:h-full">
                  <CashFlowChart monthly={d.monthly} />
                </div>
                <CategoryList categories={d.categories} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="h-full gap-0 overflow-hidden py-0 lg:col-span-2">
                  <CardHeader className="border-b border-border py-4">
                    <CardTitle className="text-sm font-medium">Recent transactions</CardTitle>
                    <CardAction>
                      <ViewAll to="/transactions" label="View all" />
                    </CardAction>
                  </CardHeader>
                  {d.recent.length === 0 ? <EmptyState title="No transactions yet" /> : <TransactionTable items={d.recent} />}
                </Card>
                <AsyncBoundary
                  state={invoices}
                  loading={
                    <Card>
                      <Loading label="Loading invoices" rows={3} />
                    </Card>
                  }
                >
                  {(list) => <DueInvoices invoices={list} />}
                </AsyncBoundary>
              </div>
            </div>
          </>
        )
      }}
    </AsyncBoundary>
  )
}

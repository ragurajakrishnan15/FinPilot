import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { TransactionTable } from '@/components/TransactionTable'
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { formatMoney } from '@/lib/money'
import { api } from '@/services/api'

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'danger' }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : ''}`}>
        {formatMoney(value)}
      </p>
    </Card>
  )
}

export default function DashboardPage() {
  const state = useAsync(() => api.getDashboard())
  return (
    <>
      <PageHeader title="Dashboard" description="Synthetic financial overview for the demo workspace." />
      <AsyncBoundary state={state}>
        {(d) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total balance" value={d.total_balance_minor} />
              <Stat label="Income (this month)" value={d.month_income_minor} tone="ok" />
              <Stat label="Expenses (this month)" value={d.month_expense_minor} />
              <Stat label="Net cash flow" value={d.month_net_minor} tone={d.month_net_minor >= 0 ? 'ok' : 'danger'} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader title="Monthly inflow vs outflow" />
                <div className="h-72 p-4" role="img" aria-label="Bar chart of monthly inflow and outflow">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={d.monthly.map((m) => ({ month: m.month, Inflow: m.inflow_minor / 100, Outflow: m.outflow_minor / 100 }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" stroke="var(--color-muted)" fontSize={12} />
                      <YAxis stroke="var(--color-muted)" fontSize={12} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v) => formatMoney(Math.round(Number(v) * 100))} />
                      <Legend />
                      <Bar dataKey="Inflow" fill="#0f766e" isAnimationActive={false} />
                      <Bar dataKey="Outflow" fill="#b54708" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardHeader title="Expenses by category" />
                {d.categories.length === 0 ? (
                  <EmptyState title="No expenses yet" />
                ) : (
                  <ul className="space-y-3 p-4" aria-label="Expenses by category, last 6 months">
                    {d.categories.slice(0, 8).map((c) => {
                      const top = d.categories[0].amount_minor // list is sorted descending; used only for bar width
                      return (
                        <li key={c.category}>
                          <div className="flex justify-between gap-2 text-sm">
                            <span>{c.category}</span>
                            <span className="tabular-nums">{formatMoney(c.amount_minor)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded bg-bg" aria-hidden>
                            <div className="h-2 rounded bg-brand" style={{ width: `${Math.max(2, (c.amount_minor / top) * 100)}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            </div>
            <Card>
              <CardHeader
                title="Recent transactions"
                action={
                  <Link to="/transactions" className="text-sm text-brand">
                    View all
                  </Link>
                }
              />
              {d.recent.length === 0 ? <EmptyState title="No transactions yet" /> : <TransactionTable items={d.recent} />}
            </Card>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link to="/command" className="text-brand">
                Ask the Command Center →
              </Link>
              <Link to="/invoices" className="text-brand">
                Invoices →
              </Link>
              <Link to="/payments" className="text-brand">
                Payments →
              </Link>
            </div>
          </div>
        )}
      </AsyncBoundary>
    </>
  )
}

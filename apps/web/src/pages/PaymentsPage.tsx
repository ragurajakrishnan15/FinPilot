import { useState, type FormEvent } from 'react'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatMoney, parseMoneyToCents } from '@/lib/money'
import { api } from '@/services/api'
import type { Payment, PaymentDraft } from '@/types/api'

const statusTone = { pending_confirmation: 'warn', executed: 'ok', cancelled: 'neutral', rejected: 'danger' } as const

function Receipt({ p }: { p: Payment }) {
  return (
    <div role="status" className="rounded-md border-2 border-warn p-4 text-sm">
      <p className="font-semibold text-warn">{p.receipt_label}</p>
      <p className="mt-1">
        {formatMoney(p.amount_minor, p.currency)} to {p.vendor_name}
      </p>
      <p className="text-muted">
        Receipt {p.id} · {new Date(p.executed_at).toLocaleString()}
      </p>
    </div>
  )
}

export default function PaymentsPage() {
  const drafts = useAsync(() => api.getDrafts())
  const payments = useAsync(() => api.getPayments())
  const vendors = useAsync(() => api.getVendors())
  const accounts = useAsync(() => api.getAccounts())
  const [vendorId, setVendorId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [receipt, setReceipt] = useState<Payment>()
  const [actionError, setActionError] = useState<string>()
  const [busy, setBusy] = useState<string>()
  // One idempotency key per draft so a double click cannot execute twice.
  const [keys] = useState(() => new Map<string, string>())

  function refresh() {
    drafts.reload()
    payments.reload()
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const cents = parseMoneyToCents(amount)
    if (!vendorId) errs.vendor = 'Choose a payee'
    if (!accountId) errs.account = 'Choose a source account'
    if (cents === null || cents <= 0) errs.amount = 'Enter an amount greater than zero'
    setErrors(errs)
    if (Object.keys(errs).length || cents === null) return
    try {
      await api.createPaymentDraft({ vendor_id: vendorId, amount_minor: cents, source_account_id: accountId, memo })
      setAmount('')
      setMemo('')
      refresh()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not create draft' })
    }
  }

  async function confirm(d: PaymentDraft) {
    setBusy(d.id)
    setActionError(undefined)
    let key = keys.get(d.id)
    if (!key) {
      key = crypto.randomUUID()
      keys.set(d.id, key)
    }
    try {
      setReceipt(await api.confirmPaymentDraft(d.id, key))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Confirmation failed')
    } finally {
      setBusy(undefined)
      refresh()
    }
  }

  async function cancel(d: PaymentDraft) {
    setBusy(d.id)
    setActionError(undefined)
    try {
      await api.cancelPaymentDraft(d.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setBusy(undefined)
      refresh()
    }
  }

  return (
    <>
      <PageHeader title="Payments" description="Create a draft, review it, then explicitly confirm. All payments are simulated." />
      {receipt && (
        <div className="mb-4">
          <Receipt p={receipt} />
        </div>
      )}
      {actionError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      )}

      <Card className="mb-4">
        <CardHeader title="New payment draft" />
        <form onSubmit={(e) => void create(e)} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" noValidate>
          <Field label="Payee" htmlFor="pay-vendor" error={errors.vendor}>
            <Select id="pay-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select…</option>
              {vendors.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source account" htmlFor="pay-account" error={errors.account}>
            <Select id="pay-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.data
                ?.filter((a) => a.kind !== 'credit')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Amount ($)" htmlFor="pay-amount" error={errors.amount}>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Memo" htmlFor="pay-memo">
            <Input id="pay-memo" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Create draft</Button>
          </div>
          {errors.form && (
            <p role="alert" className="text-sm text-danger sm:col-span-full">
              {errors.form}
            </p>
          )}
        </form>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Drafts" />
        <AsyncBoundary
          state={drafts}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="No payment drafts" hint="Create one above or ask the Command Center." />}
        >
          {(list) => (
            <ul>
              {list.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm first:border-t-0"
                >
                  <div>
                    <p className="font-medium">
                      {formatMoney(d.amount_minor, d.currency)} → {d.vendor_name}
                    </p>
                    <p className="text-xs text-muted">
                      From {d.source_account_name} · {formatDate(d.execution_date)} · {d.memo || 'No memo'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[d.status]}>{d.status.replace('_', ' ')}</Badge>
                    {d.status === 'pending_confirmation' && (
                      <>
                        <Button size="sm" disabled={busy === d.id} onClick={() => void confirm(d)}>
                          Confirm payment
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => void cancel(d)}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </Card>

      <Card>
        <CardHeader title="Executed payments (simulated)" />
        <AsyncBoundary state={payments} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No payments yet" />}>
          {(list) => (
            <ul>
              {list.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3 text-sm first:border-t-0">
                  <span>
                    {formatMoney(p.amount_minor, p.currency)} → {p.vendor_name}
                  </span>
                  <span className="text-xs text-muted">
                    {p.receipt_label} · {new Date(p.executed_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </Card>
    </>
  )
}

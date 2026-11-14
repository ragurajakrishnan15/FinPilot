import { useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Amount } from '@/components/Amount'
import { PageHeader } from '@/components/PageHeader'
import { ConfirmDialog } from '@/components/payments/ConfirmDialog'
import { ReceiptTicket } from '@/components/payments/ReceiptTicket'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAsync } from '@/hooks/useAsync'
import { centsToDecimal, formatDate, parseMoneyToCents } from '@/lib/money'
import { api } from '@/services/api'
import type { Payment, PaymentDraft } from '@/types/api'

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null
}

function DraftRow({ draft, onReview, onCancel, busy }: { draft: PaymentDraft; onReview: () => void; onCancel: () => void; busy: boolean }) {
  const pending = draft.status === 'pending_confirmation'
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0">
        <p className="flex items-baseline gap-3">
          <Amount cents={draft.amount_minor} currency={draft.currency} className="text-lg font-medium tracking-[-0.01em]" />
          <span className="truncate text-sm">to {draft.vendor_name}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          From {draft.source_account_name} · {formatDate(draft.execution_date)} · {draft.memo || 'No memo'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={draft.status} />
        {pending ? (
          <>
            <Button size="sm" disabled={busy} onClick={onReview}>
              Review and confirm
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          </>
        ) : null}
      </div>
    </li>
  )
}

export default function PaymentsPage() {
  const drafts = useAsync(() => api.getDrafts())
  const payments = useAsync(() => api.getPayments())
  const vendors = useAsync(() => api.getVendors())
  const accounts = useAsync(() => api.getAccounts())

  // Arriving from an invoice or an account pre-fills the form. The user still reviews it and
  // confirms separately: a prefill only ever helps create a draft.
  const prefill = (useLocation().state ?? {}) as { vendorId?: string; amountMinor?: number; memo?: string; accountId?: string }
  const [vendorId, setVendorId] = useState(prefill.vendorId ?? '')
  const [pickedAccountId, setAccountId] = useState(prefill.accountId ?? '')
  const [amount, setAmount] = useState(prefill.amountMinor ? centsToDecimal(prefill.amountMinor) : '')
  const [memo, setMemo] = useState(prefill.memo ?? '')
  // Default to the first account a payment can be drawn from; the select shows it, so nothing is hidden.
  const accountId = pickedAccountId || (accounts.data?.find((a) => a.kind !== 'credit')?.id ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [reviewing, setReviewing] = useState<PaymentDraft>()
  const [confirming, setConfirming] = useState(false)
  const [busyId, setBusyId] = useState<string>()
  const [receipt, setReceipt] = useState<Payment>()
  const [actionError, setActionError] = useState<string>()
  // One idempotency key per draft: a double click or a retry can never execute the payment twice.
  const keys = useRef(new Map<string, string>())

  const refresh = () => {
    drafts.reload()
    payments.reload()
    accounts.reload()
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
    setCreating(true)
    try {
      await api.createPaymentDraft({ vendor_id: vendorId, amount_minor: cents, source_account_id: accountId, memo })
      setAmount('')
      setMemo('')
      toast.success('Draft created. Nothing is paid until you confirm it.')
      refresh()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not create the draft' })
    } finally {
      setCreating(false)
    }
  }

  async function confirm(d: PaymentDraft) {
    setConfirming(true)
    setActionError(undefined)
    let key = keys.current.get(d.id)
    if (!key) {
      key = crypto.randomUUID()
      keys.current.set(d.id, key)
    }
    try {
      setReceipt(await api.confirmPaymentDraft(d.id, key))
      toast.success('Payment executed (simulated)')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Confirmation failed'
      setActionError(message)
      toast.error(message)
    } finally {
      setConfirming(false)
      setReviewing(undefined)
      refresh()
    }
  }

  async function cancel(d: PaymentDraft) {
    setBusyId(d.id)
    setActionError(undefined)
    try {
      await api.cancelPaymentDraft(d.id)
      toast('Draft cancelled')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancel failed'
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyId(undefined)
      refresh()
    }
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Prepare a draft, read it back, then confirm it yourself. Every payment here is simulated."
      />

      {actionError ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-sm font-medium">Prepare a payment</CardTitle>
            <CardDescription>Creates a draft. It does not move anything.</CardDescription>
          </CardHeader>
          <form onSubmit={(e) => void create(e)} noValidate className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-vendor">Payee</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger id="pay-vendor" className="w-full" aria-invalid={Boolean(errors.vendor)}>
                  <SelectValue placeholder="Choose a payee" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.data?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.vendor} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-account">Pay from</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="pay-account" className="w-full" aria-invalid={Boolean(errors.account)}>
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.data
                    ?.filter((a) => a.kind !== 'credit')
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.account} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-amount">Amount (USD)</Label>
              <Input
                id="pay-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={Boolean(errors.amount)}
              />
              <FieldError message={errors.amount} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="pay-memo">Memo</Label>
                <span className="num text-xs text-muted-foreground">{memo.length}/140</span>
              </div>
              <Input id="pay-memo" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            <FieldError message={errors.form} />
            <Button type="submit" disabled={creating}>
              Create draft
            </Button>
          </form>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {receipt ? <ReceiptTicket payment={receipt} onDismiss={() => setReceipt(undefined)} /> : null}

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            </CardHeader>
            <AsyncBoundary
              state={drafts}
              isEmpty={(d) => d.length === 0}
              empty={<EmptyState title="No drafts yet" hint="Prepare one on the left, or ask the Command Center to." />}
            >
              {(list) => (
                <ul className="divide-y divide-border">
                  {list.map((d) => (
                    <DraftRow
                      key={d.id}
                      draft={d}
                      busy={busyId === d.id || confirming}
                      onReview={() => setReviewing(d)}
                      onCancel={() => void cancel(d)}
                    />
                  ))}
                </ul>
              )}
            </AsyncBoundary>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-sm font-medium">Executed payments</CardTitle>
              <CardDescription>Simulated. No money moved.</CardDescription>
            </CardHeader>
            <AsyncBoundary state={payments} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No payments yet" />}>
              {(list) => (
                <Table>
                  <caption className="sr-only">Executed payments</caption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">Payee</TableHead>
                      <TableHead className="hidden sm:table-cell">Receipt</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead className="pr-5 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-5">{p.vendor_name}</TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{p.id.slice(0, 8)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(p.executed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Amount cents={p.amount_minor} currency={p.currency} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AsyncBoundary>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        draft={reviewing}
        account={accounts.data?.find((a) => a.id === reviewing?.source_account_id)}
        busy={confirming}
        onConfirm={(d) => void confirm(d)}
        onClose={() => setReviewing(undefined)}
      />
    </>
  )
}

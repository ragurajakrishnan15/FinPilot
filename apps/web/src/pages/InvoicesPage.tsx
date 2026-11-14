import { useState, type FormEvent } from 'react'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatMoney, parseMoneyToCents } from '@/lib/money'
import { api } from '@/services/api'
import type { Invoice, InvoiceStatus } from '@/types/api'

const tone: Record<InvoiceStatus, 'neutral' | 'warn' | 'ok' | 'danger'> = {
  draft: 'neutral',
  unpaid: 'warn',
  paid: 'ok',
  overdue: 'danger',
}

export default function InvoicesPage() {
  const invoices = useAsync(() => api.getInvoices())
  const vendors = useAsync(() => api.getVendors())
  const [filter, setFilter] = useState<InvoiceStatus | ''>('')
  const [vendorId, setVendorId] = useState('')
  const [amount, setAmount] = useState('')
  const [due, setDue] = useState('')
  const [status, setStatus] = useState<InvoiceStatus>('draft')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState<string>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSuccess(undefined)
    const errs: Record<string, string> = {}
    const cents = parseMoneyToCents(amount)
    if (!vendorId) errs.vendor = 'Choose a vendor'
    if (cents === null || cents <= 0) errs.amount = 'Enter an amount greater than zero'
    if (!due) errs.due = 'Choose a due date'
    setErrors(errs)
    if (Object.keys(errs).length || cents === null) return
    try {
      const inv = await api.createInvoice({ vendor_id: vendorId, amount_minor: cents, due_date: due, status })
      setSuccess(`Created ${inv.number}`)
      setAmount('')
      setDue('')
      invoices.reload()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not create invoice' })
    }
  }

  const visible = (list: Invoice[]) => list.filter((i) => !filter || i.status === filter)

  return (
    <>
      <PageHeader title="Invoices" description="Synthetic invoices. No emails are sent and no real payments are made." />
      <Card className="mb-4">
        <CardHeader title="Create invoice" />
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" noValidate>
          <Field label="Vendor" htmlFor="inv-vendor" error={errors.vendor}>
            <Select id="inv-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select…</option>
              {vendors.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount ($)" htmlFor="inv-amount" error={errors.amount}>
            <Input id="inv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Due date" htmlFor="inv-due" error={errors.due}>
            <Input id="inv-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="inv-status">
            <Select id="inv-status" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
              <option value="draft">Draft</option>
              <option value="unpaid">Unpaid</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit">Create</Button>
          </div>
          {errors.form && (
            <p role="alert" className="text-sm text-danger sm:col-span-full">
              {errors.form}
            </p>
          )}
          {success && (
            <p role="status" className="text-sm text-ok sm:col-span-full">
              {success}
            </p>
          )}
        </form>
      </Card>
      <Card>
        <CardHeader
          title="All invoices"
          action={
            <>
              <label htmlFor="inv-filter" className="sr-only">
                Filter by status
              </label>
              <Select id="inv-filter" className="h-8 w-36" value={filter} onChange={(e) => setFilter(e.target.value as InvoiceStatus | '')}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </Select>
            </>
          }
        />
        <AsyncBoundary state={invoices} isEmpty={(d) => visible(d).length === 0} empty={<EmptyState title="No invoices match" />}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Number
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Vendor
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Due
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible(list).map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-2">{i.number}</td>
                      <td className="px-4 py-2">{i.vendor_name}</td>
                      <td className="whitespace-nowrap px-4 py-2">{formatDate(i.due_date)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(i.amount_minor, i.currency)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={tone[i.status]}>{i.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncBoundary>
      </Card>
    </>
  )
}

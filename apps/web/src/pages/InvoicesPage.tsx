import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Amount } from '@/components/Amount'
import { PageHeader } from '@/components/PageHeader'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, parseMoneyToCents } from '@/lib/money'
import { api } from '@/services/api'
import type { Invoice, InvoiceStatus, Vendor } from '@/types/api'

type Filter = InvoiceStatus | 'all'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'draft', label: 'Draft' },
  { value: 'paid', label: 'Paid' },
]

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null
}

function NewInvoiceSheet({
  open,
  onOpenChange,
  vendors,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  vendors: Vendor[]
  onCreated: () => void
}) {
  const [vendorId, setVendorId] = useState('')
  const [amount, setAmount] = useState('')
  const [due, setDue] = useState('')
  const [status, setStatus] = useState<'draft' | 'unpaid'>('draft')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const cents = parseMoneyToCents(amount)
    if (!vendorId) errs.vendor = 'Choose a vendor'
    if (cents === null || cents <= 0) errs.amount = 'Enter an amount greater than zero'
    if (!due) errs.due = 'Choose a due date'
    setErrors(errs)
    if (Object.keys(errs).length || cents === null) return
    setBusy(true)
    try {
      const inv = await api.createInvoice({ vendor_id: vendorId, amount_minor: cents, due_date: due, status })
      toast.success(`Created ${inv.number}`)
      setAmount('')
      setDue('')
      setVendorId('')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not create the invoice' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <form onSubmit={(e) => void submit(e)} noValidate className="flex h-full flex-col">
          <SheetHeader className="p-6">
            <SheetTitle>New invoice</SheetTitle>
            <SheetDescription>Synthetic only. Nothing is emailed and no payment is made.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-5 px-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-vendor">Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger id="inv-vendor" className="w-full" aria-invalid={Boolean(errors.vendor)}>
                  <SelectValue placeholder="Choose a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="inv-vendor-err" message={errors.vendor} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-amount">Amount (USD)</Label>
              <Input
                id="inv-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={Boolean(errors.amount)}
              />
              <FieldError id="inv-amount-err" message={errors.amount} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-due">Due date</Label>
              <Input id="inv-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-invalid={Boolean(errors.due)} />
              <FieldError id="inv-due-err" message={errors.due} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'unpaid')}>
                <SelectTrigger id="inv-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FieldError id="inv-form-err" message={errors.form} />
          </div>
          <SheetFooter className="p-6">
            <Button type="submit" disabled={busy}>
              Create invoice
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function InvoiceSheet({ invoice, onClose }: { invoice: Invoice | undefined; onClose: () => void }) {
  return (
    <Sheet open={invoice !== undefined} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {invoice ? (
          <>
            <SheetHeader className="p-6 pb-4">
              <SheetDescription className="font-mono">{invoice.number}</SheetDescription>
              <SheetTitle className="text-3xl font-medium tracking-[-0.02em]">
                <Amount cents={invoice.amount_minor} currency={invoice.currency} />
              </SheetTitle>
              <div>
                <StatusBadge status={invoice.status} />
              </div>
            </SheetHeader>
            <Separator />
            <dl className="divide-y divide-border px-6 text-sm">
              {[
                [
                  'Vendor',
                  <Link
                    key="v"
                    to={`/vendors/${invoice.vendor_id}`}
                    className="text-signal-ink underline-offset-4 hover:underline"
                    onClick={onClose}
                  >
                    {invoice.vendor_name}
                  </Link>,
                ],
                ['Issued', formatDate(invoice.issue_date)],
                ['Due', formatDate(invoice.due_date)],
                [
                  'Invoice ID',
                  <span key="i" className="break-all font-mono text-xs">
                    {invoice.id}
                  </span>,
                ],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-baseline justify-between gap-6 py-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export default function InvoicesPage() {
  const invoices = useAsync(() => api.getInvoices())
  const vendors = useAsync(() => api.getVendors())
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Invoice>()

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Synthetic invoices. No emails are sent and no real payments are made."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus strokeWidth={1.5} className="size-4" />
            New invoice
          </Button>
        }
      />
      <AsyncBoundary state={invoices}>
        {(list) => {
          const count = (f: Filter) => (f === 'all' ? list.length : list.filter((i) => i.status === f).length)
          const rows = filter === 'all' ? list : list.filter((i) => i.status === filter)
          return (
            <>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="gap-4">
                <TabsList className="h-auto flex-wrap justify-start">
                  {FILTERS.map((f) => (
                    <TabsTrigger key={f.value} value={f.value} className="gap-1.5">
                      {f.label}
                      <span className="num text-xs text-muted-foreground">{count(f.value)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={filter}>
                  <Card className="gap-0 overflow-hidden py-0">
                    {rows.length === 0 ? (
                      <EmptyState title="No invoices here" hint="Try another status, or create a new invoice." />
                    ) : (
                      <Table>
                        <caption className="sr-only">Invoices</caption>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-5">Invoice</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="hidden sm:table-cell">Due</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="pr-5">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((i) => (
                            <TableRow key={i.id} className="cursor-pointer" onClick={() => setSelected(i)}>
                              <TableCell className="pl-5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelected(i)
                                  }}
                                  className="rounded-sm font-mono text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {i.number}
                                </button>
                              </TableCell>
                              <TableCell>{i.vendor_name}</TableCell>
                              <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                                {formatDate(i.due_date)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Amount cents={i.amount_minor} currency={i.currency} />
                              </TableCell>
                              <TableCell className="pr-5">
                                <StatusBadge status={i.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )
        }}
      </AsyncBoundary>
      <NewInvoiceSheet open={creating} onOpenChange={setCreating} vendors={vendors.data ?? []} onCreated={invoices.reload} />
      <InvoiceSheet invoice={selected} onClose={() => setSelected(undefined)} />
    </>
  )
}

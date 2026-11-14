// Synthetic, invented data only. Deterministic so tests are stable.
import type { Account, AuditEvent, Invoice, Payment, PaymentDraft, Transaction, Vendor } from '@/types/api'

export const MOCK_TODAY = '2026-11-14'

export const mockMe = {
  user_id: 'u-demo-1',
  email: 'demo@finpilot.example',
  display_name: 'Demo Admin',
  role: 'owner' as const,
  workspace: { id: 'w-acme', name: 'Acme Robotics (Demo)' },
}

export const mockAccounts: Account[] = [
  { id: 'a-op', name: 'Operating Account', kind: 'checking', balance_minor: 18425000, currency: 'USD' },
  { id: 'a-res', name: 'Reserve Savings', kind: 'savings', balance_minor: 52000000, currency: 'USD' },
  { id: 'a-card', name: 'Corporate Card', kind: 'credit', balance_minor: -1284050, currency: 'USD' },
]

const vendorSeed: Array<[string, string, string]> = [
  ['AWS', 'Cloud Infrastructure', 'billing@aws.example'],
  ['ABC Vendors', 'Office Supplies', 'accounts@abc-vendors.example'],
  ['Northwind Logistics', 'Shipping', 'ar@northwind.example'],
  ['Globex Payroll', 'Payroll', 'support@globex.example'],
  ['Initech Software', 'Software', 'billing@initech.example'],
  ['Umbrella Legal', 'Legal', 'invoices@umbrella.example'],
  ['Stark Facilities', 'Facilities', 'ar@stark.example'],
  ['Wayne Marketing', 'Marketing', 'billing@wayne.example'],
  ['Hooli Cloud Tools', 'Software', 'pay@hooli.example'],
  ['Wonka Catering', 'Meals', 'orders@wonka.example'],
  ['Cyberdyne Hardware', 'Equipment', 'sales@cyberdyne.example'],
  ['Soylent Utilities', 'Utilities', 'billing@soylent.example'],
]

// small deterministic PRNG
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const rand = rng(42)
const monthsBack = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export const mockTransactions: Transaction[] = (() => {
  const out: Transaction[] = []
  let n = 1
  for (const month of monthsBack) {
    const lastDay = month === '2026-11' ? 13 : 28
    // 1 inflow revenue per few days
    for (let d = 2; d <= lastDay; d += 6) {
      const cents = Math.round((900000 + rand() * 1400000) / 100) * 100
      out.push({
        id: `t-${n++}`,
        date: `${month}-${pad(d)}`,
        description: 'Customer payment',
        vendor_id: null,
        vendor_name: null,
        category: 'Revenue',
        type: 'inflow',
        amount_minor: cents,
        account_id: 'a-op',
        currency: 'USD',
      })
    }
    // outflows
    vendorSeed.forEach(([name, category], i) => {
      if (month === '2026-11' && i > 7) return
      const d = Math.min(lastDay, 1 + ((i * 2 + 3) % 27))
      const base = category === 'Payroll' ? 4200000 : category === 'Cloud Infrastructure' ? 110000 : 40000
      const cents = Math.round((base + rand() * base * 0.4) / 100) * 100
      out.push({
        id: `t-${n++}`,
        date: `${month}-${pad(d)}`,
        description: `${name} — ${month} services`,
        vendor_id: `v-${i + 1}`,
        vendor_name: name,
        category,
        type: 'outflow',
        amount_minor: cents,
        account_id: i % 4 === 0 ? 'a-card' : 'a-op',
        currency: 'USD',
      })
    })
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
})()

export const mockVendors: Vendor[] = vendorSeed.map(([name, category, email], i) => {
  const txns = mockTransactions.filter((t) => t.vendor_id === `v-${i + 1}`)
  return {
    id: `v-${i + 1}`,
    name,
    category,
    contact_email: email,
    contact_phone: `+1-555-01${pad(i + 10)}`,
    total_spend_minor: txns.reduce((s, t) => s + t.amount_minor, 0),
    transaction_count: txns.length,
  }
})

export const mockInvoices: Invoice[] = [
  ['INV-1001', 1, '2026-09-20', '2026-10-20', 125000, 'overdue'],
  ['INV-1002', 2, '2026-10-30', '2026-11-20', 50000, 'unpaid'],
  ['INV-1003', 5, '2026-10-25', '2026-11-24', 84000, 'unpaid'],
  ['INV-1004', 6, '2026-10-02', '2026-11-01', 360000, 'overdue'],
  ['INV-1005', 3, '2026-09-01', '2026-09-30', 72500, 'paid'],
  ['INV-1006', 8, '2026-11-08', '2026-12-08', 210000, 'draft'],
  ['INV-1007', 9, '2026-11-02', '2026-11-27', 39900, 'unpaid'],
  ['INV-1008', 12, '2026-10-10', '2026-11-09', 18800, 'paid'],
  ['INV-1009', 11, '2026-11-10', '2026-12-10', 640000, 'draft'],
  ['INV-1010', 7, '2026-10-15', '2026-11-18', 158000, 'unpaid'],
].map(([number, vi, issue, due, amount, status]) => ({
  id: `i-${number}`,
  number: number as string,
  vendor_id: `v-${vi}`,
  vendor_name: vendorSeed[(vi as number) - 1][0],
  issue_date: issue as string,
  due_date: due as string,
  amount_minor: amount as number,
  currency: 'USD',
  status: status as Invoice['status'],
}))

export const mockDrafts: PaymentDraft[] = [
  {
    id: 'd-1',
    vendor_id: 'v-2',
    vendor_name: 'ABC Vendors',
    amount_minor: 50000,
    currency: 'USD',
    source_account_id: 'a-op',
    source_account_name: 'Operating Account',
    memo: 'October services',
    execution_date: MOCK_TODAY,
    status: 'pending_confirmation',
    created_at: '2026-11-14T09:30:00Z',
  },
]

export const mockPayments: Payment[] = [
  {
    id: 'p-1',
    draft_id: 'd-0',
    vendor_name: 'Northwind Logistics',
    amount_minor: 72500,
    currency: 'USD',
    executed_at: '2026-10-01T14:05:00Z',
    receipt_label: 'SIMULATED PAYMENT — NO MONEY MOVED',
  },
]

export const mockAudit: AuditEvent[] = [
  { id: 'e-1', at: '2026-11-14T09:30:00Z', actor: 'Demo Admin', action: 'payment_draft.created', target: 'd-1', status: 'succeeded' },
  {
    id: 'e-2',
    at: '2026-11-14T09:29:10Z',
    actor: 'AI: get_vendor_spending',
    action: 'ai_tool.invoked',
    target: 'ABC Vendors',
    status: 'succeeded',
  },
  { id: 'e-3', at: '2026-10-01T14:05:00Z', actor: 'Demo Admin', action: 'payment.executed', target: 'p-1', status: 'succeeded' },
  { id: 'e-4', at: '2026-10-01T14:05:30Z', actor: 'Demo Admin', action: 'payment.confirm_duplicate', target: 'd-0', status: 'rejected' },
]

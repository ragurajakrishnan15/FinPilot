// Typed API client. Phase 1: backed by in-memory mock data.
// Phase 2 replaces the bodies with fetch() calls to VITE_API_BASE_URL; signatures stay the same.
import type {
  Account,
  AuditEvent,
  CategoryPoint,
  CommandResponse,
  ConversationMessage,
  ConversationSummary,
  Dashboard,
  Invoice,
  Me,
  MonthlyPoint,
  Page,
  Payment,
  PaymentDraft,
  Transaction,
  TransactionQuery,
  Vendor,
} from '@/types/api'
import {
  mockAccounts,
  mockAudit,
  mockDrafts,
  mockInvoices,
  mockMe,
  mockPayments,
  mockTransactions,
  mockVendors,
  MOCK_TODAY,
} from './mockData'

import { formatMoney } from '@/lib/money'

const LATENCY_MS = 120
const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), LATENCY_MS))

import { ApiError } from './errors'

let drafts = [...mockDrafts]
let payments = [...mockPayments]
let invoices = [...mockInvoices]
const audit = [...mockAudit]
const executedKeys = new Set<string>()

export function __resetMockState() {
  drafts = [...mockDrafts]
  payments = [...mockPayments]
  invoices = [...mockInvoices]
  audit.length = 0
  audit.push(...mockAudit)
  executedKeys.clear()
}

export const mockApi = {
  getHealth: (): Promise<{ status: string }> => delay({ status: 'mock' }),
  // The mock keeps no history; the live API persists conversations server-side.
  getConversations: (): Promise<ConversationSummary[]> => delay([]),
  getConversationMessages: (_id: string): Promise<ConversationMessage[]> => delay([]),
  getMe: (): Promise<Me> => delay(mockMe),
  getAccounts: (): Promise<Account[]> => delay(mockAccounts),

  getDashboard(): Promise<Dashboard> {
    const month = MOCK_TODAY.slice(0, 7)
    const thisMonth = mockTransactions.filter((t) => t.date.startsWith(month))
    const income = thisMonth.filter((t) => t.type === 'inflow').reduce((s, t) => s + t.amount_minor, 0)
    const expense = thisMonth.filter((t) => t.type === 'outflow').reduce((s, t) => s + t.amount_minor, 0)
    const byMonth = new Map<string, MonthlyPoint>()
    const byCat = new Map<string, number>()
    for (const t of mockTransactions) {
      const m = t.date.slice(0, 7)
      const p = byMonth.get(m) ?? { month: m, inflow_minor: 0, outflow_minor: 0 }
      if (t.type === 'inflow') p.inflow_minor += t.amount_minor
      else {
        p.outflow_minor += t.amount_minor
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount_minor)
      }
      byMonth.set(m, p)
    }
    const categories: CategoryPoint[] = [...byCat.entries()]
      .map(([category, amount_minor]) => ({ category, amount_minor }))
      .sort((a, b) => b.amount_minor - a.amount_minor)
    return delay({
      total_balance_minor: mockAccounts.reduce((s, a) => s + a.balance_minor, 0),
      month_income_minor: income,
      month_expense_minor: expense,
      month_net_minor: income - expense,
      monthly: [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1)),
      categories,
      recent: mockTransactions.slice(0, 6),
    })
  },

  getTransactions(q: TransactionQuery = {}): Promise<Page<Transaction>> {
    const page = q.page ?? 1
    const page_size = q.page_size ?? 10
    const s = q.search?.trim().toLowerCase()
    const filtered = mockTransactions.filter(
      (t) =>
        (!s || t.description.toLowerCase().includes(s) || (t.vendor_name ?? '').toLowerCase().includes(s)) &&
        (!q.type || t.type === q.type) &&
        (!q.category || t.category === q.category) &&
        (!q.vendor_id || t.vendor_id === q.vendor_id) &&
        (q.min_minor === undefined || t.amount_minor >= q.min_minor) &&
        (q.max_minor === undefined || t.amount_minor <= q.max_minor) &&
        (!q.from || t.date >= q.from) &&
        (!q.to || t.date <= q.to),
    )
    return delay({
      items: filtered.slice((page - 1) * page_size, page * page_size),
      total: filtered.length,
      page,
      page_size,
    })
  },

  async getTransaction(id: string): Promise<Transaction> {
    const t = mockTransactions.find((x) => x.id === id)
    if (!t) throw new ApiError('not_found', 'Transaction not found')
    return delay(t)
  },

  getCategories: (): Promise<string[]> => delay([...new Set(mockTransactions.map((t) => t.category))].sort()),

  getVendors: (): Promise<Vendor[]> => delay(mockVendors),

  async getVendor(id: string): Promise<{ vendor: Vendor; transactions: Transaction[] }> {
    const vendor = mockVendors.find((v) => v.id === id)
    if (!vendor) throw new ApiError('not_found', 'Vendor not found')
    return delay({ vendor, transactions: mockTransactions.filter((t) => t.vendor_id === id) })
  },

  getInvoices: (): Promise<Invoice[]> => delay(invoices),

  async createInvoice(input: { vendor_id: string; amount_minor: number; due_date: string; status: Invoice['status'] }): Promise<Invoice> {
    const vendor = mockVendors.find((v) => v.id === input.vendor_id)
    const errors: string[] = []
    if (!vendor) errors.push('Vendor is required')
    if (!Number.isInteger(input.amount_minor) || input.amount_minor <= 0) errors.push('Amount must be greater than zero')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) errors.push('Due date is required')
    if (errors.length || !vendor) throw new ApiError('validation_error', errors.join('; '))
    const inv: Invoice = {
      id: `i-new-${invoices.length + 1}`,
      number: `INV-${1001 + invoices.length}`,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      issue_date: MOCK_TODAY,
      due_date: input.due_date,
      amount_minor: input.amount_minor,
      currency: 'USD',
      status: input.status,
    }
    invoices = [inv, ...invoices]
    audit.unshift({
      id: `e-${audit.length + 1}`,
      at: new Date().toISOString(),
      actor: mockMe.display_name,
      action: 'invoice.created',
      target: inv.number,
      status: 'succeeded',
    })
    return delay(inv)
  },

  getDrafts: (): Promise<PaymentDraft[]> => delay(drafts),
  getPayments: (): Promise<Payment[]> => delay(payments),

  async createPaymentDraft(input: {
    vendor_id: string
    amount_minor: number
    source_account_id: string
    memo: string
  }): Promise<PaymentDraft> {
    const vendor = mockVendors.find((v) => v.id === input.vendor_id)
    const account = mockAccounts.find((a) => a.id === input.source_account_id)
    if (!vendor || !account) throw new ApiError('validation_error', 'Vendor and source account are required')
    if (!Number.isInteger(input.amount_minor) || input.amount_minor <= 0)
      throw new ApiError('validation_error', 'Amount must be greater than zero')
    const d: PaymentDraft = {
      id: `d-${drafts.length + 1}`,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      amount_minor: input.amount_minor,
      currency: 'USD',
      source_account_id: account.id,
      source_account_name: account.name,
      memo: input.memo.slice(0, 140),
      execution_date: MOCK_TODAY,
      status: 'pending_confirmation',
      created_at: new Date().toISOString(),
    }
    drafts = [d, ...drafts]
    audit.unshift({
      id: `e-${audit.length + 1}`,
      at: d.created_at,
      actor: mockMe.display_name,
      action: 'payment_draft.created',
      target: d.id,
      status: 'succeeded',
    })
    return delay(d)
  },

  async confirmPaymentDraft(id: string, idempotencyKey: string): Promise<Payment> {
    const d = drafts.find((x) => x.id === id)
    if (!d) throw new ApiError('not_found', 'Draft not found')
    if (executedKeys.has(idempotencyKey)) {
      const existing = payments.find((p) => p.draft_id === id)
      if (existing) return delay(existing)
    }
    if (d.status !== 'pending_confirmation') throw new ApiError('invalid_state', `Draft is already ${d.status}`)
    const acct = mockAccounts.find((a) => a.id === d.source_account_id)
    if (!acct || acct.balance_minor < d.amount_minor) {
      drafts = drafts.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x))
      throw new ApiError('insufficient_funds', 'Insufficient simulated balance')
    }
    executedKeys.add(idempotencyKey)
    drafts = drafts.map((x) => (x.id === id ? { ...x, status: 'executed' } : x))
    const p: Payment = {
      id: `p-${payments.length + 1}`,
      draft_id: id,
      vendor_name: d.vendor_name,
      amount_minor: d.amount_minor,
      currency: d.currency,
      executed_at: new Date().toISOString(),
      receipt_label: 'SIMULATED PAYMENT — NO MONEY MOVED',
    }
    payments = [p, ...payments]
    audit.unshift({
      id: `e-${audit.length + 1}`,
      at: p.executed_at,
      actor: mockMe.display_name,
      action: 'payment.executed',
      target: p.id,
      status: 'succeeded',
    })
    return delay(p)
  },

  async cancelPaymentDraft(id: string): Promise<PaymentDraft> {
    const d = drafts.find((x) => x.id === id)
    if (!d) throw new ApiError('not_found', 'Draft not found')
    if (d.status !== 'pending_confirmation') throw new ApiError('invalid_state', `Draft is already ${d.status}`)
    const updated = { ...d, status: 'cancelled' as const }
    drafts = drafts.map((x) => (x.id === id ? updated : x))
    audit.unshift({
      id: `e-${audit.length + 1}`,
      at: new Date().toISOString(),
      actor: mockMe.display_name,
      action: 'payment_draft.cancelled',
      target: id,
      status: 'succeeded',
    })
    return delay(updated)
  },

  getAuditEvents: (): Promise<AuditEvent[]> => delay([...audit]),

  async sendCommand(message: string, conversationId?: string): Promise<CommandResponse> {
    if (!message.trim()) throw new ApiError('validation_error', 'Message is required')
    if (message.length > 4000) throw new ApiError('validation_error', 'Message is too long (max 4000 characters)')
    const base = { message_id: crypto.randomUUID(), conversation_id: conversationId ?? crypto.randomUUID() }
    const m = message.toLowerCase()
    if (m.includes('balance')) {
      const total = mockAccounts.reduce((s, a) => s + a.balance_minor, 0)
      return delay({
        ...base,
        answer: 'Your current combined balance across all accounts is shown below.',
        ui_blocks: [{ type: 'metric', label: 'Total balance', value_minor: total, currency: 'USD' }],
        tool_activity: [{ tool_name: 'get_account_balance', status: 'succeeded' }],
      })
    }
    if (m.includes('another workspace') || m.includes('other workspace')) {
      return delay({
        ...base,
        answer: "I can't access other workspaces. I can only use data from your authorized workspace.",
        ui_blocks: [],
        tool_activity: [{ tool_name: 'search_transactions', status: 'rejected' }],
      })
    }
    if (m.includes('payment') && m.includes('prepare')) {
      const draft = await mockApi.createPaymentDraft({
        vendor_id: 'v-2',
        amount_minor: 50000,
        source_account_id: 'a-op',
        memo: 'October services',
      })
      return {
        ...base,
        answer: 'I prepared a payment draft. Nothing has been paid — review it and confirm on the Payments page.',
        ui_blocks: [{ type: 'payment_draft', draft }],
        tool_activity: [{ tool_name: 'create_payment_draft', status: 'succeeded' }],
      }
    }
    const rows = mockVendors
      .slice()
      .sort((a, b) => b.total_spend_minor - a.total_spend_minor)
      .slice(0, 5)
    return delay({
      ...base,
      answer: 'Here are your top vendors by spend (mock response — live AI arrives in Phase 3).',
      ui_blocks: [
        {
          type: 'table',
          columns: ['Vendor', 'Category', 'Total spend'],
          rows: rows.map((v) => [v.name, v.category, formatMoney(v.total_spend_minor)]),
        },
      ],
      tool_activity: [{ tool_name: 'get_vendor_spending', status: 'succeeded' }],
    })
  },
}

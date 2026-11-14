// Real API client. Mirrors the shape of mockApi so pages do not care which one is active.
import type {
  Account,
  AuditEvent,
  CommandResponse,
  ConversationMessage,
  ConversationSummary,
  Dashboard,
  Invoice,
  Me,
  Page,
  Payment,
  PaymentDraft,
  Transaction,
  TransactionQuery,
  Vendor,
} from '@/types/api'
import { BASE, qs, request } from './http'

export const httpApi = {
  // Public liveness endpoint: no auth needed.
  getHealth: async (): Promise<{ status: string }> => {
    const res = await fetch(`${BASE}/health`)
    if (!res.ok) throw new Error(`Health check failed (${res.status})`)
    return (await res.json()) as { status: string }
  },
  getMe: () => request<Me>('/api/me'),
  getAccounts: () => request<Account[]>('/api/accounts'),
  getDashboard: () => request<Dashboard>('/api/dashboard'),
  getTransactions: (q: TransactionQuery = {}) =>
    request<Page<Transaction>>(
      `/api/transactions${qs({
        search: q.search?.trim(),
        type: q.type,
        category: q.category,
        vendor_id: q.vendor_id,
        min_minor: q.min_minor,
        max_minor: q.max_minor,
        from: q.from,
        to: q.to,
        page: q.page,
        page_size: Math.min(q.page_size ?? 10, 100),
      })}`,
    ),
  getTransaction: (id: string) => request<Transaction>(`/api/transactions/${encodeURIComponent(id)}`),
  getCategories: () => request<string[]>('/api/categories'),
  getVendors: () => request<Vendor[]>('/api/vendors'),
  getVendor: (id: string) => request<{ vendor: Vendor; transactions: Transaction[] }>(`/api/vendors/${encodeURIComponent(id)}`),
  getInvoices: () => request<Invoice[]>('/api/invoices'),
  createInvoice: (input: { vendor_id: string; amount_minor: number; due_date: string; status: Invoice['status'] }) =>
    request<Invoice>('/api/invoices', { method: 'POST', body: input }),
  getDrafts: () => request<PaymentDraft[]>('/api/payment-drafts'),
  getPayments: () => request<Payment[]>('/api/payments'),
  createPaymentDraft: (input: { vendor_id: string; amount_minor: number; source_account_id: string; memo: string }) =>
    request<PaymentDraft>('/api/payment-drafts', { method: 'POST', body: input }),
  confirmPaymentDraft: (id: string, idempotencyKey: string) =>
    request<Payment>(`/api/payment-drafts/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  cancelPaymentDraft: (id: string) => request<PaymentDraft>(`/api/payment-drafts/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  getAuditEvents: () => request<AuditEvent[]>('/api/audit-events'),
  getConversations: () => request<ConversationSummary[]>('/api/conversations'),
  getConversationMessages: (id: string) => request<ConversationMessage[]>(`/api/conversations/${encodeURIComponent(id)}/messages`),
  sendCommand: (message: string, conversationId?: string) =>
    request<CommandResponse>('/api/command', { method: 'POST', body: { message, conversation_id: conversationId } }),
}

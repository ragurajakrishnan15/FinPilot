// API types — keep in sync with docs/api-reference.md and the Haskell backend.
// All money fields are integer minor units (cents).

export interface Me {
  user_id: string
  email: string
  display_name: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  workspace: { id: string; name: string }
}

export interface ResetResult {
  payments_removed: number
  drafts_removed: number
  invoices_removed: number
  ledger_entries_removed: number
  conversations_removed: number
}

export interface Account {
  id: string
  name: string
  kind: 'checking' | 'savings' | 'credit'
  balance_minor: number
  currency: string
}

export type TxnType = 'inflow' | 'outflow'

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  description: string
  vendor_id: string | null
  vendor_name: string | null
  category: string
  type: TxnType
  amount_minor: number // always positive; direction given by `type`
  account_id: string
  currency: string
}

export interface Vendor {
  id: string
  name: string
  category: string
  contact_email: string
  contact_phone: string
  total_spend_minor: number
  transaction_count: number
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue'

export interface Invoice {
  id: string
  number: string
  vendor_id: string
  vendor_name: string
  issue_date: string
  due_date: string
  amount_minor: number
  currency: string
  status: InvoiceStatus
}

export type PaymentDraftStatus = 'pending_confirmation' | 'executed' | 'cancelled' | 'rejected'

export interface PaymentDraft {
  id: string
  vendor_id: string
  vendor_name: string
  amount_minor: number
  currency: string
  source_account_id: string
  source_account_name: string
  memo: string
  execution_date: string
  status: PaymentDraftStatus
  created_at: string
}

export interface Payment {
  id: string
  draft_id: string
  vendor_name: string
  amount_minor: number
  currency: string
  executed_at: string
  receipt_label: 'SIMULATED PAYMENT — NO MONEY MOVED'
}

export interface AuditEvent {
  id: string
  at: string
  actor: string
  action: string
  target: string
  status: 'succeeded' | 'rejected' | 'failed'
}

export interface MonthlyPoint {
  month: string // YYYY-MM
  inflow_minor: number
  outflow_minor: number
}

export interface CategoryPoint {
  category: string
  amount_minor: number
}

export interface Dashboard {
  total_balance_minor: number
  month_income_minor: number
  month_expense_minor: number
  month_net_minor: number
  monthly: MonthlyPoint[]
  categories: CategoryPoint[]
  recent: Transaction[]
}

export interface TransactionQuery {
  search?: string
  type?: TxnType | ''
  category?: string
  vendor_id?: string
  min_minor?: number
  max_minor?: number
  from?: string
  to?: string
  page?: number
  page_size?: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ---- Command center ----
export type UiBlock =
  | { type: 'metric'; label: string; value_minor: number; currency: string }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'payment_draft'; draft: PaymentDraft }

export interface ToolActivity {
  tool_name: string
  status: 'succeeded' | 'failed' | 'rejected'
}

export interface CommandResponse {
  message_id: string
  conversation_id: string
  answer: string
  ui_blocks: UiBlock[]
  tool_activity: ToolActivity[]
}

export interface ConversationSummary {
  id: string
  created_at: string
  preview: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ui_blocks: UiBlock[]
  created_at: string
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: Record<string, string>
}

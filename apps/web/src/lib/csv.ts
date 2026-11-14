import type { Transaction } from '@/types/api'

/** Serialise transactions to CSV, quoting fields and neutralising spreadsheet formula injection. */
export function toCsv(rows: Transaction[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v)
  const header = ['id', 'date', 'description', 'vendor', 'category', 'type', 'amount_minor', 'currency']
  const lines = rows.map((t) =>
    [t.id, t.date, t.description, t.vendor_name ?? '', t.category, t.type, String(t.amount_minor), t.currency]
      .map((v) => esc(safe(v)))
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

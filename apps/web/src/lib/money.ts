/** Money is always integer minor units (cents). Never floats. */
export type Cents = number

export function formatMoney(minor: Cents, currency = 'USD'): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  const major = Math.trunc(abs / 100)
  const cents = abs % 100
  const whole = new Intl.NumberFormat('en-US').format(major)
  const symbol = currency === 'USD' ? '$' : `${currency} `
  return `${sign}${symbol}${whole}.${cents.toString().padStart(2, '0')}`
}

/** Integer cents -> an editable decimal string for form fields ("50000" -> "500.00"). Exact, no floats. */
export function centsToDecimal(minor: Cents): string {
  const abs = Math.abs(minor)
  return `${minor < 0 ? '-' : ''}${Math.trunc(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`
}

/** Parse a user-entered decimal string ("500", "500.5", "1,200.25") into cents. Returns null if invalid. */
export function parseMoneyToCents(input: string): Cents | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!m) return null
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0')
  return Number.isSafeInteger(cents) ? cents : null
}

export function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

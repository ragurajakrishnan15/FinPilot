const fmt = (m: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })

/** "2026-11" -> "Nov" */
export const monthShort = (m: string) => fmt(m, { month: 'short' })
/** "2026-11" -> "November" */
export const monthName = (m: string) => fmt(m, { month: 'long' })
/** "2026-11" -> "November 2026" */
export const monthLong = (m: string) => fmt(m, { month: 'long', year: 'numeric' })

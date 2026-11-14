import { centsToDecimal, formatMoney, parseMoneyToCents } from '@/lib/money'

describe('formatMoney', () => {
  it('formats integer cents', () => {
    expect(formatMoney(12345)).toBe('$123.45')
    expect(formatMoney(5)).toBe('$0.05')
    expect(formatMoney(-1284050)).toBe('-$12,840.50')
    expect(formatMoney(0)).toBe('$0.00')
  })
})

describe('parseMoneyToCents', () => {
  it('parses valid decimal strings without float error', () => {
    expect(parseMoneyToCents('500')).toBe(50000)
    expect(parseMoneyToCents('$1,200.25')).toBe(120025)
    expect(parseMoneyToCents('0.1')).toBe(10)
    expect(parseMoneyToCents('19.99')).toBe(1999)
  })
  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '12.']) expect(parseMoneyToCents(bad)).toBeNull()
  })
})

describe('centsToDecimal', () => {
  it('round-trips with parseMoneyToCents exactly', () => {
    for (const c of [0, 1, 5, 99, 100, 50000, 120025, 99999999]) expect(parseMoneyToCents(centsToDecimal(c))).toBe(c)
    expect(centsToDecimal(50000)).toBe('500.00')
    expect(centsToDecimal(5)).toBe('0.05')
  })
})

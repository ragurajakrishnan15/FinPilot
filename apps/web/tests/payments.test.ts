import { api, __resetMockState } from '@/services/api'
import { toCsv } from '@/lib/csv'

beforeEach(() => __resetMockState())

describe('payment workflow (mock)', () => {
  it('creating a draft does not execute a payment', async () => {
    const before = (await api.getPayments()).length
    const d = await api.createPaymentDraft({ vendor_id: 'v-2', amount_minor: 50000, source_account_id: 'a-op', memo: 'x' })
    expect(d.status).toBe('pending_confirmation')
    expect((await api.getPayments()).length).toBe(before)
  })

  it('confirmation is idempotent for the same key', async () => {
    const d = await api.createPaymentDraft({ vendor_id: 'v-2', amount_minor: 50000, source_account_id: 'a-op', memo: '' })
    const p1 = await api.confirmPaymentDraft(d.id, 'key-1')
    const p2 = await api.confirmPaymentDraft(d.id, 'key-1')
    expect(p2.id).toBe(p1.id)
    expect((await api.getPayments()).filter((p) => p.draft_id === d.id)).toHaveLength(1)
  })

  it('rejects a second confirmation with a different key', async () => {
    const d = await api.createPaymentDraft({ vendor_id: 'v-2', amount_minor: 50000, source_account_id: 'a-op', memo: '' })
    await api.confirmPaymentDraft(d.id, 'key-1')
    await expect(api.confirmPaymentDraft(d.id, 'key-2')).rejects.toThrow(/already executed/)
  })

  it('rejects cancelled drafts and invalid amounts', async () => {
    const d = await api.createPaymentDraft({ vendor_id: 'v-2', amount_minor: 100, source_account_id: 'a-op', memo: '' })
    await api.cancelPaymentDraft(d.id)
    await expect(api.confirmPaymentDraft(d.id, 'k')).rejects.toThrow(/cancelled/)
    await expect(api.createPaymentDraft({ vendor_id: 'v-2', amount_minor: 0, source_account_id: 'a-op', memo: '' })).rejects.toThrow()
  })

  it('rejects when simulated balance is insufficient', async () => {
    const d = await api.createPaymentDraft({ vendor_id: 'v-2', amount_minor: 999999999, source_account_id: 'a-op', memo: '' })
    await expect(api.confirmPaymentDraft(d.id, 'k')).rejects.toThrow(/Insufficient/)
  })
})

describe('toCsv', () => {
  it('escapes quotes and neutralises formula injection', async () => {
    const page = await api.getTransactions({ page_size: 1 })
    const row = { ...page.items[0], description: '=HYPERLINK("x"),a' }
    const csv = toCsv([row])
    expect(csv.split('\n')[1]).toContain(`"'=HYPERLINK(""x""),a"`)
  })
})

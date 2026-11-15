import { expect, test } from '@playwright/test'

// Needs the local API with DEMO_MODE=true. The endpoint has a 30 s per-workspace cooldown, so this runs on desktop only.
const API = 'http://localhost:8080'

test('Settings: reset demo data removes what was created and restores balances', async ({ page, request }, info) => {
  test.skip(info.project.name === 'mobile', 'reset has a per-workspace cooldown; desktop only')
  const token = (await (await request.post(`${API}/api/demo-session`)).json()).token as string
  const auth = { Authorization: `Bearer ${token}` }
  const get = async (path: string) => (await (await request.get(`${API}${path}`, { headers: auth })).json()) as unknown

  // Make some activity: a pending draft.
  const vendors = (await get('/api/vendors')) as { id: string }[]
  const accounts = (await get('/api/accounts')) as { id: string; kind: string }[]
  const checking = accounts.find((a) => a.kind === 'checking')!
  const created = await request.post(`${API}/api/payment-drafts`, {
    headers: auth,
    data: { vendor_id: vendors[0]!.id, amount_minor: 4200, source_account_id: checking.id, memo: 'e2e reset' },
  })
  expect(created.status()).toBe(201)
  expect(((await get('/api/payment-drafts')) as unknown[]).length).toBeGreaterThan(0)

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Reset demo data' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Reset demo data?')
  await dialog.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByText(/Demo data (was already clean|reset)/)).toBeVisible()

  expect(((await get('/api/payment-drafts')) as unknown[]).length).toBe(0)
  expect(((await get('/api/payments')) as unknown[]).length).toBe(0)
  const balances = ((await get('/api/accounts')) as { balance_minor: number }[]).map((a) => a.balance_minor).sort((a, b) => a - b)
  expect(balances).toEqual([-1284050, 18425000, 52000000]) // the seeded balances
})

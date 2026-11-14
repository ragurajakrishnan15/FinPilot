import { expect, test, type Page } from '@playwright/test'

const API = 'http://localhost:8080'

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${API}/health`)
  expect(res.ok(), 'API must be running on :8080').toBeTruthy()
})

async function openNav(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
}

test('shows the synthetic/simulated banner on every page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('note')).toContainText('Synthetic demo data')
  await expect(page.getByRole('note')).toContainText('simulated')
})

test('dashboard shows database-backed figures and charts', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Total balance')).toBeVisible()
  await expect(page.getByRole('img', { name: /Bar chart/ })).toBeVisible()
  await expect(page.getByRole('list', { name: /Expenses by category/ })).toBeVisible()
  // Amount column must never be clipped, even on a phone.
  const amountCell = page.getByRole('row').nth(1).getByRole('cell').last()
  const box = await amountCell.boundingBox()
  expect(box && box.x + box.width <= (page.viewportSize()?.width ?? 0) + 1, 'amount column visible').toBeTruthy()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  await page.screenshot({ path: `screens/dashboard-${info.project.name}.png`, fullPage: true })
})

test('no horizontal overflow on any route (responsive gate)', async ({ page }) => {
  for (const path of ['/', '/command', '/transactions', '/vendors', '/invoices', '/payments', '/activity', '/settings']) {
    await page.goto(path)
    await page.getByRole('heading', { level: 1 }).waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0)
  }
})

test('mobile navigation works', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile only')
  await page.goto('/')
  await openNav(page, true)
  await page.getByRole('link', { name: 'Vendors' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vendors' })).toBeVisible()
})

test('transactions: search, filter and paginate', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByText(/\d+ results/)).toBeVisible()
  await page.getByLabel('Search').fill('AWS')
  await expect(page.getByRole('cell', { name: /AWS/ }).first()).toBeVisible()
  await page.getByLabel('Search').fill('zzz-no-match')
  await expect(page.getByText('No transactions match your filters')).toBeVisible()
  await page.getByLabel('Search').fill('')
  await page.getByLabel('Type').selectOption('inflow')
  await expect(page.getByRole('cell', { name: 'Customer payment' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
})

test('vendors: list and detail', async ({ page }) => {
  await page.goto('/vendors')
  await page.getByRole('link', { name: /AWS/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'AWS' })).toBeVisible()
  await expect(page.getByText('Transaction history')).toBeVisible()
})

test('invoices: validation then creation', async ({ page }) => {
  await page.goto('/invoices')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText('Choose a vendor')).toBeVisible()
  await expect(page.getByText('Enter an amount greater than zero')).toBeVisible()
  await page.getByLabel('Vendor').selectOption({ label: 'ABC Vendors' })
  await page.getByLabel('Amount ($)').fill('123.45')
  await page.getByLabel('Due date').fill('2027-01-15')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Created INV-/ })).toBeVisible()
  await expect(page.getByRole('cell', { name: '$123.45' }).first()).toBeVisible()
})

test('payments: draft does not execute; confirm shows a SIMULATED receipt; cancel works', async ({ page }) => {
  await page.goto('/payments')
  await page.getByLabel('Payee').selectOption({ label: 'ABC Vendors' })
  await page.getByLabel('Source account').selectOption({ label: 'Operating Account' })
  await page.getByLabel('Amount ($)').fill('77.77')
  await page.getByLabel('Memo').fill('e2e confirm')
  await page.getByRole('button', { name: 'Create draft' }).click()
  const draft = page.getByRole('listitem').filter({ hasText: '$77.77' }).first()
  await expect(draft).toContainText('pending confirmation')
  // A draft alone never produces a receipt.
  await expect(page.getByRole('status').filter({ hasText: 'NO MONEY MOVED' })).toHaveCount(0)
  await draft.getByRole('button', { name: 'Confirm payment' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'NO MONEY MOVED' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: '$77.77' }).first()).toContainText('executed')

  // cancel path
  await page.getByLabel('Payee').selectOption({ label: 'ABC Vendors' })
  await page.getByLabel('Source account').selectOption({ label: 'Operating Account' })
  await page.getByLabel('Amount ($)').fill('88.88')
  await page.getByRole('button', { name: 'Create draft' }).click()
  const d2 = page.getByRole('listitem').filter({ hasText: '$88.88' }).first()
  await d2.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: '$88.88' }).first()).toContainText('cancelled')
})

test('payments: insufficient funds is rejected by the server', async ({ page }) => {
  await page.goto('/payments')
  await page.getByLabel('Payee').selectOption({ label: 'ABC Vendors' })
  await page.getByLabel('Source account').selectOption({ label: 'Operating Account' })
  await page.getByLabel('Amount ($)').fill('999999')
  await page.getByRole('button', { name: 'Create draft' }).click()
  const draft = page.getByRole('listitem').filter({ hasText: '$999,999.00' }).first()
  await draft.getByRole('button', { name: 'Confirm payment' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Insufficient simulated balance' })).toBeVisible()
})

test('activity log records the operations', async ({ page }) => {
  await page.goto('/activity')
  await expect(page.getByRole('cell', { name: 'payment.executed' }).first()).toBeVisible()
})

test('command center fails gracefully when the AI is not configured', async ({ page, request }) => {
  const token = (await (await request.post(`${API}/api/demo-session`)).json()).token as string
  const probe = await request.post(`${API}/api/command`, { headers: { Authorization: `Bearer ${token}` }, data: { message: 'ping' } })
  test.skip(probe.status() === 200, 'Groq is configured; unconfigured-path test not applicable')
  await page.goto('/command')
  await page.getByLabel('Message').fill('What is our balance?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('alert')).toContainText(/not configured/i)
})

test('settings shows live API health', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText('Live API')).toBeVisible()
  await expect(page.getByText('ok', { exact: true })).toBeVisible()
})

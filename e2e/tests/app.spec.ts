import { expect, test, type Page } from '@playwright/test'

const API = 'http://localhost:8080'

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${API}/health`)
  expect(res.ok(), 'API must be running on :8080').toBeTruthy()
})

// Radix selects are not native <select>: open the trigger, then pick the option.
async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('shows the synthetic/simulated notice on every page', async ({ page }) => {
  await page.goto('/')
  const note = page.getByRole('note')
  await expect(note).toContainText('Synthetic data')
  await expect(note).toContainText('simulated')
})

test('dashboard shows database-backed figures and charts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/\d{4}$/) // titled by its period, e.g. "November 2026"
  await expect(page.getByText('Total balance')).toBeVisible()
  await expect(page.getByRole('img', { name: /Bar chart/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Expenses by category' })).toBeVisible()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  // The amount column must never be clipped, even on a phone.
  const box = await page.getByRole('row').nth(1).getByRole('cell').last().boundingBox()
  expect(box && box.x + box.width <= (page.viewportSize()?.width ?? 0) + 1, 'amount column visible').toBeTruthy()
})

test('chart has an accessible table view', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Table' }).click()
  await expect(page.getByRole('table', { name: /Money in and money out by month/ })).toBeVisible()
})

test('no horizontal overflow on any route (responsive gate)', async ({ page }) => {
  for (const path of ['/', '/command', '/accounts', '/transactions', '/vendors', '/invoices', '/payments', '/activity', '/settings', '/no-such-page']) {
    await page.goto(path)
    await page.getByRole('heading', { level: 1 }).waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0)
  }
})

test('mobile navigation works', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile only')
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Vendors' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vendors' })).toBeVisible()
})

test('command palette opens with the keyboard and navigates', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard shortcut')
  await page.goto('/')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByText('Invoices', { exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible()
})

test('theme: choice applies and survives a reload', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('radio', { name: 'Light' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('transactions: search, filter, paginate and open details', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByText(/\d+ results/)).toBeVisible()
  await page.getByLabel('Search', { exact: true }).fill('AWS')
  await expect(page.getByRole('cell', { name: /AWS/ }).first()).toBeVisible()
  await page.getByLabel('Search', { exact: true }).fill('zzz-no-match')
  await expect(page.getByText('No transactions match')).toBeVisible()
  await page.getByLabel('Search', { exact: true }).fill('')
  await choose(page, 'Type', 'Money in')
  await expect(page.getByRole('cell', { name: 'Customer payment' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
  // detail sheet
  await page.getByRole('button', { name: 'Customer payment' }).first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('Money in')
  await expect(sheet).toContainText('Transaction ID')
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
})

test('vendors: list and detail', async ({ page }) => {
  await page.goto('/vendors')
  await page.getByRole('link', { name: /AWS/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'AWS' })).toBeVisible()
  await expect(page.getByText('Total spend')).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
})

test('invoices: validation, creation and detail', async ({ page }) => {
  await page.goto('/invoices')
  await page.getByRole('button', { name: 'New invoice' }).click()
  await page.getByRole('button', { name: 'Create invoice' }).click()
  const alerts = page.getByRole('alert')
  await expect(alerts.filter({ hasText: 'Choose a vendor' })).toBeVisible()
  await expect(alerts.filter({ hasText: 'Enter an amount greater than zero' })).toBeVisible()
  await expect(alerts.filter({ hasText: 'Choose a due date' })).toBeVisible()
  await choose(page, 'Vendor', 'ABC Vendors')
  await page.getByLabel('Amount (USD)').fill('123.45')
  await page.getByLabel('Due date').fill('2027-01-15')
  await page.getByRole('button', { name: 'Create invoice' }).click()
  await expect(page.getByText(/Created INV-/)).toBeVisible()
  await expect(page.getByRole('cell', { name: '$123.45' }).first()).toBeVisible()
  // detail
  await page.getByRole('tab', { name: /Draft/ }).click()
  await page.getByRole('button', { name: /^INV-/ }).first().click()
  await expect(page.getByRole('dialog')).toContainText('Invoice ID')
})

test('payments: a draft never executes; review then confirm gives a SIMULATED receipt; cancel works', async ({ page }) => {
  await page.goto('/payments')
  await choose(page, 'Payee', 'ABC Vendors')
  await choose(page, 'Pay from', 'Operating Account')
  await page.getByLabel('Amount (USD)').fill('77.77')
  await page.getByLabel('Memo').fill('e2e confirm')
  await page.getByRole('button', { name: 'Create draft' }).click()
  const draft = page.getByRole('listitem').filter({ hasText: '$77.77' }).first()
  await expect(draft).toContainText('Awaiting confirmation')
  // A draft alone never produces a receipt.
  await expect(page.getByRole('status', { name: 'Payment receipt' })).toHaveCount(0)

  // Review dialog reads the draft back; Back changes nothing.
  await draft.getByRole('button', { name: 'Review and confirm' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('$77.77')
  await expect(dialog).toContainText('No money moves')
  await dialog.getByRole('button', { name: 'Back' }).click()
  await expect(dialog).toBeHidden()
  await expect(draft).toContainText('Awaiting confirmation')

  // Explicit confirmation executes it.
  await draft.getByRole('button', { name: 'Review and confirm' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm simulated payment' }).click()
  await expect(page.getByRole('status', { name: 'Payment receipt' })).toContainText('NO MONEY MOVED')
  await expect(page.getByRole('listitem').filter({ hasText: '$77.77' }).first()).toContainText('Executed')

  // cancel path
  await choose(page, 'Payee', 'ABC Vendors')
  await choose(page, 'Pay from', 'Operating Account')
  await page.getByLabel('Amount (USD)').fill('88.88')
  await page.getByRole('button', { name: 'Create draft' }).click()
  const d2 = page.getByRole('listitem').filter({ hasText: '$88.88' }).first()
  await d2.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: '$88.88' }).first()).toContainText('Cancelled')
})

test('accounts lists balances; Pay from here prefills the account', async ({ page }) => {
  await page.goto('/accounts')
  await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Corporate Card' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pay from here' })).toHaveCount(2) // never from the credit card
  await page.getByRole('row', { name: /Reserve Savings/ }).getByRole('link', { name: 'Pay from here' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Payments' })).toBeVisible()
  await expect(page.getByLabel('Pay from', { exact: true })).toContainText('Reserve Savings')
})

test('pay this invoice: pre-fills a draft but creates and pays nothing', async ({ page, request }) => {
  const token = (await (await request.post(`${API}/api/demo-session`)).json()).token as string
  const before = (await (await request.get(`${API}/api/payment-drafts`, { headers: { Authorization: `Bearer ${token}` } })).json()).length
  await page.goto('/invoices')
  await page.getByRole('tab', { name: /Unpaid/ }).click()
  await page.getByRole('button', { name: /^INV-/ }).first().click()
  await page.getByRole('button', { name: 'Prepare payment' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Payments' })).toBeVisible()
  await expect(page.getByLabel('Memo')).toHaveValue(/^Invoice INV-/)
  await expect(page.getByLabel('Amount (USD)')).not.toHaveValue('')
  const after = (await (await request.get(`${API}/api/payment-drafts`, { headers: { Authorization: `Bearer ${token}` } })).json()).length
  expect(after, 'prefill must not create a draft').toBe(before)
})

test('unknown routes show a designed 404', async ({ page }) => {
  await page.goto('/definitely-not-a-page')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Go to the dashboard' }).click()
  await expect(page.getByText('Total balance')).toBeVisible()
})

test('payments: insufficient funds is rejected by the server', async ({ page }) => {
  await page.goto('/payments')
  await choose(page, 'Payee', 'ABC Vendors')
  await choose(page, 'Pay from', 'Operating Account')
  await page.getByLabel('Amount (USD)').fill('999999')
  await page.getByRole('button', { name: 'Create draft' }).click()
  const draft = page.getByRole('listitem').filter({ hasText: '$999,999.00' }).first()
  await draft.getByRole('button', { name: 'Review and confirm' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm simulated payment' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Insufficient simulated balance' })).toBeVisible()
})

test('activity log records the operations and filters', async ({ page }) => {
  await page.goto('/activity')
  await expect(page.getByRole('cell', { name: 'payment.executed' }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Rejected or failed' }).click()
  await expect(page.getByRole('cell', { name: 'payment.executed' })).toHaveCount(0)
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

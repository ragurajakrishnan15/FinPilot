import { expect, test } from '@playwright/test'

// Read-only smoke test for a public deployment (run with DEPLOYED_URL=https://...).
// It creates no payments or invoices; the only write is one Command Center question (a conversation + audit-free read tool).

test('loads the dashboard from the live API with the synthetic notice', async ({ page }) => {
  const failures: string[] = []
  page.on('requestfailed', (r) => failures.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`))
  page.on('console', (m) => {
    if (m.type() === 'error') failures.push(`console: ${m.text()}`)
  })
  await page.goto('/')
  await expect(page.getByRole('note')).toContainText('Synthetic data')
  await expect(page.getByText('Total balance')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  expect(failures, 'no failed requests or console errors').toEqual([])
})

test('data pages render from the live API', async ({ page }) => {
  for (const [path, heading] of [
    ['/accounts', 'Accounts'],
    ['/transactions', 'Transactions'],
    ['/vendors', 'Vendors'],
    ['/invoices', 'Invoices'],
    ['/payments', 'Payments'],
    ['/activity', 'Activity'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(page.getByRole('alert'), `${path} should not show an error`).toHaveCount(0)
  }
})

test('settings reports the live API as healthy', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText('Live API')).toBeVisible()
})

test('Command Center answers a balance question using a tool', async ({ page }) => {
  await page.goto('/command')
  await page.getByLabel('Message').fill('What is our total cash balance across all accounts?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText(/691,409\.50/).first()).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})

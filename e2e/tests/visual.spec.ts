import { expect, test, type Page } from '@playwright/test'

// Design review captures. Run with VISUAL=1; output goes to e2e/review (gitignored).
test.skip(!process.env.VISUAL, 'set VISUAL=1 to capture review screenshots')

const pages: [string, string][] = [
  ['dashboard', '/'],
  ['command', '/command'],
  ['transactions', '/transactions'],
  ['vendors', '/vendors'],
  ['invoices', '/invoices'],
  ['payments', '/payments'],
  ['activity', '/activity'],
  ['settings', '/settings'],
]

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // stable captures; also exercises the reduced-motion path
  page.setDefaultTimeout(10_000) // fail fast and name the step
  await page.addInitScript((t) => localStorage.setItem('finpilot-theme', t), theme)
}

for (const theme of ['light', 'dark'] as const) {
  test(`pages in ${theme}`, async ({ page }, info) => {
    test.setTimeout(90_000)
    await setTheme(page, theme)
    for (const [name, path] of pages) {
      await page.goto(path)
      await page.getByRole('heading', { level: 1 }).waitFor()
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `review/${name}-${theme}-${info.project.name}.png`, fullPage: true })
    }
  })
}

test('states (light)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await setTheme(page, 'light')
  const shot = (n: string) => page.screenshot({ path: `review/${n}-${info.project.name}.png`, fullPage: false })

  await page.goto('/transactions')
  await page.getByRole('button', { name: /Wayne Marketing|Stark|Umbrella|AWS|Initech/ }).first().click()
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(400)
  await shot('transaction-sheet')
  await page.keyboard.press('Escape')

  await page.goto('/invoices')
  await page.getByRole('button', { name: 'New invoice' }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Create invoice' }).click()
  await shot('invoice-form-errors')
  await page.keyboard.press('Escape')

  await page.goto('/payments')
  await page.getByLabel('Payee').click()
  await page.getByRole('option', { name: 'ABC Vendors' }).click()
  await page.getByLabel('Pay from').click()
  await page.getByRole('option', { name: 'Operating Account' }).click()
  await page.getByLabel('Amount (USD)').fill('250')
  await page.getByLabel('Memo').fill('Visual review')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await page.getByRole('button', { name: 'Review and confirm' }).first().waitFor()
  await shot('payments-with-draft')
  await page.getByRole('button', { name: 'Review and confirm' }).first().click()
  await page.getByRole('alertdialog').waitFor()
  await page.waitForTimeout(400) // let the dialog's open transition finish
  await shot('confirm-dialog')
  await page.getByRole('button', { name: 'Confirm simulated payment' }).click()
  await page.getByRole('status', { name: 'Payment receipt' }).waitFor()
  await expect(page.getByRole('status', { name: 'Payment receipt' })).toContainText('NO MONEY MOVED')
  await page.waitForTimeout(500)
  await shot('receipt')

  await page.goto('/')
  await page.getByRole('heading', { level: 1 }).waitFor() // the app must be mounted before the shortcut exists
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(400)
  await shot('command-palette')
})

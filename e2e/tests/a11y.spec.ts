import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Automated accessibility audit (WCAG 2.0/2.1 A + AA rules) on every route, in both themes.
// Automated checks catch roughly a third of issues; they do not replace manual keyboard and screen-reader testing.
const routes = ['/', '/command', '/accounts', '/transactions', '/vendors', '/invoices', '/payments', '/activity', '/settings', '/no-such-page']

for (const theme of ['light', 'dark'] as const) {
  test(`no serious or critical accessibility violations (${theme})`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript((t) => localStorage.setItem('finpilot-theme', t), theme)
    const failures: string[] = []
    for (const path of routes) {
      await page.goto(path)
      await page.getByRole('heading', { level: 1 }).waitFor()
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      for (const v of results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
        failures.push(`${theme} ${path}: ${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(' ')}`)
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
  })
}

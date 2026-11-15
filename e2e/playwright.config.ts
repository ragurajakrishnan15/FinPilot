import { defineConfig, devices } from '@playwright/test'

// Requires the API on :8080 (see README: docker compose + scripts/hs.ps1 run). The web dev server is started here.
// DEPLOYED_URL=https://... runs only tests/deployed.spec.ts against a public deployment (read-only; no local servers).
const deployed = process.env.DEPLOYED_URL
export default defineConfig({
  testDir: './tests',
  testMatch: deployed ? /deployed\.spec\.ts/ : undefined,
  testIgnore: deployed ? undefined : /deployed\.spec\.ts/,
  timeout: deployed ? 120_000 : 30_000, // a free-tier API can take ~50s to wake
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // tests share one seeded database
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: deployed ?? 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: deployed ? undefined : {
    command: 'npm run dev -- --port 5173',
    cwd: '../apps/web',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
})

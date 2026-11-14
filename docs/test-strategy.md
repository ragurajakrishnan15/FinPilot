# Test Strategy

| Layer | Tooling | What it covers | Command |
|---|---|---|---|
| Domain unit + property | Hspec, QuickCheck | money formatting/parsing, variance, affordability, pagination bounds, JWT verification | `./scripts/hs.ps1 test` |
| API integration (real PostgreSQL) | Hspec + `Network.Wai.Test` | auth, workspace isolation, validation, invoices, audit | same |
| Payment workflow | same | draft ≠ execute, exact debit, ledger row, idempotent replay, double-confirm, key reuse, cancel, insufficient funds, cross-tenant, viewer role, **concurrent confirmations** | same |
| AI tool calling | same, scripted fake LLM | allowlist, argument validation, workspace scoping, budgets, provider-error mapping, hijacked-model/prompt-injection, rate limit, conversation privacy | same |
| Frontend unit/component | Vitest + React Testing Library | money util, CSV (formula-injection safe), mock payment rules, every route renders, command + payment flows | `cd apps/web && npm test` |
| End-to-end | Playwright (desktop + mobile viewports) | real UI ↔ real API ↔ PostgreSQL: dashboard, filters, invoices, payment draft→confirm/cancel, insufficient funds, audit, responsive overflow | `cd e2e && npx playwright test` (API on :8080) |

`./scripts/hs.ps1 test` creates a throwaway `finpilot_test` database, applies migrations + seed and sets `TEST_DATABASE_URL`;
without that variable the integration specs are reported as *pending*, not passed.

## Not covered yet
- Live Groq responses (needs `GROQ_API_KEY`/`GROQ_MODEL`; model choice quality — tool selection evals — can only be measured against a real model).
- Load/performance tests; multi-region/failover.
- Playwright in CI (needs the API container and a seeded database; see `.github/workflows/ci.yml` TODO).

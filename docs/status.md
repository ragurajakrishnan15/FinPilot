# Status (2026-11-14)

| Phase | State | Evidence (actually run) |
|---|---|---|
| 0 — Repository foundation | Done | `.gitignore`, `.env.example`, compose, CI workflow, README. CI has **not** run on GitHub (no remote). |
| 1 — Frontend shell | Rebuilt on real shadcn/ui with a defined design direction ([design.md](design.md)) | Vitest 34/34, typecheck, lint, Prettier, build; Playwright 36 passed (desktop + mobile); axe-core audit clean in light and dark on every route including 404. Added: Accounts view, "Prepare payment" from an unpaid invoice (prefill only), error boundary and designed 404 |
| 2 — Database + Haskell API | Done | migrations + seed applied to PostgreSQL 16; Hspec integration tests incl. cross-workspace isolation |
| 3 — Groq + tool calling | Code + tests done; verified against live Groq (local and the deployed API) | scripted-LLM tests (allowlist, validation, budget, injection, rate limit). Needs `GROQ_API_KEY` + `GROQ_MODEL` (set as server env vars) |
| 4 — Simulated payments | Done | PaymentSpec incl. concurrent confirmations; Playwright draft→confirm/cancel |
| 5 — Quality & security | Mostly done | 78 Hspec examples, 20 Vitest, 23 Playwright (+1 mobile-only skipped on desktop). Playwright CI job added (actionlint-clean, not yet run on GitHub). Missing: systematic live-AI evals |
| 6 — Deployment | API on Render (free) + Supabase Postgres, web on Vercel; Playwright deployed smoke tests (read-only, desktop + mobile, 4 each) pass against the public URL, incl. a live Command Center answer | `render.yaml`, `apps/web/vercel.json`, production Dockerfile. Needs your Vercel/Render/Supabase accounts and secrets |
| 7 — Portfolio | Docs written; screenshots in `e2e/screens`; demo video + case study not done | |

Haskell toolchain: GHC 9.10 / Cabal inside Docker (`scripts/hs.ps1`); no native install.

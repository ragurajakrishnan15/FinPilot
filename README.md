# FinPilot

AI-powered financial command center — a portfolio project using **synthetic data only** and **simulated payments**. No real money ever moves.

**Stack:** React + TypeScript + Vite + Tailwind + Redux Toolkit + React Router + Recharts · Haskell + Servant · PostgreSQL · Groq (LLM, backend only) · Hspec/QuickCheck, Vitest/RTL, Playwright.

Docs: [`PLAN.md`](PLAN.md) · [architecture](docs/architecture.md) · [API](docs/api-reference.md) · [AI tools](docs/ai-tool-catalog.md) · [security](docs/security-design.md) · [tests](docs/test-strategy.md) · [status](docs/status.md)

## Live demo

- **Web:** https://fin-pilot-nu.vercel.app (Vercel)
- **API:** https://finpilot-api-c4bj.onrender.com/health (Render free tier, Haskell image from GHCR; PostgreSQL on Supabase)

The demo runs on synthetic data with simulated payments and a shared demo user. The API sleeps when idle, so the first
request after a quiet period can take up to a minute. Try the Command Center with "What is our total cash balance?".
Deployed smoke tests: `DEPLOYED_URL=https://fin-pilot-nu.vercel.app npx playwright test` in `e2e/` (read-only).

## Run it locally (Windows / PowerShell)

Prerequisites: Node 22+, Docker Desktop. (GHC is **not** required: the API is built in Docker. A native GHC 9.10 + Cabal also works.)

```powershell
copy .env.example .env             # set JWT_SECRET (32+ random chars); keep DEMO_MODE=true locally
docker compose up -d db            # PostgreSQL 16
./scripts/db-reset.ps1             # schema + synthetic seed (destroys local data)
./scripts/hs.ps1 build all         # compile the Haskell API (first build ~15 min, then cached)
```

Start the API (reads `.env`; `DATABASE_URL` must use host `localhost`, or `db` inside Docker):

```powershell
docker run --rm -p 8080:8080 --network finpilot_default --env-file .env `
  -v "${PWD}/apps/api:/app" -v finpilot-cabal2:/root/.cabal -v finpilot-dist2:/cache -w /app finpilot-hs-dev `
  sh -c 'exec $(cabal list-bin finpilot-api --builddir=/cache/dist)'
```

Start the web app:

```powershell
cd apps/web; npm install; npm run dev      # http://localhost:5173
```

The browser gets a short-lived demo token from `POST /api/demo-session` (only when `DEMO_MODE=true`).
To try the AI Command Center set `GROQ_API_KEY` and `GROQ_MODEL` (confirm the current model in the Groq console) in `.env` and restart the API.
Without them the Command page shows a clear "not configured" message and everything else works.

UI only, no backend: `VITE_USE_MOCK=true npm run dev` (in-memory synthetic data).

## Checks

```powershell
cd apps/web;  npm run format:check; npm run lint; npm run typecheck; npm test; npm run build
./scripts/hs.ps1 test                       # Hspec/QuickCheck + integration tests on a throwaway PostgreSQL DB
cd e2e; npx playwright test                 # needs the API on :8080 and a freshly seeded DB
```

## Safety model

- Synthetic, invented data only. Payments are simulated and receipts say **SIMULATED PAYMENT — NO MONEY MOVED**.
- The LLM can only request allowlisted tools; it never sees SQL or credentials. Identity and workspace always come from the verified JWT session.
- Creating a payment makes a draft. Execution needs a separate authenticated confirmation with an idempotency key, re-validated server-side in one transaction.
- Money is integer cents everywhere. All SQL is parameterized.

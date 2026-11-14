# Architecture

```
Browser (React/TS, Redux Toolkit, Router, Recharts)
   │  HTTPS JSON, Bearer JWT, Idempotency-Key on confirm
   ▼
Haskell API (Servant + Warp)            apps/api
   ├─ Api.hs            routes only (typed Servant API)
   ├─ App.hs            auth handler, CORS, headers, body limit, logging
   ├─ Handlers.hs       thin glue: authorize → validate → call DB/AI → map errors
   ├─ Domain/           pure money logic (Finance) and validation
   ├─ Database/         Queries.hs (reads, aggregates, chat), Payments.hs (transactional workflow)
   ├─ Auth/Jwt.hs      HS256 verification
   └─ AI/               GroqClient · ToolDefinitions · ToolDispatcher · PromptBuilder · AgentLoop
   │  postgresql-simple (parameterized)        │  http-client-tls
   ▼                                            ▼
PostgreSQL 16 (database/migrations, seed)     Groq (chat completions + tool calls)
```

## Key decisions
- **One modular backend**, no microservices. Haskell is the only production API.
- **Money = `BIGINT` cents** end to end (`Cents` newtype); the frontend formats, never computes balances. Chart axes divide by 100 for display only.
- **Identity**: JWT → `users.auth_subject` → `memberships` → `Ctx {user, workspace, role}`. Handlers and tools only ever use `Ctx`.
- **LlmClient is an interface** (`runLlm :: messages -> tools -> IO (Either LlmError LlmReply)`), so the agent loop and dispatcher are tested with a scripted fake.
- **Frontend data access** is isolated in `src/services` (`api.ts` selects `httpApi` or `mockApi` via `VITE_USE_MOCK`). Pages never call `fetch`.
- **Payments**: draft → (user) confirm. One transaction: lock draft, check idempotency, re-validate, lock account, debit, insert payment + ledger transaction, mark draft executed, write audit. Rejections are committed (state + audit) rather than rolled back.
- **Current month** on the dashboard = latest month with data, so seeded demo data never goes stale.

## Repository layout
`apps/web` · `apps/api` · `database/{migrations,seed}` · `e2e` · `docs` · `scripts` · `.github/workflows`

## Local development
```powershell
cp .env.example .env            # set JWT_SECRET (32+ chars); DEMO_MODE=true for local demo
docker compose up -d db
./scripts/db-reset.ps1          # schema + synthetic seed
./scripts/hs.ps1 build all      # compile in Docker (or `cabal build` with native GHC 9.10)
# run the API (needs the .env values; GROQ_API_KEY/GROQ_MODEL optional)
cd apps/web && npm install && npm run dev
```

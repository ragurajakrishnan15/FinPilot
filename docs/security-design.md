# Security Design

## Trust boundaries
- **Browser**: untrusted. Holds only a short-lived demo-session JWT in memory. No secrets; only `VITE_API_BASE_URL` (and later public Supabase values).
- **Haskell API**: policy enforcement point (auth, workspace scoping, validation, money, payment execution).
- **Groq**: external; receives the minimum context (date, role, workspace name, the user's message, bounded tool results).
- **PostgreSQL**: source of truth.

## Controls (and where they are tested)

| Control | Implementation | Test |
|---|---|---|
| JWT verification (HS256: signature, exp, sub, optional iss/nbf; rejects `alg=none`/other algs; constant-time compare) | `Auth/Jwt.hs` | `JwtSpec`, `IntegrationSpec` |
| Workspace from server-side membership; `X-Workspace-Id` only honoured if member | `App.authHandler`, `Queries.resolveCtx` | `IntegrationSpec` |
| Every tenant query scoped by `workspace_id`; other-tenant ids → 404 | `Database/*.hs` | `IntegrationSpec`, `PaymentSpec`, `AISpec` |
| Money as integer cents (`BIGINT`, `Cents` newtype), exact decimal parsing | `Types`, `Domain/*` | `FinanceSpec`, `ValidationSpec` |
| Parameterized SQL only; LIKE wildcards escaped | `Database/*.hs` | injection-style search test |
| Payment draft ≠ execution; separate confirm endpoint; role + state + balance + vendor/account re-validation in one transaction with row locks | `Database/Payments.hs` | `PaymentSpec` |
| Idempotency (`Idempotency-Key`, unique `(workspace_id, key)`, `draft_id` unique) incl. concurrent retries | `Payments.confirmDraft` | `PaymentSpec` (concurrency) |
| Audit events for state changes, rejections and AI tool calls (safe metadata only) | `Queries.insertAudit` | `IntegrationSpec`, `PaymentSpec` |
| LLM tool allowlist, arg validation, budgets, rate limit | `AI/*` | `AISpec` |
| Safe errors (no stack traces/SQL/secrets), body limit 64 KB, security headers, CORS allow-list | `Error`, `App` | `IntegrationSpec` |
| Secrets only in server env; `show Config` omits them; production refuses a weak `JWT_SECRET` | `Config.hs` | — |

## Known limitations / follow-ups
- **Supabase JWKS (RS256/ES256)** verification is not implemented; HS256 with the project JWT secret is supported. Add JWKS fetching before relying on asymmetric Supabase keys.
- Users must be provisioned in `users`/`memberships` (no auto-provisioning on first login yet).
- `POST /api/demo-session` issues a token for the seeded demo user when `DEMO_MODE=true`; **keep `DEMO_MODE=false` anywhere real users exist.**
- `POST /api/demo/reset` is only routable when `DEMO_MODE=true` (otherwise `404`), requires a verified session with an owner/admin role, acts only on the workspace from that session (never a client-supplied id), runs in a single transaction, is rate limited per workspace, and appends a `demo.reset` audit event. It never deletes audit events, so a reset cannot erase the record of what happened. It is tested for: hidden outside demo mode, unauthenticated, viewer forbidden, cross-workspace isolation, balance restoration, cooldown.
- Rate limiting for `/api/command` is per-user in the database; there is no global/IP limiter in front of the API (use the host/edge for that).
- The 64 KB body guard checks `Content-Length`; chunked uploads rely on host limits.
- No real money or bank data exists anywhere; all payments are database-only simulations.

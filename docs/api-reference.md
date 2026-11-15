# API Reference

Base URL: `VITE_API_BASE_URL` (default `http://localhost:8080`). JSON everywhere. **All money fields are integer minor units (cents).**
TypeScript mirror: `apps/web/src/types/api.ts`.

## Authentication

`Authorization: Bearer <JWT>` (HS256; `sub` and `exp` required; `iss` checked when `JWT_ISSUER` is set).
The backend resolves the user from `users.auth_subject = sub` and the workspace from `memberships`.
Optional `X-Workspace-Id` selects among the user's workspaces; a workspace the user does not belong to returns `403`.
A workspace ID in a request body, query string or model tool argument is **never** trusted.

`POST /api/demo-session` (only when `DEMO_MODE=true`) returns `{ "token": "...", "expires_in": 3600 }` for the seeded demo user.

## Errors

```json
{ "code": "validation_error", "message": "Request validation failed", "details": { "amount_minor": "Amount must be greater than zero" } }
```

| HTTP | code | Meaning |
|---|---|---|
| 400 | `bad_request` | Malformed input (e.g. bad `X-Workspace-Id`) |
| 401 | `unauthorized` | Missing/invalid/expired token |
| 403 | `forbidden` | No workspace access / role not allowed |
| 404 | `not_found` | Missing **or in another workspace** |
| 409 | `invalid_state`, `insufficient_funds`, … | Business-rule conflict |
| 413 | `payload_too_large` | Body over 64 KB |
| 422 | `validation_error` | Field-level validation (see `details`) |
| 500 | `internal_error` | Generic; details only in server logs |
| 503 | `service_unavailable` | Upstream (LLM) unavailable |

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Public. `{ "status": "ok" }` |
| POST | `/api/demo-session` | Demo mode only |
| GET | `/api/me` | User, role, active workspace |
| GET | `/api/dashboard` | Balance, latest-month income/expense/net, monthly (≤12), categories (6 months), recent |
| GET | `/api/accounts` | |
| GET | `/api/categories` | Distinct transaction categories |
| GET | `/api/transactions` | Query: `search`, `type` (inflow/outflow), `category`, `vendor_id`, `min_minor`, `max_minor`, `from`, `to`, `page` (≥1), `page_size` (1–100, default 10). Returns `{items,total,page,page_size}` |
| GET | `/api/transactions/:id` | |
| GET | `/api/vendors` | With `total_spend_minor` and `transaction_count` |
| GET | `/api/vendors/:id` | `{vendor, transactions}` |
| GET | `/api/invoices` | Latest 200 |
| POST | `/api/invoices` | Body `{vendor_id, amount_minor, due_date, status: "draft"|"unpaid"}` → `201`. Writes an audit event. Viewers get `403`. |
| GET | `/api/payments` | Simulated executed payments |
| GET | `/api/payment-drafts` | Added to PLAN §10 (UI needs to list drafts) |
| GET | `/api/audit-events` | Latest 200 |

### Payments (simulated; viewers get `403` on all three)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/payment-drafts` | Body `{vendor_id, amount_minor, source_account_id, memo?}` → `201` draft (`pending_confirmation`). Creating a draft **never** moves money. Credit accounts and other-workspace vendors/accounts → `422`. |
| POST | `/api/payment-drafts/:id/confirm` | **Required header** `Idempotency-Key` (8–100 chars `[A-Za-z0-9_-]`). Re-validates and executes in one transaction → `200` payment with `receipt_label: "SIMULATED PAYMENT — NO MONEY MOVED"`. Same key + same draft replays the same receipt. Already executed/cancelled/rejected → `409 invalid_state`; insufficient simulated balance → `409 insufficient_funds` (draft becomes `rejected`); key used for another draft → `409 idempotency_key_reuse`; unknown/other-workspace draft → `404`. |
| POST | `/api/payment-drafts/:id/cancel` | → `200` draft (`cancelled`). Not pending → `409 invalid_state`. |

### AI command center

| Method | Path | Notes |
|---|---|---|
| POST | `/api/command` | Body `{message, conversation_id?}` (message ≤ `MAX_COMMAND_INPUT_CHARS`, unknown fields rejected). Response `{message_id, conversation_id, answer, ui_blocks, ui_blocks_version: 1, tool_activity:[{tool_name,status}]}`. `ui_blocks` types: `metric{label,value_minor,currency}`, `table{columns,rows}`, `payment_draft{draft}`. |
| GET | `/api/conversations` | The caller's conversations (own only) |
| GET | `/api/conversations/:id/messages` | Own conversation only, else `404` |
| POST | `/api/demo/reset` | **Demo mode only** (`404` unless `DEMO_MODE=true`). Owner/admin only (`403` otherwise). Restores the caller's workspace to its seeded state: removes payments, drafts, API-created invoices and conversations, refunds executed payments to their source accounts, and removes the ledger rows they created. The audit log is kept and a `demo.reset` event is appended. Returns counts of what was removed. At most once per 30 s per workspace (`429 reset_too_soon`) |

Errors: `503 service_unavailable` (no `GROQ_API_KEY`/`GROQ_MODEL`), `429 rate_limited` (10 messages/min/user, or provider rate limit),
`504 llm_timeout`, `502 llm_unavailable`. Provider details are never returned. See `docs/ai-tool-catalog.md`.

## Limits

Amount: `1 … 100000000` cents ($1,000,000). Memo ≤ 140 chars, no control characters. `page_size` ≤ 100.

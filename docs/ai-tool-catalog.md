# AI Tool Catalog

The LLM (Groq, configured via `GROQ_MODEL`) can only *request* these nine tools. The backend decides whether and how to run them
(`apps/api/src/FinPilot/AI/`).

| Tool | Arguments | Result |
|---|---|---|
| `get_account_balance` | `account_id?` | Balances + total (metric + table blocks) |
| `get_monthly_expenses` | `year`, `month`, `category?` | Month total, count, by-category breakdown |
| `compare_expenses` | `range_a{from,to}`, `range_b{from,to}`, `vendor?`, `category?` | Both totals, delta, % change (basis points) |
| `search_transactions` | `from?`, `to?`, `vendor?`, `category?`, `type?`, `min_amount?`, `max_amount?`, `limit?` (≤10) | Up to 10 rows + total matches |
| `get_vendor_spending` | `vendor?`, `from?`, `to?` | One vendor's spend, or the top 5 vendors (default: last 90 days) |
| `get_cash_flow` | `from`, `to`, `group_by?` (day/week/month) | Inflow, outflow, net per period |
| `list_invoices` | `status?`, `due_from?`, `due_to?`, `limit?` (≤20) | Invoices |
| `create_payment_draft` | `vendor`, `amount` (decimal string), `source_account_id?`, `memo?` | A **draft** (never executed) |
| `get_payment_status` | `id?` | Draft / payment status (default: most recent) |

Not in the catalog on purpose: confirm, cancel, execute, SQL, or anything cross-workspace. Payment confirmation and cancellation are user
actions on the Payments page (`POST /api/payment-drafts/:id/confirm|cancel`).

## Execution contract (enforced in `ToolDispatcher`)

1. Unknown tool → `rejected`. Invalid JSON, unknown fields (e.g. a `workspace_id`) or arguments > 4000 chars → `rejected`.
2. Types, dates (`from ≤ to`, ≤ 5 years), months/years, enums and amounts validated. Amounts are decimal **strings** parsed exactly to integer cents.
3. User, workspace and role come from the verified JWT session (`Ctx`). No tool schema has such a parameter.
4. Vendors are resolved by name *inside the caller's workspace only*; ambiguous names return candidates, not a guess.
5. Every query is parameterized and workspace-scoped.
6. Results are bounded (≤10–20 rows, ≤ 6000 bytes returned to the model).
7. Each call writes an `ai_tool.invoked` audit event with tool name and status only (no arguments or prompt text).
8. `create_payment_draft` requires a role that can write, creates a `pending_confirmation` draft, and returns a UI block linking to the Payments page.

## Agent loop bounds

At most `MAX_TOOL_CALLS_PER_TURN` (default 5) tool executions per turn; surplus calls are refused with `tool_call_limit_reached`;
tools are withheld once the budget is spent; maximum `budget + 2` model rounds; 10 messages of history; 4000-char input;
10 messages per user per minute (`429 rate_limited`); provider timeout `GROQ_TIMEOUT_SECONDS`.

## Grounding

`ui_blocks` (metric / table / payment_draft, schema version 1) are produced by the backend from database results. The model's text is
only an explanation; numbers shown in blocks never come from model output.

## Prompt-injection posture

Database text (e.g. transaction descriptions) reaches the model only inside `tool`-role messages, and the system prompt says to treat
it as data. Even a fully hijacked model cannot move money: the strongest thing it can do is create a draft, which the user must confirm
separately (covered by `AISpec` "a fully hijacked model … still cannot move money").

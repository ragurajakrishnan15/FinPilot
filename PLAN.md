# FinPilot — Project Plan and Repository Skeleton

> **Product:** FinPilot — AI-powered financial command center  
> **Purpose:** A portfolio-grade, Mercury Command-inspired demonstration of LLM tool calling, full-stack product engineering, typed backend development, and safe financial workflows.  
> **Status:** Project specification / implementation blueprint  
> **Initial release:** MVP with synthetic data and simulated payments only

---

## 1. Product vision

FinPilot lets a small business explore synthetic financial data and prepare simulated financial actions using natural language.

A user can ask:

> “Show our AWS expenses for October, compare them with September, and prepare a $500 payment to ABC Vendors.”

FinPilot should:

1. Interpret the user's intent with an LLM.
2. Select an allowed backend tool.
3. Validate the tool arguments and the user's workspace permissions.
4. Retrieve or calculate results from PostgreSQL.
5. Present financial results as readable text, tables, or charts.
6. Create a payment draft when requested.
7. Require an explicit, authenticated user confirmation before simulating payment execution.
8. Record important operations in an audit log.

**Product principle:** the LLM interprets and explains; the backend authorizes and executes; PostgreSQL remains the source of truth.

## 2. Goals and non-goals

### Goals

- Deliver a polished, responsive financial dashboard.
- Build a useful AI command interface powered by Groq.
- Demonstrate real tool/function calling against seeded database records.
- Use React, TypeScript, Redux Toolkit, Haskell, and PostgreSQL.
- Implement a safe payment-draft and approval workflow.
- Demonstrate workspace-level authorization, audit logging, and automated testing.
- Deploy a public demo that recruiters can use without installing the project.
- Keep the initial project within free-tier allowances where practical.

### Non-goals for the MVP

- No real bank connection or payment network integration.
- No real transfers, card issuance, or access to real customer financial data.
- No production banking, regulatory, or compliance certification claims.
- No microservices, Kubernetes, event streaming, or complex distributed infrastructure.
- No model-controlled SQL, direct database credentials in the LLM, or autonomous payment execution.

## 3. Technology decisions

| Area | Choice | Responsibility |
|---|---|---|
| Frontend | React + TypeScript + Vite | Browser application |
| UI styling | Tailwind CSS + shadcn/ui | Design system and components |
| Client state | Redux Toolkit | Shared UI and session state |
| Routing | React Router | Page navigation |
| Charts | Recharts | Financial visualizations |
| Backend | Haskell | Application and domain logic |
| HTTP API | Servant | Typed REST endpoints |
| Database | PostgreSQL | Persistent application data |
| Database provider | Supabase (hosted PostgreSQL) | Managed database for demo deployment |
| Authentication | Supabase Auth (planned) | User identity and JWTs |
| LLM | Groq API | Natural-language understanding and tool calling |
| Backend tests | Hspec + QuickCheck | Unit, property, and integration tests |
| Frontend tests | Vitest + React Testing Library | Component and state tests |
| End-to-end tests | Playwright | Browser workflows |
| CI | GitHub Actions | Build and test automation |
| Frontend hosting | Vercel | Public React app |
| Backend hosting | Render or another Haskell-compatible host | Public Haskell API |

### Technology rules

- Keep the Groq model name configurable through `GROQ_MODEL`; do not hard-code it across the codebase.
- Confirm the currently available model and account rate limits in the Groq console before deployment.
- Haskell is the primary backend. Python may be used for optional data-generation scripts, but it is not a second production API.
- Use integer minor currency units (for example, cents) or PostgreSQL `NUMERIC` for money. Never use floating-point values for financial amounts.
- Use one modular backend application for the MVP. Do not split it into microservices prematurely.

## 4. High-level architecture

```mermaid
flowchart TB
    User[User / Recruiter Browser]
    subgraph Frontend[Frontend — React + TypeScript]
        Pages[Dashboard, Command, Transactions, Vendors, Invoices, Payments]
        State[Redux Toolkit]
        ApiClient[Typed API Client]
        Pages <--> State
        Pages --> ApiClient
    end

    subgraph Backend[Backend — Haskell + Servant]
        Http[REST API and Middleware]
        Auth[JWT and Workspace Authorization]
        Services[Dashboard / Transaction / Vendor / Invoice / Payment Services]
        Agent[AI Command Orchestrator]
        Tools[Tool Registry, Dispatcher, Argument Validation]
        Http --> Auth
        Auth --> Services
        Http --> Agent
        Agent --> Tools
        Tools --> Services
    end

    Groq[Groq API — LLM and Tool Calling]
    DB[(PostgreSQL — Supabase)]
    User --> Pages
    ApiClient <-->|HTTPS / JSON| Http
    Agent <-->|Model requests and tool results| Groq
    Services <-->|Parameterized queries| DB
```

### Trust boundaries

1. The browser is untrusted. It must not contain database credentials or the Groq API key.
2. The Haskell backend is the policy enforcement point. It authenticates users, scopes queries to a workspace, validates tool arguments, and executes business operations.
3. Groq is an external model provider. It receives only the minimum context needed for the current request. It does not receive database credentials and cannot execute SQL.
4. PostgreSQL stores financial records, payment state, and audit events.
5. Payment confirmation is a separate authenticated backend action. A natural-language message such as “yes, pay it” must not bypass the confirmation endpoint and its authorization checks.

## 5. Main application modules

### 5.1 Dashboard

- Account balance cards (synthetic data).
- Income, expense, and net cash-flow summaries.
- Monthly spending chart.
- Expense category breakdown.
- Recent transactions.
- Quick links to Command, invoices, and payments.

### 5.2 AI Command Center

- Chat interface with conversation history.
- Suggested prompt examples.
- Streaming response support only if it can be implemented reliably; otherwise use normal request/response first.
- Structured response blocks for financial summaries, transaction lists, and payment drafts.
- Clear display when a response is based on retrieved data.
- Friendly handling of model errors, rate limits, and unsupported requests.

### 5.3 Transactions

- Search and filter by date, vendor, category, amount, and transaction type.
- Transaction detail view.
- Pagination.
- CSV export of synthetic records.

### 5.4 Vendors

- Vendor directory and detail view.
- Vendor category and contact details (fictional).
- Spend totals and transaction history.

### 5.5 Invoices

- Invoice list with draft, unpaid, paid, and overdue states.
- Invoice detail view.
- Create and edit synthetic invoices.
- No real email delivery or external payment integration in the MVP.

### 5.6 Payments

- Create a payment draft.
- Preview payee, amount, currency, account, memo, and execution date.
- Require an explicit confirmation action.
- Simulate the ledger transfer in a database transaction.
- Prevent duplicate execution with an idempotency key.
- Display a simulated receipt.

### 5.7 Audit activity

- Record payment draft creation, confirmation, execution, cancellation, and rejected attempts.
- Record AI tool names, safe metadata, result status, and timestamps.
- Do not store secrets or unnecessarily sensitive prompt content in logs.

### 5.8 Settings and demo controls

- Demo workspace information.
- User and role display.
- API health status.
- Reset synthetic demo data (restricted to an authorized demo administrator or local development only).

## 6. AI tool catalog

The first release should implement these tools as backend functions. The LLM may request them, but only the backend can execute them.

| Tool | Input | Expected behavior |
|---|---|---|
| `get_account_balance` | account ID (optional) | Return authorized account balances |
| `get_monthly_expenses` | year, month, optional category | Aggregate expenses for the selected period |
| `compare_expenses` | two date ranges, optional vendor/category | Compare totals and calculate variance |
| `search_transactions` | date range, vendor, category, amount filters, pagination | Return matching authorized transactions |
| `get_vendor_spending` | vendor name or ID, date range | Return vendor spending totals and matching transactions |
| `get_cash_flow` | date range, grouping interval | Calculate inflows, outflows, and net movement |
| `list_invoices` | status, due-date range, pagination | Return authorized invoices |
| `create_payment_draft` | vendor ID, amount, currency, source account, memo | Create a draft only; never execute it |
| `get_payment_status` | payment or draft ID | Return authorized payment status |

### Tool execution contract

For every tool call:

1. Parse the model-provided function name and arguments.
2. Reject unknown tools and invalid JSON arguments.
3. Validate data types, date ranges, amount bounds, and required fields.
4. Resolve the authenticated user and active workspace from the verified session; never trust a workspace ID supplied only by the model.
5. Check user role and record-level authorization.
6. Execute a parameterized query or approved domain operation.
7. Return a bounded, structured result to the model.
8. Record an audit event when the operation is important or state-changing.

Never let a model-generated argument override authentication, authorization, or business rules.

## 7. Command request lifecycle

```mermaid
sequenceDiagram
    actor User
    participant Web as React App
    participant API as Haskell API
    participant Agent as Command Orchestrator
    participant LLM as Groq API
    participant Tool as Tool Dispatcher
    participant DB as PostgreSQL

    User->>Web: Ask a financial question
    Web->>API: POST /api/command
    API->>API: Verify session and workspace
    API->>Agent: Prompt + authorized context
    Agent->>LLM: Messages + tool definitions
    LLM-->>Agent: Tool call request
    Agent->>Tool: Validate and dispatch tool
    Tool->>DB: Parameterized, workspace-scoped query
    DB-->>Tool: Records / aggregate
    Tool-->>Agent: Structured tool result
    Agent->>LLM: Tool result
    LLM-->>Agent: Final explanation
    Agent-->>API: Answer + structured UI data
    API-->>Web: JSON response
    Web-->>User: Render answer and data
```

### Command API response shape (initial proposal)

```json
{
  "message_id": "uuid",
  "conversation_id": "uuid",
  "answer": "AWS expenses in October were ...",
  "ui_blocks": [
    {
      "type": "metric",
      "label": "October AWS expenses",
      "value_minor": 125000,
      "currency": "USD"
    }
  ],
  "tool_activity": [
    {
      "tool_name": "get_vendor_spending",
      "status": "succeeded"
    }
  ]
}
```

The `ui_blocks` schema should be validated and versioned by the backend. The frontend must safely render only supported block types.

## 8. Payment lifecycle and safety

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> PendingConfirmation: Draft shown to user
    PendingConfirmation --> Cancelled: User cancels
    PendingConfirmation --> Rejected: Validation or permission failure
    PendingConfirmation --> Executed: Authenticated confirmation succeeds
    Executed --> [*]
    Cancelled --> [*]
    Rejected --> [*]
```

### Required payment controls

- Payment creation only creates a draft.
- The confirmation endpoint requires an authenticated user action.
- Re-check workspace membership, role, draft state, amount, vendor, account, and available simulated balance at confirmation time.
- Use an idempotency key with a unique database constraint to prevent duplicate execution.
- Perform balance update, payment record creation, draft state transition, and audit event insertion in one database transaction.
- Reject stale, cancelled, already executed, or unauthorized drafts.
- Return a receipt with a clear **SIMULATED PAYMENT — NO MONEY MOVED** label.

## 9. Database entities

Initial tables:

| Table | Key fields / purpose |
|---|---|
| `users` | User profile linked to the authentication provider subject |
| `workspaces` | Demo company / tenant |
| `memberships` | User-to-workspace relationship and role |
| `accounts` | Synthetic company accounts and balances |
| `vendors` | Fictional suppliers and categories |
| `transactions` | Synthetic inflows and outflows, stored in minor units |
| `invoices` | Invoice number, vendor, dates, amount, status |
| `payment_drafts` | Proposed payments and confirmation state |
| `payments` | Simulated executed payments and idempotency key |
| `audit_events` | Actor, workspace, action, target, safe metadata, timestamp |
| `chat_sessions` | Conversation ownership and workspace |
| `chat_messages` | User and assistant messages, with retention considerations |

### Data rules

- Every tenant-owned record must include a `workspace_id` directly or be reachable through a verified workspace relationship.
- Add indexes for common filters: workspace, account, vendor, transaction date, invoice status, and payment status.
- Use foreign keys and database constraints for referential integrity.
- Use `BIGINT` minor units or `NUMERIC(precision, scale)` for money.
- Seed only invented names, vendors, transactions, invoices, and balances.
- Keep schema changes in numbered SQL migration files.

## 10. Proposed REST API

All application routes are under `/api` and return JSON. Exact request and response types should live in shared API documentation and frontend TypeScript types.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness / readiness response |
| `GET` | `/api/me` | Current user and active workspace |
| `GET` | `/api/dashboard` | Dashboard summary |
| `GET` | `/api/accounts` | Authorized account list |
| `GET` | `/api/transactions` | Filtered, paginated transactions |
| `GET` | `/api/transactions/:id` | Transaction detail |
| `GET` | `/api/vendors` | Vendor list |
| `GET` | `/api/vendors/:id` | Vendor detail and spending summary |
| `GET` | `/api/invoices` | Filtered invoice list |
| `POST` | `/api/invoices` | Create a synthetic invoice |
| `GET` | `/api/payments` | Payment list |
| `POST` | `/api/payment-drafts` | Create a payment draft |
| `POST` | `/api/payment-drafts/:id/confirm` | Confirm and simulate payment execution |
| `POST` | `/api/payment-drafts/:id/cancel` | Cancel a draft |
| `GET` | `/api/audit-events` | Filtered audit history |
| `POST` | `/api/command` | Send a message to the AI Command Center |
| `GET` | `/api/conversations` | List the current user's conversations |
| `GET` | `/api/conversations/:id/messages` | Retrieve conversation messages |

Use consistent error responses with a machine-readable `code`, safe `message`, and optional field-level validation details. Never return stack traces or secrets to the browser.

## 11. Proposed repository structure

```text
finpilot/
├── apps/
│   ├── web/                         # React + TypeScript frontend
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/                  # App providers and route setup
│   │   │   ├── components/           # Shared UI components
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── command/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── transactions/
│   │   │   │   ├── vendors/
│   │   │   │   ├── invoices/
│   │   │   │   └── payments/
│   │   │   ├── pages/
│   │   │   ├── services/             # Typed API client
│   │   │   ├── store/                # Redux store and slices
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── styles/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── api/                         # Haskell + Servant backend
│       ├── app/
│       │   ├── Main.hs
│       │   ├── Config/
│       │   ├── Api/
│       │   ├── Middleware/
│       │   ├── Auth/
│       │   ├── Handlers/
│       │   ├── Services/
│       │   ├── Domain/
│       │   ├── Database/
│       │   ├── AI/
│       │   │   ├── GroqClient.hs
│       │   │   ├── PromptBuilder.hs
│       │   │   ├── ToolDefinitions.hs
│       │   │   ├── ToolDispatcher.hs
│       │   │   └── AgentLoop.hs
│       │   ├── Finance/
│       │   └── Audit/
│       ├── test/
│       ├── finpilot-api.cabal
│       └── README.md
│
├── database/
│   ├── migrations/
│   ├── seed/
│   └── README.md
│
├── e2e/                              # Playwright tests
├── docs/
│   ├── architecture.md
│   ├── api-reference.md
│   ├── ai-tool-catalog.md
│   ├── security-design.md
│   └── test-strategy.md
│
├── scripts/                          # Local development and data scripts
├── .github/workflows/                # CI workflows
├── .env.example
├── .gitignore
├── CLAUDE.md
├── PLAN.md
├── README.md
└── docker-compose.yml                # Optional local PostgreSQL
```

## 12. Environment configuration

Create `.env.example` with placeholders only. Never commit a populated `.env` file.

```dotenv
# Frontend
VITE_API_BASE_URL=http://localhost:8080
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Haskell API
PORT=8080
APP_ENV=development
DATABASE_URL=postgresql://finpilot:finpilot@localhost:5432/finpilot
SUPABASE_JWT_JWKS_URL=
SUPABASE_JWT_ISSUER=
CORS_ALLOWED_ORIGINS=http://localhost:5173

# LLM — backend only; never use a VITE_ prefix
GROQ_API_KEY=
GROQ_MODEL=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TIMEOUT_SECONDS=30

# Application limits
MAX_COMMAND_INPUT_CHARS=4000
MAX_TOOL_CALLS_PER_TURN=5
DEMO_MODE=true
```

`SUPABASE_JWT_*` configuration depends on the selected Supabase JWT verification method. Confirm the current issuer/JWKS configuration for the project before implementing authentication. Do not trust decoded JWT claims unless the signature and required claims have been verified.

## 13. Local development workflow

### Prerequisites

- Git
- Node.js LTS and npm
- GHC and Cabal (or the selected Haskell toolchain)
- PostgreSQL, either local or via Docker
- Groq developer account and backend API key for live AI testing
- Supabase project only when using hosted database/auth services

### Suggested startup order

1. Start PostgreSQL locally or configure the Supabase development database.
2. Apply SQL migrations and load synthetic seed data.
3. Start the Haskell API on port `8080`.
4. Start the Vite frontend on port `5173`.
5. Verify `/health`, login/demo access, dashboard data, and one AI tool call.

### Example frontend commands

```bash
cd apps/web
npm install
npm run dev
```

### Example backend commands

The exact Cabal commands should be finalized after creating the Haskell package. A typical workflow is:

```bash
cd apps/api
cabal update
cabal build
cabal test
cabal run finpilot-api
```

Do not assume the backend compiles until the package file, dependencies, and application entry point have been created and tested.

## 14. Development phases and acceptance gates

### Phase 0 — Repository foundation

- Create the monorepo structure.
- Add `PLAN.md`, `CLAUDE.md`, root README, `.gitignore`, and `.env.example`.
- Add formatting and lint/test commands.
- Add a GitHub Actions workflow for frontend and backend checks.

**Gate:** a clean clone contains clear setup instructions and the initial CI workflow runs.

### Phase 1 — Frontend shell and UI

- Build the app shell, navigation, responsive layout, theme, and reusable components.
- Implement dashboard, Command, transactions, vendors, invoices, payments, activity, and settings pages with mock data.
- Add empty, loading, error, and success states.

**Gate:** every route works with mock data and the interface is usable on desktop and mobile.

### Phase 2 — Database and Haskell API

- Create migrations, constraints, indexes, and seed data.
- Create Servant routes, domain types, database layer, and services.
- Add workspace-scoped queries and authentication middleware.
- Replace frontend mock data with API calls.

**Gate:** dashboard and business pages show persisted PostgreSQL data; cross-workspace access tests fail safely.

### Phase 3 — Groq and AI tool calling

- Implement Groq HTTP client and configurable model.
- Define the tool catalog and JSON schemas.
- Implement tool dispatcher and bounded agent loop.
- Persist conversations and messages.
- Return validated structured UI blocks.
- Handle timeouts, provider errors, rate limits, malformed arguments, and model refusals.

**Gate:** supported prompts call the expected backend tools and all displayed financial facts come from database results.

### Phase 4 — Simulated payment workflow

- Create payment drafts and draft status transitions.
- Add confirmation and cancellation endpoints.
- Add permission re-checks and idempotency.
- Execute simulated ledger updates in one database transaction.
- Write audit events and display a clearly labeled simulated receipt.

**Gate:** no payment can be executed without explicit confirmation; duplicate and unauthorized attempts are rejected.

### Phase 5 — Quality and security

- Add Hspec, QuickCheck, Vitest, React Testing Library, and Playwright coverage.
- Add AI evaluation cases for tool selection and argument correctness.
- Test prompt injection, rate limiting, cross-tenant access, and payment edge cases.
- Review logs and ensure secrets are never exposed.

**Gate:** CI passes and critical workflows have repeatable automated tests.

### Phase 6 — Deployment

- Deploy the frontend, Haskell API, database, and auth configuration.
- Configure secrets only in provider environment settings.
- Set CORS to the deployed frontend origin.
- Add health checks, request limits, and basic error monitoring.
- Test the full public demo from a clean browser session.

**Gate:** a recruiter can use the deployed demo without local setup, and the demo clearly identifies synthetic data and simulated payments.

### Phase 7 — Portfolio presentation

- Write a clear GitHub README.
- Publish architecture, API, and security docs.
- Add screenshots and a short demo video.
- Write a technical case study explaining trade-offs and what was tested.

**Gate:** a reviewer can understand the product, run it locally, inspect its architecture, and try the public demo.

## 15. Initial demo prompts

Use these as test prompts in the Command Center:

1. “What is our current total account balance?”
2. “Show our expenses for October.”
3. “Compare AWS expenses in September and October.”
4. “Which five vendors received the most money this quarter?”
5. “Show invoices due in the next 14 days.”
6. “What was our net cash flow last month?”
7. “Prepare a $500 payment to ABC Vendors with the memo ‘October services’.”
8. “Cancel the payment draft I just created.”
9. “Show the status of my most recent payment.”
10. “Show me another workspace's financial records.” — expected to be rejected.

## 16. Definition of done

The MVP is ready to showcase when all of the following are true:

- [ ] Responsive dashboard and all primary pages work.
- [ ] React, TypeScript, and Redux Toolkit are used meaningfully.
- [ ] Haskell Servant API runs and is documented.
- [ ] PostgreSQL migrations and repeatable seed data work.
- [ ] Groq tool calling is connected through the backend.
- [ ] At least the nine tools in Section 6 are implemented and tested.
- [ ] AI answers are grounded in database results.
- [ ] Payment draft, confirmation, cancellation, and simulated execution work.
- [ ] Authorization, idempotency, and audit logging are tested.
- [ ] No secrets are committed or exposed to the browser.
- [ ] Automated tests and CI pass.
- [ ] Public deployment works and labels all data and transfers as simulated.
- [ ] README, architecture docs, screenshots, and demo walkthrough are ready.

## 17. Immediate next task

Start with **Phase 0 and Phase 1 only**. Do not implement Groq, payments, or database access before the frontend shell and repository foundation are reviewed.

The first Claude Code task should be:

> Read `PLAN.md` and `CLAUDE.md`. Inspect the current repository. Implement Phase 0, then build only the Phase 1 frontend shell using realistic synthetic mock data. Do not create backend or live AI integrations yet. Run the available checks, summarize changed files, list commands to run locally, and identify any unfinished work. Do not claim a test passed unless you actually ran it.

---

## 18. Implementation decisions that changed the blueprint (2026-11-14)

- **Backend layout:** a library in `apps/api/src/FinPilot/**` plus `app/Main.hs` and `test/` (instead of everything under `app/`).
- **GHC 9.10 / Cabal 3.12**, built in Docker (`scripts/hs.ps1`); no native Haskell install is required on Windows.
- **Auth:** HS256 JWT verification with `JWT_SECRET` (+ optional `JWT_ISSUER`) replaces `SUPABASE_JWT_JWKS_URL` for now. JWKS support is a follow-up (see `docs/security-design.md`). `POST /api/demo-session` (DEMO_MODE only) issues the demo token.
- **API additions:** `GET /api/payment-drafts`, `GET /api/categories`, `Idempotency-Key` header on confirm.
- **AI amounts:** tool arguments use decimal strings (e.g. `"500"`) parsed exactly to cents; `get_vendor_spending` without a vendor returns the top 5 vendors (covers demo prompt 4). Cancel/confirm are intentionally not AI tools (demo prompt 8 is answered by pointing the user to the Payments page).
- **Dashboard "current month"** = latest month with data.
- **Frontend data layer:** `VITE_USE_MOCK=true` selects in-memory mock data; otherwise the real HTTP API is used.

---

**Project status:** see `docs/status.md`. This file remains the blueprint; it does not by itself mean cloud services or deployments exist.

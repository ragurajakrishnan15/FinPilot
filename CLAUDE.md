# CLAUDE.md — FinPilot Repository Instructions

## Project context

FinPilot is a portfolio project: an AI-powered financial command center using synthetic business data and simulated payments. Read `PLAN.md` before implementing features. `PLAN.md` is the source of truth for product scope, architecture, API contracts, data model, phases, and acceptance criteria.

## Core architecture

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Redux Toolkit, React Router, Recharts.
- Backend: Haskell with Servant. Haskell is the primary application backend.
- Database: PostgreSQL. Supabase may provide hosted PostgreSQL and authentication.
- LLM: Groq API through the Haskell backend. Read the model name from `GROQ_MODEL`.
- Tests: Hspec and QuickCheck for Haskell; Vitest and React Testing Library for frontend; Playwright for end-to-end workflows.
- Deployment target: Vercel frontend and a Haskell-compatible backend host.

## Mandatory product and safety rules

1. Use synthetic financial data only. Never request, commit, or use real bank credentials or real customer financial records.
2. All payments are simulated. Do not integrate real payment rails or imply that money moved.
3. The LLM may request an allowlisted tool; it must never execute SQL, access the database directly, or bypass backend authorization.
4. The backend is the source of truth for authentication, workspace authorization, validation, financial calculations, and payment execution.
5. Payment creation creates a draft only. Execution requires a separate authenticated confirmation endpoint and server-side revalidation.
6. Use idempotency protection for payment execution.
7. Record significant state-changing operations in audit events.
8. Never expose `GROQ_API_KEY`, database credentials, JWT signing secrets, or server-only configuration in frontend code or `VITE_` variables.
9. Scope every tenant-owned query to the authenticated user's authorized workspace. Never trust a workspace ID supplied only by the model or browser.
10. Use integer minor currency units or exact decimal types. Do not use floating-point numbers for money.
11. Use parameterized SQL. Never concatenate user/model input into SQL strings.
12. Validate model-generated tool arguments against server-side schemas and business rules.
13. Limit tool calls per turn, input size, execution time, and returned data volume.
14. Do not store secrets or unnecessary sensitive content in logs.

## Working method

- Work in the phase order in `PLAN.md`; do not skip acceptance gates.
- At the start of a task, inspect the existing files and relevant tests. Do not assume a file or feature exists.
- Make focused changes. Avoid rewriting working code without a clear reason.
- Before editing, briefly state the implementation plan for multi-file or architectural tasks.
- Do not implement later phases unless explicitly asked or required by the current task.
- Prefer simple, typed, maintainable modules over premature abstractions or microservices.
- Keep API request/response types documented and synchronized with the frontend.
- Add tests for new business logic and bug fixes.
- Run formatting, linting, type checks, builds, and relevant tests after changes.
- Never claim a command or test passed unless it was actually executed and its result inspected.
- If a required toolchain, dependency, credential, or service is unavailable, explain the blocker and provide the exact next action. Do not fake a successful integration.
- Update `PLAN.md` or the relevant file in `docs/` when architecture or API decisions change.

## Frontend conventions

- Use TypeScript; avoid `any` unless there is a documented reason.
- Keep page components, reusable components, feature logic, API clients, and Redux state separated.
- Keep server data fetching in service/API modules, not scattered through presentation components.
- Include loading, empty, error, and success states for data-driven screens.
- Make forms accessible with labels, keyboard navigation, and clear validation messages.
- Do not put secrets or privileged business logic in the browser.
- Treat client-side state as presentation state, not authorization.

## Haskell backend conventions

- Keep Servant route definitions separate from handlers, services, domain logic, and database access.
- Keep financial calculations in typed domain functions and test them independently.
- Use explicit types for money, identifiers, dates, status values, and API payloads.
- Use safe database parameterization and transactions for multi-step state changes.
- Return consistent, safe API errors; do not expose stack traces or secrets.
- Verify JWT signatures and required claims before trusting identity or workspace membership.
- Keep Groq integration behind a small client module and configurable model setting.
- Implement a bounded agent/tool loop. Reject unknown tools, malformed arguments, excessive calls, and unsupported operations.

## LLM and tool-calling conventions

- Provide only the minimum context needed for the current request.
- Tool definitions describe capabilities; they do not grant permissions.
- Derive user and workspace identity from the verified server-side session, not model arguments.
- Validate all arguments on the backend even if the model returned schema-valid JSON.
- Return bounded structured tool results; avoid sending entire tables or excessive transaction history to the model.
- Distinguish data retrieval from state-changing operations.
- The `create_payment_draft` tool may create a draft but must not execute a payment.
- Payment confirmation must be a separate explicit user action handled by the API.
- Handle model/provider timeouts, rate limits, malformed tool calls, and refusals gracefully.

## Git and repository hygiene

- Keep `.env`, API keys, credentials, local database files, build output, and personal data out of Git.
- Maintain `.env.example` with variable names and safe placeholders only.
- Use clear commit messages when asked to commit.
- Do not add dependencies without checking whether an existing dependency can solve the problem.

## Completion report

At the end of each task, report:

1. What changed.
2. Which files were added or modified.
3. Which commands and tests were actually run, with pass/fail results.
4. Any known limitations or unfinished items.
5. The next task recommended by the phase plan.

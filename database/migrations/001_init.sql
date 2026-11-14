-- FinPilot schema. Money is BIGINT minor units (cents). Every tenant-owned row carries workspace_id.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject  TEXT NOT NULL UNIQUE,          -- JWT "sub"
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  PRIMARY KEY (user_id, workspace_id)
);

CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('checking','savings','credit')),
  balance_minor BIGINT NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'USD'
);
CREATE INDEX accounts_workspace_idx ON accounts(workspace_id);

CREATE TABLE vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);
CREATE INDEX vendors_workspace_idx ON vendors(workspace_id);

CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id   UUID NOT NULL REFERENCES accounts(id),
  vendor_id    UUID REFERENCES vendors(id),
  txn_date     DATE NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,
  txn_type     TEXT NOT NULL CHECK (txn_type IN ('inflow','outflow')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency     CHAR(3) NOT NULL DEFAULT 'USD'
);
CREATE INDEX transactions_ws_date_idx ON transactions(workspace_id, txn_date DESC);
CREATE INDEX transactions_ws_vendor_idx ON transactions(workspace_id, vendor_id);
CREATE INDEX transactions_ws_category_idx ON transactions(workspace_id, category);
CREATE INDEX transactions_account_idx ON transactions(account_id);

CREATE TABLE invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vendor_id    UUID NOT NULL REFERENCES vendors(id),
  number       TEXT NOT NULL,
  issue_date   DATE NOT NULL,
  due_date     DATE NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  status       TEXT NOT NULL CHECK (status IN ('draft','unpaid','paid','overdue')),
  UNIQUE (workspace_id, number)
);
CREATE INDEX invoices_ws_status_idx ON invoices(workspace_id, status);
CREATE INDEX invoices_ws_due_idx ON invoices(workspace_id, due_date);

CREATE TABLE payment_drafts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vendor_id         UUID NOT NULL REFERENCES vendors(id),
  source_account_id UUID NOT NULL REFERENCES accounts(id),
  amount_minor      BIGINT NOT NULL CHECK (amount_minor > 0),
  currency          CHAR(3) NOT NULL DEFAULT 'USD',
  memo              TEXT NOT NULL DEFAULT '' CHECK (char_length(memo) <= 140),
  execution_date    DATE NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('pending_confirmation','executed','cancelled','rejected')),
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_drafts_ws_status_idx ON payment_drafts(workspace_id, status);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  draft_id        UUID NOT NULL UNIQUE REFERENCES payment_drafts(id),
  vendor_id       UUID NOT NULL REFERENCES vendors(id),
  amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  idempotency_key TEXT NOT NULL,
  executed_by     UUID NOT NULL REFERENCES users(id),
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX payments_ws_idx ON payments(workspace_id, executed_at DESC);

CREATE TABLE audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  target       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('succeeded','rejected','failed')),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- safe metadata only; never secrets or prompts
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_ws_time_idx ON audit_events(workspace_id, created_at DESC);

CREATE TABLE chat_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_sessions_user_idx ON chat_sessions(workspace_id, user_id);

CREATE TABLE chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content      TEXT NOT NULL,
  ui_blocks    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_session_idx ON chat_messages(session_id, created_at);

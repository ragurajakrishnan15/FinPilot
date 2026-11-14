-- Defence in depth for hosted PostgreSQL (e.g. Supabase), which exposes the `public` schema over a REST API
-- keyed by a public "anon" key. Enabling Row Level Security with NO policies denies all access through that
-- API. The FinPilot backend connects directly as the table owner, which bypasses RLS, so the app is unaffected.
-- All tenant isolation is still enforced by the backend (workspace-scoped queries); this only closes the side door.
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces     ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;

-- Synthetic demo data ONLY. Re-runnable: wipes and reloads tenant data.
-- Two workspaces so cross-tenant isolation can be tested.
BEGIN;

TRUNCATE audit_events, chat_messages, chat_sessions, payments, payment_drafts, invoices,
         transactions, vendors, accounts, memberships, workspaces, users CASCADE;

INSERT INTO users (id, auth_subject, email, display_name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'demo-user-1',  'demo@finpilot.example',  'Demo Admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'demo-user-2',  'rival@finpilot.example', 'Rival Owner'),
  ('00000000-0000-0000-0000-0000000000c1', 'demo-viewer',  'viewer@finpilot.example', 'Read-only Viewer');

INSERT INTO workspaces (id, name) VALUES
  ('00000000-0000-0000-0000-00000000aaaa', 'Acme Robotics (Demo)'),
  ('00000000-0000-0000-0000-00000000bbbb', 'Rival Co (Demo)');

INSERT INTO memberships (user_id, workspace_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000aaaa', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000bbbb', 'owner'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'viewer');

INSERT INTO accounts (id, workspace_id, name, kind, balance_minor) VALUES
  ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000aaaa', 'Operating Account', 'checking', 18425000),
  ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-00000000aaaa', 'Reserve Savings',   'savings',  52000000),
  ('00000000-0000-0000-0000-00000000ac03', '00000000-0000-0000-0000-00000000aaaa', 'Corporate Card',    'credit',   -1284050),
  ('00000000-0000-0000-0000-00000000ac11', '00000000-0000-0000-0000-00000000bbbb', 'Rival Operating',   'checking', 99900000);

-- Vendors (workspace A). Deterministic ids: ...0000000v01 .. v12
INSERT INTO vendors (id, workspace_id, name, category, contact_email, contact_phone)
SELECT ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0') || '')::uuid,
       '00000000-0000-0000-0000-00000000aaaa', name, category, email, '+1-555-01' || lpad((n + 9)::text, 2, '0')
FROM (VALUES
  (1,  'AWS',                 'Cloud Infrastructure', 'billing@aws.example'),
  (2,  'ABC Vendors',         'Office Supplies',      'accounts@abc-vendors.example'),
  (3,  'Northwind Logistics', 'Shipping',             'ar@northwind.example'),
  (4,  'Globex Payroll',      'Payroll',              'support@globex.example'),
  (5,  'Initech Software',    'Software',             'billing@initech.example'),
  (6,  'Umbrella Legal',      'Legal',                'invoices@umbrella.example'),
  (7,  'Stark Facilities',    'Facilities',           'ar@stark.example'),
  (8,  'Wayne Marketing',     'Marketing',            'billing@wayne.example'),
  (9,  'Hooli Cloud Tools',   'Software',             'pay@hooli.example'),
  (10, 'Wonka Catering',      'Meals',                'orders@wonka.example'),
  (11, 'Cyberdyne Hardware',  'Equipment',            'sales@cyberdyne.example'),
  (12, 'Soylent Utilities',   'Utilities',            'billing@soylent.example')
) AS v(n, name, category, email);

INSERT INTO vendors (id, workspace_id, name, category, contact_email, contact_phone) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000bbbb', 'Rival Supplier', 'Office Supplies', 'x@rival.example', '+1-555-0199');

-- Outflows: one per vendor per month, Jun-Nov 2026 (deterministic amounts).
INSERT INTO transactions (workspace_id, account_id, vendor_id, txn_date, description, category, txn_type, amount_minor)
SELECT '00000000-0000-0000-0000-00000000aaaa',
       CASE WHEN v.n % 4 = 1 THEN '00000000-0000-0000-0000-00000000ac03'::uuid ELSE '00000000-0000-0000-0000-00000000ac01'::uuid END,
       ('00000000-0000-0000-0000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
       (m.month_start + ((v.n * 2 + 2) % 27) * INTERVAL '1 day')::date,
       v.name || ' — ' || to_char(m.month_start, 'YYYY-MM') || ' services',
       v.category, 'outflow',
       ((CASE v.category WHEN 'Payroll' THEN 4200000 WHEN 'Cloud Infrastructure' THEN 110000 ELSE 40000 END)
          * (100 + (abs(hashtext(v.name || m.month_start::text)) % 40)) / 100 / 100) * 100
FROM (VALUES
  (1,'AWS','Cloud Infrastructure'),(2,'ABC Vendors','Office Supplies'),(3,'Northwind Logistics','Shipping'),
  (4,'Globex Payroll','Payroll'),(5,'Initech Software','Software'),(6,'Umbrella Legal','Legal'),
  (7,'Stark Facilities','Facilities'),(8,'Wayne Marketing','Marketing'),(9,'Hooli Cloud Tools','Software'),
  (10,'Wonka Catering','Meals'),(11,'Cyberdyne Hardware','Equipment'),(12,'Soylent Utilities','Utilities')
) AS v(n, name, category)
CROSS JOIN (SELECT generate_series(date '2026-06-01', date '2026-11-01', interval '1 month')::date AS month_start) m
WHERE NOT (m.month_start = date '2026-11-01' AND v.n > 8);

-- Inflows: customer payments every ~6 days.
INSERT INTO transactions (workspace_id, account_id, vendor_id, txn_date, description, category, txn_type, amount_minor)
SELECT '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000ac01', NULL, d::date,
       'Customer payment', 'Revenue', 'inflow',
       (900000 + (abs(hashtext(d::text)) % 1400000) / 100 * 100)
FROM generate_series(date '2026-06-02', date '2026-11-13', interval '6 days') d;

-- A transaction in the rival workspace that must never leak.
INSERT INTO transactions (workspace_id, account_id, vendor_id, txn_date, description, category, txn_type, amount_minor) VALUES
  ('00000000-0000-0000-0000-00000000bbbb', '00000000-0000-0000-0000-00000000ac11', '00000000-0000-0000-0000-0000000000f1',
   '2026-11-01', 'RIVAL SECRET PURCHASE', 'Office Supplies', 'outflow', 777700);

INSERT INTO invoices (workspace_id, vendor_id, number, issue_date, due_date, amount_minor, status)
SELECT '00000000-0000-0000-0000-00000000aaaa', ('00000000-0000-0000-0000-0000000000' || lpad(vn::text, 2, '0'))::uuid, num,
       issue::date, due::date, amt, status
FROM (VALUES
  ('INV-1001', 1,  '2026-09-20', '2026-10-20', 125000, 'overdue'),
  ('INV-1002', 2,  '2026-10-30', '2026-11-20',  50000, 'unpaid'),
  ('INV-1003', 5,  '2026-10-25', '2026-11-24',  84000, 'unpaid'),
  ('INV-1004', 6,  '2026-10-02', '2026-11-01', 360000, 'overdue'),
  ('INV-1005', 3,  '2026-09-01', '2026-09-30',  72500, 'paid'),
  ('INV-1006', 8,  '2026-11-08', '2026-12-08', 210000, 'draft'),
  ('INV-1007', 9,  '2026-11-02', '2026-11-27',  39900, 'unpaid'),
  ('INV-1008', 12, '2026-10-10', '2026-11-09',  18800, 'paid'),
  ('INV-1009', 11, '2026-11-10', '2026-12-10', 640000, 'draft'),
  ('INV-1010', 7,  '2026-10-15', '2026-11-18', 158000, 'unpaid')
) AS i(num, vn, issue, due, amt, status);

INSERT INTO audit_events (workspace_id, actor, action, target, status, created_at) VALUES
  ('00000000-0000-0000-0000-00000000aaaa', 'Demo Admin', 'seed.loaded', 'demo', 'succeeded', '2026-11-14T09:00:00Z');

COMMIT;

-- | All SQL lives here. Every query is parameterized and every tenant-owned query is scoped by
-- workspace_id taken from the verified 'Ctx' (never from request bodies, the model, or the browser).
-- Query text is static; user input only ever travels as bound parameters.
module FinPilot.Database.Queries
  ( TxnFilter (..)
  , resolveCtx
  , getAccounts
  , getDashboard
  , searchTransactions
  , getTransaction
  , listCategories
  , listVendors
  , getVendor
  , listInvoices
  , insertInvoice
  , listPayments
  , listDrafts
  , getDraft
  , getPaymentByKey
  , getPaymentById
  , listAudit
  , insertAudit
  , vendorExists
  , sumOutflows
  , outflowsByCategory
  , findVendors
  , topVendorSpend
  , cashFlowBy
  , listInvoicesFiltered
  , defaultSourceAccount
  , ensureSession
  , recentMessages
  , insertMessage
  , recentUserMessageCount
  , listConversations
  , conversationMessages
  ) where

import Data.Aeson (Value, object)
import Data.Int (Int64)
import Data.Text (Text)
import qualified Data.Text as T
import Data.Time (Day)
import Data.UUID (UUID)
import Database.PostgreSQL.Simple
import Database.PostgreSQL.Simple.ToField (Action, toField)
import FinPilot.Domain.Finance (netCashFlow, sumCents)
import FinPilot.Domain.Validation (escapeLike)
import FinPilot.Types

-- | Resolve the user and workspace from a verified JWT subject.
-- If a workspace is requested it must be one the user is a member of.
resolveCtx :: Connection -> Text -> Maybe UUID -> IO (Maybe Ctx)
resolveCtx conn subject wanted = do
  rows <-
    query
      conn
      "SELECT u.id, u.email, u.display_name, m.workspace_id, w.name, m.role \
      \FROM users u \
      \JOIN memberships m ON m.user_id = u.id \
      \JOIN workspaces w ON w.id = m.workspace_id \
      \WHERE u.auth_subject = ? AND (?::uuid IS NULL OR m.workspace_id = ?) \
      \ORDER BY w.created_at, w.id LIMIT 1"
      (subject, wanted, wanted)
  pure $ case rows of
    [(uid, email, name, wid, wname, r)] -> Ctx uid email name wid wname <$> parseRole r
    _ -> Nothing

getAccounts :: Connection -> UUID -> IO [AccountRow]
getAccounts conn ws =
  query
    conn
    "SELECT id, name, kind, balance_minor, currency::text FROM accounts WHERE workspace_id = ? ORDER BY name"
    (Only ws)

getDashboard :: Connection -> UUID -> IO DashboardResp
getDashboard conn ws = do
  balances <- query conn "SELECT balance_minor FROM accounts WHERE workspace_id = ?" (Only ws)
  monthly <-
    query
      conn
      "SELECT to_char(date_trunc('month', txn_date), 'YYYY-MM'), \
      \COALESCE(SUM(amount_minor) FILTER (WHERE txn_type = 'inflow'), 0)::bigint, \
      \COALESCE(SUM(amount_minor) FILTER (WHERE txn_type = 'outflow'), 0)::bigint \
      \FROM transactions WHERE workspace_id = ? GROUP BY 1 ORDER BY 1 DESC LIMIT 12"
      (Only ws)
  categories <-
    query
      conn
      "SELECT category, SUM(amount_minor)::bigint FROM transactions \
      \WHERE workspace_id = ? AND txn_type = 'outflow' \
      \AND txn_date >= (SELECT COALESCE(max(txn_date), CURRENT_DATE) - INTERVAL '6 months' FROM transactions WHERE workspace_id = ?) \
      \GROUP BY category ORDER BY 2 DESC"
      (ws, ws)
  recent <- query conn (txnSelect <> txnFrom <> " WHERE t.workspace_id = ? ORDER BY t.txn_date DESC, t.id DESC LIMIT 6") (Only ws)
  -- "Current month" = the latest month that has data, so the seeded demo never goes stale.
  let monthsAsc = reverse (monthly :: [MonthlyPoint])
      (inc, out) = case reverse monthsAsc of
        (m : _) -> (m.inflow_minor, m.outflow_minor)
        [] -> (0, 0)
  pure
    DashboardResp
      { total_balance_minor = sumCents (map fromOnly balances)
      , month_income_minor = inc
      , month_expense_minor = out
      , month_net_minor = netCashFlow inc out
      , monthly = monthsAsc
      , categories = categories
      , recent = recent
      }

data TxnFilter = TxnFilter
  { tfSearch :: Maybe Text
  , tfType :: Maybe Text
  , tfCategory :: Maybe Text
  , tfVendor :: Maybe UUID
  , tfMin :: Maybe Int64
  , tfMax :: Maybe Int64
  , tfFrom :: Maybe Day
  , tfTo :: Maybe Day
  , tfPage :: Int
  , tfPageSize :: Int
  }

txnSelect :: Query
txnSelect =
  "SELECT t.id, t.txn_date, t.description, t.vendor_id, v.name, t.category, t.txn_type, \
  \t.amount_minor, t.account_id, t.currency::text "

txnFrom :: Query
txnFrom = "FROM transactions t LEFT JOIN vendors v ON v.id = t.vendor_id AND v.workspace_id = t.workspace_id "

txnWhere :: Query
txnWhere =
  "WHERE t.workspace_id = ? \
  \AND (?::text IS NULL OR t.description ILIKE ? ESCAPE '\\' OR COALESCE(v.name, '') ILIKE ? ESCAPE '\\') \
  \AND (?::text IS NULL OR t.txn_type = ?) \
  \AND (?::text IS NULL OR t.category = ?) \
  \AND (?::uuid IS NULL OR t.vendor_id = ?) \
  \AND (?::bigint IS NULL OR t.amount_minor >= ?) \
  \AND (?::bigint IS NULL OR t.amount_minor <= ?) \
  \AND (?::date IS NULL OR t.txn_date >= ?) \
  \AND (?::date IS NULL OR t.txn_date <= ?) "

txnParams :: UUID -> TxnFilter -> [Action]
txnParams ws f =
  let pat = (\s -> "%" <> escapeLike s <> "%") <$> f.tfSearch
   in [ toField ws
      , toField pat, toField pat, toField pat
      , toField f.tfType, toField f.tfType
      , toField f.tfCategory, toField f.tfCategory
      , toField f.tfVendor, toField f.tfVendor
      , toField f.tfMin, toField f.tfMin
      , toField f.tfMax, toField f.tfMax
      , toField f.tfFrom, toField f.tfFrom
      , toField f.tfTo, toField f.tfTo
      ]

searchTransactions :: Connection -> UUID -> TxnFilter -> IO ([TxnRow], Int64)
searchTransactions conn ws f = do
  let params = txnParams ws f
  [Only total] <- query conn ("SELECT count(*)::bigint " <> txnFrom <> txnWhere) params
  rows <-
    query
      conn
      (txnSelect <> txnFrom <> txnWhere <> "ORDER BY t.txn_date DESC, t.id DESC LIMIT ? OFFSET ?")
      (params ++ [toField f.tfPageSize, toField ((f.tfPage - 1) * f.tfPageSize)])
  pure (rows, total)

getTransaction :: Connection -> UUID -> UUID -> IO (Maybe TxnRow)
getTransaction conn ws tid = do
  rows <- query conn (txnSelect <> txnFrom <> "WHERE t.workspace_id = ? AND t.id = ?") (ws, tid)
  pure $ case rows of [r] -> Just r; _ -> Nothing

listCategories :: Connection -> UUID -> IO [Text]
listCategories conn ws =
  map fromOnly <$> query conn "SELECT DISTINCT category FROM transactions WHERE workspace_id = ? ORDER BY category" (Only ws)

vendorSelect :: Query
vendorSelect =
  "SELECT v.id, v.name, v.category, v.contact_email, v.contact_phone, \
  \COALESCE(SUM(t.amount_minor) FILTER (WHERE t.txn_type = 'outflow'), 0)::bigint, \
  \COUNT(t.id)::bigint \
  \FROM vendors v LEFT JOIN transactions t ON t.vendor_id = v.id AND t.workspace_id = v.workspace_id \
  \WHERE v.workspace_id = ? "

listVendors :: Connection -> UUID -> IO [VendorRow]
listVendors conn ws = query conn (vendorSelect <> "GROUP BY v.id ORDER BY v.name") (Only ws)

getVendor :: Connection -> UUID -> UUID -> IO (Maybe VendorDetail)
getVendor conn ws vid = do
  vs <- query conn (vendorSelect <> "AND v.id = ? GROUP BY v.id") (ws, vid)
  case vs of
    [v] -> do
      ts <-
        query
          conn
          (txnSelect <> txnFrom <> "WHERE t.workspace_id = ? AND t.vendor_id = ? ORDER BY t.txn_date DESC, t.id DESC LIMIT 200")
          (ws, vid)
      pure (Just (VendorDetail v ts))
    _ -> pure Nothing

vendorExists :: Connection -> UUID -> UUID -> IO Bool
vendorExists conn ws vid = do
  rs <- query conn "SELECT 1 FROM vendors WHERE workspace_id = ? AND id = ?" (ws, vid) :: IO [Only Int]
  pure (not (null rs))

invoiceSelect :: Query
invoiceSelect =
  "SELECT i.id, i.number, i.vendor_id, v.name, i.issue_date, i.due_date, i.amount_minor, i.currency::text, i.status \
  \FROM invoices i JOIN vendors v ON v.id = i.vendor_id AND v.workspace_id = i.workspace_id "

listInvoices :: Connection -> UUID -> IO [InvoiceRow]
listInvoices conn ws =
  query conn (invoiceSelect <> "WHERE i.workspace_id = ? ORDER BY i.due_date DESC, i.number DESC LIMIT 200") (Only ws)

-- | Creates the invoice and its audit event atomically. The vendor must belong to the workspace.
insertInvoice :: Connection -> Ctx -> NewInvoice -> Day -> IO (Maybe InvoiceRow)
insertInvoice conn ctx inv today = withTransaction conn $ do
  ok <- vendorExists conn ctx.workspaceId inv.vendor_id
  if not ok
    then pure Nothing
    else do
      _ <- query conn "SELECT pg_advisory_xact_lock(hashtext(?::text)) IS NOT NULL" (Only ctx.workspaceId) :: IO [Only Bool]
      [Only num] <-
        query
          conn
          "SELECT 'INV-' || (COALESCE(MAX(substring(number from 5)::int), 1000) + 1)::text \
          \FROM invoices WHERE workspace_id = ? AND number ~ '^INV-[0-9]+$'"
          (Only ctx.workspaceId)
      [Only iid] <-
        query
          conn
          "INSERT INTO invoices (workspace_id, vendor_id, number, issue_date, due_date, amount_minor, status) \
          \VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
          (ctx.workspaceId, inv.vendor_id, num :: Text, today, inv.due_date, inv.amount_minor, inv.status)
      insertAudit conn ctx.workspaceId ctx.userName "invoice.created" num "succeeded" (object [])
      rows <- query conn (invoiceSelect <> "WHERE i.workspace_id = ? AND i.id = ?") (ctx.workspaceId, iid :: UUID)
      pure $ case rows of [r] -> Just r; _ -> Nothing

listPayments :: Connection -> UUID -> IO [PaymentRow]
listPayments conn ws =
  query
    conn
    "SELECT p.id, p.draft_id, v.name, p.amount_minor, p.currency::text, p.executed_at \
    \FROM payments p JOIN vendors v ON v.id = p.vendor_id AND v.workspace_id = p.workspace_id \
    \WHERE p.workspace_id = ? ORDER BY p.executed_at DESC LIMIT 100"
    (Only ws)

draftSelect :: Query
draftSelect =
  "SELECT d.id, d.vendor_id, v.name, d.amount_minor, d.currency::text, d.source_account_id, a.name, \
  \d.memo, d.execution_date, d.status, d.created_at \
  \FROM payment_drafts d \
  \JOIN vendors v ON v.id = d.vendor_id AND v.workspace_id = d.workspace_id \
  \JOIN accounts a ON a.id = d.source_account_id AND a.workspace_id = d.workspace_id "

listDrafts :: Connection -> UUID -> IO [DraftRow]
listDrafts conn ws =
  query conn (draftSelect <> "WHERE d.workspace_id = ? ORDER BY d.created_at DESC LIMIT 100") (Only ws)

getDraft :: Connection -> UUID -> UUID -> IO (Maybe DraftRow)
getDraft conn ws did = do
  rows <- query conn (draftSelect <> "WHERE d.workspace_id = ? AND d.id = ?") (ws, did)
  pure $ case rows of [r] -> Just r; _ -> Nothing

paymentSelect :: Query
paymentSelect =
  "SELECT p.id, p.draft_id, v.name, p.amount_minor, p.currency::text, p.executed_at \
  \FROM payments p JOIN vendors v ON v.id = p.vendor_id AND v.workspace_id = p.workspace_id "

getPaymentByKey :: Connection -> UUID -> Text -> IO (Maybe PaymentRow)
getPaymentByKey conn ws key = do
  rows <- query conn (paymentSelect <> "WHERE p.workspace_id = ? AND p.idempotency_key = ?") (ws, key)
  pure $ case rows of [r] -> Just r; _ -> Nothing

getPaymentById :: Connection -> UUID -> UUID -> IO (Maybe PaymentRow)
getPaymentById conn ws pid = do
  rows <- query conn (paymentSelect <> "WHERE p.workspace_id = ? AND p.id = ?") (ws, pid)
  pure $ case rows of [r] -> Just r; _ -> Nothing

listAudit :: Connection -> UUID -> IO [AuditRow]
listAudit conn ws =
  query
    conn
    "SELECT id, created_at, actor, action, target, status FROM audit_events \
    \WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 200"
    (Only ws)

-- ---------- aggregates used by AI tools ----------

-- | Total outflow and count in [from, to], optionally for one vendor and/or category.
sumOutflows :: Connection -> UUID -> Day -> Day -> Maybe UUID -> Maybe Text -> IO (Cents, Int64)
sumOutflows conn ws from to vendor category = do
  rows <-
    query
      conn
      "SELECT COALESCE(SUM(amount_minor), 0)::bigint, COUNT(*)::bigint FROM transactions \
      \WHERE workspace_id = ? AND txn_type = 'outflow' AND txn_date >= ? AND txn_date <= ? \
      \AND (?::uuid IS NULL OR vendor_id = ?) AND (?::text IS NULL OR category = ?)"
      (ws, from, to, vendor, vendor, category, category)
  pure $ case rows of [r] -> r; _ -> (0, 0)

outflowsByCategory :: Connection -> UUID -> Day -> Day -> IO [(Text, Cents)]
outflowsByCategory conn ws from to =
  query
    conn
    "SELECT category, SUM(amount_minor)::bigint FROM transactions \
    \WHERE workspace_id = ? AND txn_type = 'outflow' AND txn_date >= ? AND txn_date <= ? \
    \GROUP BY category ORDER BY 2 DESC LIMIT 15"
    (ws, from, to)

-- | Vendors whose name matches (case-insensitive substring), exact matches first. Max 5.
findVendors :: Connection -> UUID -> Text -> IO [(UUID, Text)]
findVendors conn ws needle =
  query
    conn
    "SELECT id, name FROM vendors WHERE workspace_id = ? AND name ILIKE ? ESCAPE '\\' \
    \ORDER BY (lower(name) = lower(?)) DESC, name LIMIT 5"
    (ws, "%" <> escapeLike needle <> "%", needle)

topVendorSpend :: Connection -> UUID -> Day -> Day -> Int -> IO [(Text, Cents)]
topVendorSpend conn ws from to n =
  query
    conn
    "SELECT v.name, SUM(t.amount_minor)::bigint FROM transactions t \
    \JOIN vendors v ON v.id = t.vendor_id AND v.workspace_id = t.workspace_id \
    \WHERE t.workspace_id = ? AND t.txn_type = 'outflow' AND t.txn_date >= ? AND t.txn_date <= ? \
    \GROUP BY v.name ORDER BY 2 DESC, v.name LIMIT ?"
    (ws, from, to, n)

-- | unit must be one of day|week|month (validated by the caller; also bound as a parameter).
cashFlowBy :: Connection -> UUID -> Day -> Day -> Text -> IO [(Text, Cents, Cents)]
cashFlowBy conn ws from to unit =
  query
    conn
    "SELECT to_char(date_trunc(?, txn_date), 'YYYY-MM-DD'), \
    \COALESCE(SUM(amount_minor) FILTER (WHERE txn_type = 'inflow'), 0)::bigint, \
    \COALESCE(SUM(amount_minor) FILTER (WHERE txn_type = 'outflow'), 0)::bigint \
    \FROM transactions WHERE workspace_id = ? AND txn_date >= ? AND txn_date <= ? \
    \GROUP BY 1 ORDER BY 1 LIMIT 60"
    (unit, ws, from, to)

listInvoicesFiltered :: Connection -> UUID -> Maybe Text -> Maybe Day -> Maybe Day -> Int -> IO [InvoiceRow]
listInvoicesFiltered conn ws status dueFrom dueTo lim =
  query
    conn
    ( invoiceSelect
        <> "WHERE i.workspace_id = ? AND (?::text IS NULL OR i.status = ?) \
           \AND (?::date IS NULL OR i.due_date >= ?) AND (?::date IS NULL OR i.due_date <= ?) \
           \ORDER BY i.due_date, i.number LIMIT ?"
    )
    (ws, status, status, dueFrom, dueFrom, dueTo, dueTo, lim)

-- | The workspace's default funding account for drafts: the first non-credit account (checking first).
defaultSourceAccount :: Connection -> UUID -> IO (Maybe UUID)
defaultSourceAccount conn ws = do
  rows <-
    query
      conn
      "SELECT id FROM accounts WHERE workspace_id = ? AND kind <> 'credit' \
      \ORDER BY (kind = 'checking') DESC, name LIMIT 1"
      (Only ws)
  pure $ case rows of [Only a] -> Just a; _ -> Nothing

-- ---------- chat persistence ----------

-- | Returns the session id if it belongs to this user in this workspace; creates one when none requested.
ensureSession :: Connection -> Ctx -> Maybe UUID -> IO (Maybe UUID)
ensureSession conn ctx = \case
  Nothing -> do
    [Only sid] <- query conn "INSERT INTO chat_sessions (workspace_id, user_id) VALUES (?, ?) RETURNING id" (ctx.workspaceId, ctx.userId)
    pure (Just sid)
  Just sid -> do
    rows <- query conn "SELECT id FROM chat_sessions WHERE id = ? AND workspace_id = ? AND user_id = ?" (sid, ctx.workspaceId, ctx.userId)
    pure $ case rows of [Only s] -> Just s; _ -> Nothing

recentMessages :: Connection -> UUID -> Int -> IO [(Text, Text)]
recentMessages conn sid n =
  reverse
    <$> query
      conn
      "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT ?"
      (sid, n)

insertMessage :: Connection -> Ctx -> UUID -> Text -> Text -> Value -> IO UUID
insertMessage conn ctx sid role' content blocks = do
  [Only mid] <-
    query
      conn
      "INSERT INTO chat_messages (session_id, workspace_id, role, content, ui_blocks) VALUES (?, ?, ?, ?, ?) RETURNING id"
      (sid, ctx.workspaceId, role', T.take 8000 content, blocks)
  pure mid

-- | Number of user messages this user sent in the last minute (simple abuse/rate guard).
recentUserMessageCount :: Connection -> Ctx -> IO Int
recentUserMessageCount conn ctx = do
  [Only n] <-
    query
      conn
      "SELECT count(*)::int FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id \
      \WHERE s.workspace_id = ? AND s.user_id = ? AND m.role = 'user' AND m.created_at > now() - interval '1 minute'"
      (ctx.workspaceId, ctx.userId)
  pure n

listConversations :: Connection -> Ctx -> IO [ConversationRow]
listConversations conn ctx =
  query
    conn
    "SELECT s.id, s.created_at, COALESCE((SELECT left(content, 80) FROM chat_messages m WHERE m.session_id = s.id AND m.role = 'user' \
    \ORDER BY m.created_at LIMIT 1), '') \
    \FROM chat_sessions s WHERE s.workspace_id = ? AND s.user_id = ? ORDER BY s.created_at DESC LIMIT 50"
    (ctx.workspaceId, ctx.userId)

conversationMessages :: Connection -> Ctx -> UUID -> IO (Maybe [MessageRow])
conversationMessages conn ctx sid = do
  owned <- ensureSession conn ctx (Just sid)
  case owned of
    Nothing -> pure Nothing
    Just _ ->
      Just
        <$> query
          conn
          "SELECT id, role, content, ui_blocks, created_at FROM chat_messages \
          \WHERE session_id = ? AND workspace_id = ? ORDER BY created_at, id LIMIT 200"
          (sid, ctx.workspaceId)

-- | Metadata must be safe: never secrets, tokens, or raw prompts.
insertAudit :: Connection -> UUID -> Text -> Text -> Text -> Text -> Value -> IO ()
insertAudit conn ws actor action target status meta = do
  _ <-
    execute
      conn
      "INSERT INTO audit_events (workspace_id, actor, action, target, status, metadata) VALUES (?, ?, ?, ?, ?, ?)"
      (ws, T.take 200 actor, T.take 100 action, T.take 200 target, status, meta)
  pure ()

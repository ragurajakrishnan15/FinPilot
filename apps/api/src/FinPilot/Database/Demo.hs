-- | Demo-only maintenance: put the caller's workspace back to its seeded state.
--
-- Everything runs in one transaction and is scoped to the workspace from the verified 'Ctx'. The audit log is
-- append-only and is NOT deleted; a `demo.reset` event with counts is appended instead.
--
-- What "seeded state" means here (the seed contains no payments, drafts or conversations):
--   * payments and payment drafts are removed, and executed payments are refunded to their source accounts;
--   * the ledger rows that executed payments created ("Simulated payment to ...") are removed;
--   * invoices created through the API (recorded in the audit log as `invoice.created`) are removed;
--   * chat sessions and messages are removed.
module FinPilot.Database.Demo
  ( ResetError (..)
  , resetDemoWorkspace
  ) where

import Data.Aeson (object, (.=))
import Data.Int (Int64)
import Database.PostgreSQL.Simple (Connection, Only (..), execute, query, withTransaction)
import FinPilot.Database.Queries (insertAudit)
import FinPilot.Types

data ResetError = ResetTooSoon
  deriving stock (Show, Eq)

-- | Minimum seconds between resets of the same workspace (a reset is cheap but should not be spammable).
cooldownSeconds :: Int
cooldownSeconds = 30

resetDemoWorkspace :: Connection -> Ctx -> IO (Either ResetError ResetResp)
resetDemoWorkspace conn ctx = withTransaction conn $ do
  let ws = ctx.workspaceId
  -- Serialize resets (and invoice numbering) per workspace.
  _ <- query conn "SELECT pg_advisory_xact_lock(hashtext(?::text)) IS NOT NULL" (Only ws) :: IO [Only Bool]
  [Only recent] <-
    query
      conn
      "SELECT count(*)::bigint FROM audit_events \
      \WHERE workspace_id = ? AND action = 'demo.reset' AND created_at > now() - make_interval(secs => ?)"
      (ws, cooldownSeconds) :: IO [Only Int64]
  if recent > 0
    then pure (Left ResetTooSoon)
    else do
      -- Refund executed payments to their source accounts before the rows that describe them are deleted.
      _ <-
        execute
          conn
          "UPDATE accounts a SET balance_minor = a.balance_minor + s.total \
          \FROM (SELECT d.source_account_id AS aid, SUM(p.amount_minor) AS total \
          \      FROM payments p JOIN payment_drafts d ON d.id = p.draft_id \
          \      WHERE p.workspace_id = ? GROUP BY d.source_account_id) s \
          \WHERE a.id = s.aid AND a.workspace_id = ?"
          (ws, ws)
      txns <- execute conn "DELETE FROM transactions WHERE workspace_id = ? AND description LIKE 'Simulated payment to %'" (Only ws)
      pays <- execute conn "DELETE FROM payments WHERE workspace_id = ?" (Only ws)
      drafts <- execute conn "DELETE FROM payment_drafts WHERE workspace_id = ?" (Only ws)
      invs <-
        execute
          conn
          "DELETE FROM invoices WHERE workspace_id = ? \
          \AND number IN (SELECT target FROM audit_events WHERE workspace_id = ? AND action = 'invoice.created')"
          (ws, ws)
      convs <- execute conn "DELETE FROM chat_sessions WHERE workspace_id = ?" (Only ws) -- messages cascade
      let resp =
            ResetResp
              { payments_removed = fromIntegral pays
              , drafts_removed = fromIntegral drafts
              , invoices_removed = fromIntegral invs
              , ledger_entries_removed = fromIntegral txns
              , conversations_removed = fromIntegral convs
              }
      insertAudit
        conn
        ws
        ctx.userName
        "demo.reset"
        "workspace"
        "succeeded"
        ( object
            [ "payments_removed" .= resp.payments_removed
            , "drafts_removed" .= resp.drafts_removed
            , "invoices_removed" .= resp.invoices_removed
            , "ledger_entries_removed" .= resp.ledger_entries_removed
            , "conversations_removed" .= resp.conversations_removed
            ]
        )
      pure (Right resp)

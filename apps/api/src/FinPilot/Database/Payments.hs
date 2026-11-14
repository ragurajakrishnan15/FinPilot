-- | Simulated payment workflow. Creating a payment only ever creates a DRAFT.
-- Execution happens only in 'confirmDraft', which re-validates everything server-side inside one
-- transaction: draft row lock, account row lock, balance update, payment + ledger rows, draft state
-- change and audit event. Money never moves outside the database: this is a simulation.
module FinPilot.Database.Payments
  ( PayError (..)
  , createDraft
  , cancelDraft
  , confirmDraft
  ) where

import Control.Exception (throw, try)
import Data.Aeson (object, (.=))
import qualified Data.Map.Strict as M
import Data.Text (Text)
import qualified Data.Text as T
import Data.Time (Day)
import Data.UUID (UUID)
import Database.PostgreSQL.Simple
import Database.PostgreSQL.Simple.Errors (ConstraintViolation (..), constraintViolation)
import FinPilot.Database.Queries (getDraft, getPaymentById, getPaymentByKey, insertAudit)
import FinPilot.Domain.Finance (canAfford)
import FinPilot.Domain.Validation (validateAmount, validateMemo)
import FinPilot.Types

data PayError
  = PayNotFound
  | PayInvalidState Text
  | PayInsufficientFunds
  | PayKeyReuse
  | PayValidation (M.Map Text Text)
  deriving stock (Show, Eq)

-- | Creates a draft (status pending_confirmation). Never moves money.
createDraft :: Connection -> Ctx -> NewDraft -> Day -> IO (Either PayError DraftRow)
createDraft conn ctx nd today = withTransaction conn $ do
  let ws = ctx.workspaceId
  vend <- query conn "SELECT 1 FROM vendors WHERE workspace_id = ? AND id = ?" (ws, nd.vendor_id) :: IO [Only Int]
  acct <- query conn "SELECT kind FROM accounts WHERE workspace_id = ? AND id = ?" (ws, nd.source_account_id) :: IO [Only Text]
  let errs =
        M.fromList $
          [("amount_minor", m) | Left m <- [validateAmount nd.amount_minor]]
            ++ [("memo", m) | Left m <- [validateMemo nd.memo]]
            ++ [("vendor_id", "Unknown vendor") | null vend]
            ++ [("source_account_id", "Unknown account") | null acct]
            ++ [("source_account_id", "Payments cannot be made from a credit account") | acct == [Only "credit"]]
  if not (M.null errs)
    then pure (Left (PayValidation errs))
    else do
      let memo' = either (const "") id (validateMemo nd.memo)
      [Only did] <-
        query
          conn
          "INSERT INTO payment_drafts (workspace_id, vendor_id, source_account_id, amount_minor, memo, execution_date, status, created_by) \
          \VALUES (?, ?, ?, ?, ?, ?, 'pending_confirmation', ?) RETURNING id"
          (ws, nd.vendor_id, nd.source_account_id, nd.amount_minor, memo', today, ctx.userId)
      insertAudit conn ws ctx.userName "payment_draft.created" (T.pack (show (did :: UUID))) "succeeded" (object ["amount_minor" .= nd.amount_minor])
      d <- getDraft conn ws did
      pure (maybe (Left PayNotFound) Right d)

cancelDraft :: Connection -> Ctx -> UUID -> IO (Either PayError DraftRow)
cancelDraft conn ctx did = withTransaction conn $ do
  let ws = ctx.workspaceId
  rows <- query conn "SELECT status FROM payment_drafts WHERE workspace_id = ? AND id = ? FOR UPDATE" (ws, did) :: IO [Only Text]
  case rows of
    [] -> pure (Left PayNotFound)
    [Only st]
      | st /= "pending_confirmation" -> do
          insertAudit conn ws ctx.userName "payment_draft.cancel_rejected" (tshow did) "rejected" (object ["status" .= st])
          pure (Left (PayInvalidState st))
      | otherwise -> do
          _ <- execute conn "UPDATE payment_drafts SET status = 'cancelled' WHERE workspace_id = ? AND id = ?" (ws, did)
          insertAudit conn ws ctx.userName "payment_draft.cancelled" (tshow did) "succeeded" (object [])
          d <- getDraft conn ws did
          pure (maybe (Left PayNotFound) Right d)
    _ -> pure (Left PayNotFound)

-- | Confirm and execute (simulated). Idempotent per (workspace, idempotency key).
confirmDraft :: Connection -> Ctx -> UUID -> Text -> Day -> IO (Either PayError PaymentRow)
confirmDraft conn ctx did key today = do
  r <- try (withTransaction conn confirmTx)
  pure $ case r of
    Right v -> v
    -- Two different drafts raced on one idempotency key: the unique constraint is the last line of defence.
    Left e | Just (UniqueViolation _) <- constraintViolation e -> Left PayKeyReuse
    Left e -> throw e
  where
    ws = ctx.workspaceId
    confirmTx = do
      -- 1. Lock the draft row first so concurrent confirmations of one draft are serialized.
      drafts <-
        query
          conn
          "SELECT status, vendor_id, source_account_id, amount_minor, memo FROM payment_drafts \
          \WHERE workspace_id = ? AND id = ? FOR UPDATE"
          (ws, did) ::
          IO [(Text, UUID, UUID, Cents, Text)]
      case drafts of
        [(st, vid, aid, amt, memo)] -> do
          -- 2. Idempotency: a replay of the same key for this draft returns the original receipt.
          prior <- getPaymentByKey conn ws key
          case prior of
            Just p
              | p.draft_id == did -> pure (Right p)
              | otherwise -> pure (Left PayKeyReuse)
            Nothing
              | st /= "pending_confirmation" -> do
                  insertAudit conn ws ctx.userName "payment.confirm_rejected" (tshow did) "rejected" (object ["status" .= st])
                  pure (Left (PayInvalidState st))
              | otherwise -> do
                  -- 3. Re-validate everything at confirmation time (never trust the draft as stored).
                  vend <- query conn "SELECT name, category FROM vendors WHERE workspace_id = ? AND id = ?" (ws, vid) :: IO [(Text, Text)]
                  acct <- query conn "SELECT balance_minor, kind FROM accounts WHERE workspace_id = ? AND id = ? FOR UPDATE" (ws, aid) :: IO [(Cents, Text)]
                  case (validateAmount amt, vend, acct) of
                    (Right _, [(vname, vcat)], [(bal, kind)])
                      | kind /= "credit" && canAfford bal amt -> execute' ws vid aid amt memo vname vcat
                      | otherwise -> reject ws PayInsufficientFunds "insufficient_funds"
                    _ -> reject ws (PayValidation (M.singleton "draft" "Draft is no longer valid")) "revalidation_failed"
        _ -> pure (Left PayNotFound)
    reject ws err reason = do
      _ <- execute conn "UPDATE payment_drafts SET status = 'rejected' WHERE workspace_id = ? AND id = ?" (ws, did)
      insertAudit conn ws ctx.userName "payment.rejected" (tshow did) "rejected" (object ["reason" .= (reason :: Text)])
      pure (Left err)
    execute' ws vid aid amt memo vname vcat = do
      _ <- execute conn "UPDATE accounts SET balance_minor = balance_minor - ? WHERE workspace_id = ? AND id = ?" (amt, ws, aid)
      [Only pid] <-
        query
          conn
          "INSERT INTO payments (workspace_id, draft_id, vendor_id, amount_minor, idempotency_key, executed_by) \
          \VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
          (ws, did, vid, amt, key, ctx.userId)
      _ <-
        execute
          conn
          "INSERT INTO transactions (workspace_id, account_id, vendor_id, txn_date, description, category, txn_type, amount_minor) \
          \VALUES (?, ?, ?, ?, ?, ?, 'outflow', ?)"
          (ws, aid, vid, today, "Simulated payment to " <> vname <> (if T.null memo then "" else " — " <> memo), vcat, amt)
      _ <- execute conn "UPDATE payment_drafts SET status = 'executed' WHERE workspace_id = ? AND id = ?" (ws, did)
      insertAudit conn ws ctx.userName "payment.executed" (tshow (pid :: UUID)) "succeeded" (object ["amount_minor" .= amt, "simulated" .= True])
      p <- getPaymentById conn ws pid
      pure (maybe (Left PayNotFound) Right p)

tshow :: Show a => a -> Text
tshow = T.pack . show

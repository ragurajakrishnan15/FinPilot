-- | HTTP handlers: thin glue between routes, validation, authorization and the database layer.
module FinPilot.Handlers
  ( Env (..)
  , server
  ) where

import Control.Exception (SomeException, try)
import Control.Monad (unless, when)
import Control.Monad.IO.Class (liftIO)
import Data.Char (isAlphaNum, isAscii)
import qualified Data.Map.Strict as M
import Data.Pool (Pool, withResource)
import Data.Text (Text)
import qualified Data.Text as T
import Data.Aeson (Value, toJSON)
import Data.Time (utctDay, getCurrentTime)
import Database.PostgreSQL.Simple (withTransaction)
import FinPilot.AI.AgentLoop (AgentResult (..), runAgent)
import FinPilot.AI.GroqClient (LlmClient, LlmError (..))
import Data.Time.Clock.POSIX (getPOSIXTime)
import Data.UUID (UUID)
import Database.PostgreSQL.Simple (Connection)
import FinPilot.Api
import FinPilot.Auth.Jwt
import FinPilot.Config
import qualified FinPilot.Database.Demo as Demo
import qualified FinPilot.Database.Payments as P
import qualified FinPilot.Database.Queries as Q
import FinPilot.Domain.Validation
import FinPilot.Error
import FinPilot.Types
import Servant
import System.IO (hPutStrLn, stderr)

data Env = Env {pool :: Pool Connection, config :: Config, llm :: LlmClient}

-- | Run a DB action. Errors are logged without detail that could leak data and surfaced as a generic 500.
runDb :: Env -> (Connection -> IO a) -> Handler a
runDb env act = do
  r <- liftIO (try (withResource env.pool act))
  case r of
    Right a -> pure a
    Left (e :: SomeException) -> do
      liftIO (hPutStrLn stderr ("database error: " <> takeWhile (/= '\n') (show e)))
      internalError

server :: Env -> Server API
server env = health :<|> (demoSession env :<|> protected env)

health :: Handler Health
health = pure (Health "ok")

-- | Demo-only: issues a short-lived token for the seeded demo user. Disabled unless DEMO_MODE=true.
demoSession :: Env -> Handler SessionToken
demoSession env = do
  unless env.config.demoMode (notFound "Route")
  now <- liftIO getPOSIXTime
  let ttl = 3600 :: Int
      claims = Claims {sub = "demo-user-1", exp_ = floor now + fromIntegral ttl, iss = env.config.jwtIssuer}
  pure (SessionToken (signJwt env.config.jwtSecret claims) ttl)

protected :: Env -> Ctx -> Server ProtectedAPI
protected env ctx =
  meH
    :<|> dashboardH
    :<|> accountsH
    :<|> categoriesH
    :<|> transactionsH
    :<|> transactionH
    :<|> vendorsH
    :<|> vendorH
    :<|> invoicesH
    :<|> createInvoiceH
    :<|> paymentsH
    :<|> draftsH
    :<|> createDraftH
    :<|> confirmDraftH
    :<|> cancelDraftH
    :<|> auditH
    :<|> commandH
    :<|> conversationsH
    :<|> conversationMessagesH
    :<|> demoResetH
  where
    ws = ctx.workspaceId
    meH =
      pure
        MeResp
          { user_id = ctx.userId
          , email = ctx.userEmail
          , display_name = ctx.userName
          , role = roleText ctx.role
          , workspace = WorkspaceRef ctx.workspaceId ctx.workspaceName
          }
    dashboardH = runDb env (`Q.getDashboard` ws)
    accountsH = runDb env (`Q.getAccounts` ws)
    categoriesH = runDb env (`Q.listCategories` ws)
    transactionsH search ty cat vendor mn mx from to page pageSize = do
      ty' <- traverse (either (\m -> validationError (M.singleton "type" m)) pure . validateTxnType) ty
      unless (validDateRange from to) (validationError (M.singleton "from" "From must not be after To"))
      when (maybe False (\(a, b) -> a > b) ((,) <$> mn <*> mx)) (validationError (M.singleton "min_minor" "Min must not exceed max"))
      let p = clampPage page
          ps = clampPageSize pageSize
          f = Q.TxnFilter search ty' cat vendor mn mx from to p ps
      (rows, total) <- runDb env (\c -> Q.searchTransactions c ws f)
      pure (PageResp rows total p ps)
    transactionH tid = runDb env (\c -> Q.getTransaction c ws tid) >>= maybe (notFound "Transaction") pure
    vendorsH = runDb env (`Q.listVendors` ws)
    vendorH vid = runDb env (\c -> Q.getVendor c ws vid) >>= maybe (notFound "Vendor") pure
    invoicesH = runDb env (`Q.listInvoices` ws)
    paymentsH = runDb env (`Q.listPayments` ws)
    draftsH = runDb env (`Q.listDrafts` ws)
    auditH = runDb env (`Q.listAudit` ws)
    requireWriter = unless (canWrite ctx.role) (forbidden "Your role cannot change payments")
    today = liftIO (utctDay <$> getCurrentTime)
    createDraftH :: NewDraft -> Handler DraftRow
    createDraftH nd = do
      requireWriter
      d <- today
      runDb env (\c -> P.createDraft c ctx nd d) >>= payResult
    confirmDraftH :: UUID -> Maybe Text -> Handler PaymentRow
    confirmDraftH did mkey = do
      requireWriter
      key <- case mkey of
        Just k | validIdempotencyKey k -> pure k
        _ -> validationError (M.singleton "Idempotency-Key" "Header required: 8-100 chars of letters, digits, '-' or '_'")
      d <- today
      runDb env (\c -> P.confirmDraft c ctx did key d) >>= payResult
    cancelDraftH :: UUID -> Handler DraftRow
    cancelDraftH did = do
      requireWriter
      runDb env (\c -> P.cancelDraft c ctx did) >>= payResult
    conversationsH = runDb env (`Q.listConversations` ctx)
    conversationMessagesH sid = runDb env (\c -> Q.conversationMessages c ctx sid) >>= maybe (notFound "Conversation") pure
    commandH :: CommandReq -> Handler CommandResp
    commandH req = do
      let text = T.strip req.message
      when (T.null text) (validationError (M.singleton "message" "Message is required"))
      when (T.length text > env.config.maxCommandInputChars) $
        validationError (M.singleton "message" ("Message is too long (max " <> T.pack (show env.config.maxCommandInputChars) <> " characters)"))
      -- Simple per-user rate limit so the LLM (and its quota) cannot be hammered.
      recent <- runDb env (`Q.recentUserMessageCount` ctx)
      when (recent >= 10) (apiError err429 "rate_limited" "You're sending messages too quickly. Please wait a moment." M.empty)
      sid <- runDb env (\c -> Q.ensureSession c ctx req.conversation_id) >>= maybe (notFound "Conversation") pure
      history <- runDb env (\c -> Q.recentMessages c sid 10)
      d <- today
      res <- liftIO (runAgent env.llm env.pool env.config.maxToolCallsPerTurn ctx d history text)
      case res of
        Left e -> llmFailure e
        Right r -> do
          mid <- runDb env $ \c -> withTransaction c $ do
            _ <- Q.insertMessage c ctx sid "user" text (toJSON ([] :: [Value]))
            Q.insertMessage c ctx sid "assistant" r.answer (toJSON r.uiBlocks)
          pure CommandResp {message_id = mid, conversation_id = sid, answer = r.answer, ui_blocks = r.uiBlocks, ui_blocks_version = 1, tool_activity = r.activity}
    -- Demo-only: restores this workspace to its seeded state. Hidden (404) unless DEMO_MODE=true.
    demoResetH :: Handler ResetResp
    demoResetH = do
      unless env.config.demoMode (notFound "Route")
      unless (ctx.role `elem` [Owner, Admin]) (forbidden "Only an owner or admin can reset the demo data")
      runDb env (\c -> Demo.resetDemoWorkspace c ctx) >>= \case
        Right r -> pure r
        Left Demo.ResetTooSoon -> apiError err429 "reset_too_soon" "The demo was reset a moment ago. Please wait a few seconds." M.empty
    createInvoiceH :: NewInvoice -> Handler InvoiceRow
    createInvoiceH inv = do
      unless (canWrite ctx.role) (forbidden "Your role cannot create invoices")
      let errs =
            M.fromList $
              [("amount_minor", m) | Left m <- [validateAmount inv.amount_minor]]
                ++ [("status", m) | Left m <- [validateInvoiceStatus inv.status]]
      unless (M.null errs) (validationError errs)
      today <- liftIO (utctDay <$> getCurrentTime)
      runDb env (\c -> Q.insertInvoice c ctx inv today) >>= maybe (validationError (M.singleton "vendor_id" "Unknown vendor")) pure

-- | Provider failures never leak provider details to the browser.
llmFailure :: LlmError -> Handler a
llmFailure e = do
  -- LlmError carries only a category or an HTTP status code: safe to log (no keys, prompts or bodies).
  liftIO (hPutStrLn stderr ("llm error: " <> show e))
  llmFailureResponse e

llmFailureResponse :: LlmError -> Handler a
llmFailureResponse = \case
  LlmNotConfigured -> serviceUnavailable "The AI assistant is not configured on this server."
  LlmRateLimited -> apiError err429 "rate_limited" "The AI provider is rate limiting requests. Please retry shortly." M.empty
  LlmTimeout -> apiError err504 "llm_timeout" "The AI assistant took too long to respond. Please try again." M.empty
  _ -> apiError err502 "llm_unavailable" "The AI assistant is temporarily unavailable. Please try again." M.empty

validIdempotencyKey :: Text -> Bool
validIdempotencyKey k = T.length k >= 8 && T.length k <= 100 && T.all (\c -> isAlphaNum c && isAscii c || c == '-' || c == '_') k

payResult :: Either P.PayError a -> Handler a
payResult = \case
  Right a -> pure a
  Left P.PayNotFound -> notFound "Payment draft"
  Left (P.PayInvalidState st) -> conflict "invalid_state" ("Draft is already " <> st)
  Left P.PayInsufficientFunds -> conflict "insufficient_funds" "Insufficient simulated balance"
  Left P.PayKeyReuse -> conflict "idempotency_key_reuse" "This Idempotency-Key was already used for a different draft"
  Left (P.PayValidation errs) -> validationError errs

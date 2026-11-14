-- | Servant route definitions only. No logic here.
module FinPilot.Api
  ( API
  , ProtectedAPI
  , api
  ) where

import Data.Int (Int64)
import Data.Text (Text)
import Data.Time (Day)
import Data.UUID (UUID)
import FinPilot.Types
import Servant
import Servant.Server.Experimental.Auth (AuthServerData)

type instance AuthServerData (AuthProtect "jwt") = Ctx

type ProtectedAPI =
  "me" :> Get '[JSON] MeResp
    :<|> "dashboard" :> Get '[JSON] DashboardResp
    :<|> "accounts" :> Get '[JSON] [AccountRow]
    :<|> "categories" :> Get '[JSON] [Text]
    :<|> "transactions"
      :> QueryParam "search" Text
      :> QueryParam "type" Text
      :> QueryParam "category" Text
      :> QueryParam "vendor_id" UUID
      :> QueryParam "min_minor" Int64
      :> QueryParam "max_minor" Int64
      :> QueryParam "from" Day
      :> QueryParam "to" Day
      :> QueryParam "page" Int
      :> QueryParam "page_size" Int
      :> Get '[JSON] (PageResp TxnRow)
    :<|> "transactions" :> Capture "id" UUID :> Get '[JSON] TxnRow
    :<|> "vendors" :> Get '[JSON] [VendorRow]
    :<|> "vendors" :> Capture "id" UUID :> Get '[JSON] VendorDetail
    :<|> "invoices" :> Get '[JSON] [InvoiceRow]
    :<|> "invoices" :> ReqBody '[JSON] NewInvoice :> PostCreated '[JSON] InvoiceRow
    :<|> "payments" :> Get '[JSON] [PaymentRow]
    :<|> "payment-drafts" :> Get '[JSON] [DraftRow]
    :<|> "payment-drafts" :> ReqBody '[JSON] NewDraft :> PostCreated '[JSON] DraftRow
    :<|> "payment-drafts" :> Capture "id" UUID :> "confirm" :> Header "Idempotency-Key" Text :> Post '[JSON] PaymentRow
    :<|> "payment-drafts" :> Capture "id" UUID :> "cancel" :> Post '[JSON] DraftRow
    :<|> "audit-events" :> Get '[JSON] [AuditRow]
    :<|> "command" :> ReqBody '[JSON] CommandReq :> Post '[JSON] CommandResp
    :<|> "conversations" :> Get '[JSON] [ConversationRow]
    :<|> "conversations" :> Capture "id" UUID :> "messages" :> Get '[JSON] [MessageRow]

type API =
  "health" :> Get '[JSON] Health
    :<|> "api"
      :> ( "demo-session" :> Post '[JSON] SessionToken
            :<|> AuthProtect "jwt" :> ProtectedAPI
         )

api :: Proxy API
api = Proxy

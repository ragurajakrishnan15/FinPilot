-- | API / domain types. Money is always 'Cents' (integer minor units).
-- JSON field names are snake_case and match apps/web/src/types/api.ts.
-- A trailing underscore on a field (id_, type_) is stripped in JSON.
module FinPilot.Types where

import Data.Aeson
import Data.Int (Int64)
import Data.Text (Text)
import Data.Time (Day, UTCTime)
import Data.UUID (UUID)
import Database.PostgreSQL.Simple.FromField (FromField)
import Database.PostgreSQL.Simple.FromRow (FromRow (..), field)
import Database.PostgreSQL.Simple.ToField (ToField)
import GHC.Generics (Generic)

newtype Cents = Cents Int64
  deriving newtype (Eq, Ord, Show, Num, ToJSON, FromJSON, ToField, FromField)

unCents :: Cents -> Int64
unCents (Cents c) = c

jsonOpts :: Options
jsonOpts = defaultOptions {fieldLabelModifier = reverse . dropWhile (== '_') . reverse}

data Role = Owner | Admin | Member | Viewer
  deriving stock (Eq, Show, Ord)

parseRole :: Text -> Maybe Role
parseRole = \case
  "owner" -> Just Owner
  "admin" -> Just Admin
  "member" -> Just Member
  "viewer" -> Just Viewer
  _ -> Nothing

roleText :: Role -> Text
roleText = \case Owner -> "owner"; Admin -> "admin"; Member -> "member"; Viewer -> "viewer"

-- | Can the role change data (create invoices/drafts, confirm payments)?
canWrite :: Role -> Bool
canWrite r = r /= Viewer

-- | Verified identity + the workspace resolved server-side from memberships.
data Ctx = Ctx
  { userId :: UUID
  , userEmail :: Text
  , userName :: Text
  , workspaceId :: UUID
  , workspaceName :: Text
  , role :: Role
  }
  deriving stock (Show)

-- ---------- response / row types ----------

data Health = Health {status :: Text} deriving stock (Show, Eq, Generic)
instance ToJSON Health where toJSON = genericToJSON jsonOpts

data SessionToken = SessionToken {token :: Text, expires_in :: Int} deriving stock (Show, Eq, Generic)
instance ToJSON SessionToken where toJSON = genericToJSON jsonOpts

-- | What a demo reset removed (counts only).
data ResetResp = ResetResp
  { payments_removed :: Int
  , drafts_removed :: Int
  , invoices_removed :: Int
  , ledger_entries_removed :: Int
  , conversations_removed :: Int
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON ResetResp where toJSON = genericToJSON jsonOpts

data WorkspaceRef = WorkspaceRef {id_ :: UUID, name :: Text} deriving stock (Show, Eq, Generic)
instance ToJSON WorkspaceRef where toJSON = genericToJSON jsonOpts

data MeResp = MeResp
  { user_id :: UUID
  , email :: Text
  , display_name :: Text
  , role :: Text
  , workspace :: WorkspaceRef
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON MeResp where toJSON = genericToJSON jsonOpts

data AccountRow = AccountRow
  { id_ :: UUID, name :: Text, kind :: Text, balance_minor :: Cents, currency :: Text}
  deriving stock (Show, Eq, Generic)
instance ToJSON AccountRow where toJSON = genericToJSON jsonOpts
instance FromRow AccountRow where fromRow = AccountRow <$> field <*> field <*> field <*> field <*> field

data TxnRow = TxnRow
  { id_ :: UUID
  , date :: Day
  , description :: Text
  , vendor_id :: Maybe UUID
  , vendor_name :: Maybe Text
  , category :: Text
  , type_ :: Text
  , amount_minor :: Cents
  , account_id :: UUID
  , currency :: Text
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON TxnRow where toJSON = genericToJSON jsonOpts
instance FromRow TxnRow where
  fromRow = TxnRow <$> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field

data VendorRow = VendorRow
  { id_ :: UUID
  , name :: Text
  , category :: Text
  , contact_email :: Text
  , contact_phone :: Text
  , total_spend_minor :: Cents
  , transaction_count :: Int64
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON VendorRow where toJSON = genericToJSON jsonOpts
instance FromRow VendorRow where
  fromRow = VendorRow <$> field <*> field <*> field <*> field <*> field <*> field <*> field

data VendorDetail = VendorDetail {vendor :: VendorRow, transactions :: [TxnRow]}
  deriving stock (Show, Eq, Generic)
instance ToJSON VendorDetail where toJSON = genericToJSON jsonOpts

data InvoiceRow = InvoiceRow
  { id_ :: UUID
  , number :: Text
  , vendor_id :: UUID
  , vendor_name :: Text
  , issue_date :: Day
  , due_date :: Day
  , amount_minor :: Cents
  , currency :: Text
  , status :: Text
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON InvoiceRow where toJSON = genericToJSON jsonOpts
instance FromRow InvoiceRow where
  fromRow = InvoiceRow <$> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field

data NewInvoice = NewInvoice
  { vendor_id :: UUID
  , amount_minor :: Cents
  , due_date :: Day
  , status :: Text
  }
  deriving stock (Show, Eq, Generic)
instance FromJSON NewInvoice where parseJSON = genericParseJSON jsonOpts

data DraftRow = DraftRow
  { id_ :: UUID
  , vendor_id :: UUID
  , vendor_name :: Text
  , amount_minor :: Cents
  , currency :: Text
  , source_account_id :: UUID
  , source_account_name :: Text
  , memo :: Text
  , execution_date :: Day
  , status :: Text
  , created_at :: UTCTime
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON DraftRow where toJSON = genericToJSON jsonOpts
instance FromRow DraftRow where
  fromRow = DraftRow <$> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field <*> field

data NewDraft = NewDraft
  { vendor_id :: UUID
  , amount_minor :: Cents
  , source_account_id :: UUID
  , memo :: Maybe Text
  }
  deriving stock (Show, Eq, Generic)
instance FromJSON NewDraft where parseJSON = genericParseJSON jsonOpts

data PaymentRow = PaymentRow
  { id_ :: UUID
  , draft_id :: UUID
  , vendor_name :: Text
  , amount_minor :: Cents
  , currency :: Text
  , executed_at :: UTCTime
  , receipt_label :: Text
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON PaymentRow where toJSON = genericToJSON jsonOpts
instance FromRow PaymentRow where
  fromRow = PaymentRow <$> field <*> field <*> field <*> field <*> field <*> field <*> pure receiptLabel

receiptLabel :: Text
receiptLabel = "SIMULATED PAYMENT — NO MONEY MOVED"

data AuditRow = AuditRow
  { id_ :: UUID, at :: UTCTime, actor :: Text, action :: Text, target :: Text, status :: Text}
  deriving stock (Show, Eq, Generic)
instance ToJSON AuditRow where toJSON = genericToJSON jsonOpts
instance FromRow AuditRow where fromRow = AuditRow <$> field <*> field <*> field <*> field <*> field <*> field

data MonthlyPoint = MonthlyPoint {month :: Text, inflow_minor :: Cents, outflow_minor :: Cents}
  deriving stock (Show, Eq, Generic)
instance ToJSON MonthlyPoint where toJSON = genericToJSON jsonOpts
instance FromRow MonthlyPoint where fromRow = MonthlyPoint <$> field <*> field <*> field

data CategoryPoint = CategoryPoint {category :: Text, amount_minor :: Cents}
  deriving stock (Show, Eq, Generic)
instance ToJSON CategoryPoint where toJSON = genericToJSON jsonOpts
instance FromRow CategoryPoint where fromRow = CategoryPoint <$> field <*> field

data DashboardResp = DashboardResp
  { total_balance_minor :: Cents
  , month_income_minor :: Cents
  , month_expense_minor :: Cents
  , month_net_minor :: Cents
  , monthly :: [MonthlyPoint]
  , categories :: [CategoryPoint]
  , recent :: [TxnRow]
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON DashboardResp where toJSON = genericToJSON jsonOpts

-- ---------- AI command center ----------

-- | Backend-generated UI blocks. The browser renders only these known shapes (schema version 1).
data UiBlock
  = MetricBlock Text Cents Text -- label, value, currency
  | TableBlock [Text] [[Text]] -- columns, rows
  | DraftBlock DraftRow
  deriving stock (Show, Eq)

instance ToJSON UiBlock where
  toJSON = \case
    MetricBlock l v c -> object ["type" .= ("metric" :: Text), "label" .= l, "value_minor" .= v, "currency" .= c]
    TableBlock cols rows -> object ["type" .= ("table" :: Text), "columns" .= cols, "rows" .= rows]
    DraftBlock d -> object ["type" .= ("payment_draft" :: Text), "draft" .= d]

data ToolActivity = ToolActivity {tool_name :: Text, status :: Text}
  deriving stock (Show, Eq, Generic)
instance ToJSON ToolActivity where toJSON = genericToJSON jsonOpts

data CommandReq = CommandReq {message :: Text, conversation_id :: Maybe UUID}
  deriving stock (Show, Eq, Generic)
instance FromJSON CommandReq where parseJSON = genericParseJSON jsonOpts {rejectUnknownFields = True}

data CommandResp = CommandResp
  { message_id :: UUID
  , conversation_id :: UUID
  , answer :: Text
  , ui_blocks :: [UiBlock]
  , ui_blocks_version :: Int
  , tool_activity :: [ToolActivity]
  }
  deriving stock (Show, Eq, Generic)
instance ToJSON CommandResp where toJSON = genericToJSON jsonOpts

data ConversationRow = ConversationRow {id_ :: UUID, created_at :: UTCTime, preview :: Text}
  deriving stock (Show, Eq, Generic)
instance ToJSON ConversationRow where toJSON = genericToJSON jsonOpts
instance FromRow ConversationRow where fromRow = ConversationRow <$> field <*> field <*> field

data MessageRow = MessageRow {id_ :: UUID, role :: Text, content :: Text, ui_blocks :: Value, created_at :: UTCTime}
  deriving stock (Show, Eq, Generic)
instance ToJSON MessageRow where toJSON = genericToJSON jsonOpts
instance FromRow MessageRow where fromRow = MessageRow <$> field <*> field <*> field <*> field <*> field

data PageResp a = PageResp {items :: [a], total :: Int64, page :: Int, page_size :: Int}
  deriving stock (Show, Eq, Generic)
instance ToJSON a => ToJSON (PageResp a) where toJSON = genericToJSON jsonOpts

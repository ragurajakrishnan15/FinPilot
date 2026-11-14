-- | The allowlisted tool catalog shown to the model (OpenAI/Groq function-calling format).
-- Definitions describe capabilities only; they grant no permission. No schema has a user,
-- workspace or role parameter: identity always comes from the verified server-side session.
-- Money arguments are decimal strings parsed exactly by the backend (never floats).
module FinPilot.AI.ToolDefinitions
  ( toolDefinitions
  , toolNames
  ) where

import Data.Aeson
import qualified Data.Aeson.Key as K
import qualified Data.Aeson.KeyMap as KM
import Data.Text (Text)
import qualified Data.Vector as V

toolNames :: [Text]
toolNames =
  [ "get_account_balance"
  , "get_monthly_expenses"
  , "compare_expenses"
  , "search_transactions"
  , "get_vendor_spending"
  , "get_cash_flow"
  , "list_invoices"
  , "create_payment_draft"
  , "get_payment_status"
  ]

-- | Models often send an explicit null for omitted optional arguments, and Groq validates tool calls
-- against the schema (HTTP 400 otherwise). Optional parameters therefore accept null, which the
-- backend decodes as "absent".
nullable :: Value -> Value
nullable (Object o) = Object (upd "type" widen (upd "enum" addNull o))
  where
    upd k f m = maybe m (\v -> KM.insert k (f v) m) (KM.lookup k m)
    widen (String t) = toJSON [t, "null"]
    widen other = other
    addNull (Array xs) = Array (xs <> V.singleton Null)
    addNull other = other
nullable other = other

fn :: Text -> Text -> [(Key, Value)] -> [Text] -> Value
fn name desc props0 required =
  let props = [(k, if K.toText k `elem` required then v else nullable v) | (k, v) <- props0]
   in fnWith name desc props required

fnWith :: Text -> Text -> [(Key, Value)] -> [Text] -> Value
fnWith name desc props required =
  object
    [ "type" .= ("function" :: Text)
    , "function"
        .= object
          [ "name" .= name
          , "description" .= desc
          , "parameters"
              .= object
                [ "type" .= ("object" :: Text)
                , "properties" .= object props
                , "required" .= required
                , "additionalProperties" .= False
                ]
          ]
    ]

str :: Text -> Value
str d = object ["type" .= ("string" :: Text), "description" .= d]

dateP :: Text -> Value
dateP d = object ["type" .= ("string" :: Text), "format" .= ("date" :: Text), "description" .= (d <> " (YYYY-MM-DD)")]

int :: Text -> Value
int d = object ["type" .= ("integer" :: Text), "description" .= d]

enum :: [Text] -> Text -> Value
enum vs d = object ["type" .= ("string" :: Text), "enum" .= vs, "description" .= d]

range :: Text -> Value
range d =
  object
    [ "type" .= ("object" :: Text)
    , "description" .= d
    , "properties" .= object ["from" .= dateP "Start date, inclusive", "to" .= dateP "End date, inclusive"]
    , "required" .= ["from", "to" :: Text]
    , "additionalProperties" .= False
    ]

toolDefinitions :: [Value]
toolDefinitions =
  [ fn "get_account_balance" "Get the balances of the workspace's accounts (and the total)."
      ["account_id" .= str "Optional account UUID. Omit for all accounts."] []
  , fn "get_monthly_expenses" "Total expenses (outflows) for one calendar month, with a breakdown by category."
      ["year" .= int "Four-digit year", "month" .= int "Month number 1-12", "category" .= str "Optional category filter, e.g. Software"]
      ["year", "month"]
  , fn "compare_expenses" "Compare total expenses between two date ranges, optionally for one vendor and/or category. Returns both totals and the change."
      [ "range_a" .= range "Baseline period"
      , "range_b" .= range "Comparison period"
      , "vendor" .= str "Optional vendor name"
      , "category" .= str "Optional category"
      ]
      ["range_a", "range_b"]
  , fn "search_transactions" "Search transactions with filters. Returns at most 10 matches plus the total match count."
      [ "from" .= dateP "Start date"
      , "to" .= dateP "End date"
      , "vendor" .= str "Vendor name"
      , "category" .= str "Category"
      , "type" .= enum ["inflow", "outflow"] "Transaction direction"
      , "min_amount" .= str "Minimum amount in dollars, e.g. \"100.00\""
      , "max_amount" .= str "Maximum amount in dollars, e.g. \"500\""
      , "limit" .= int "Max rows to return (1-10)"
      ]
      []
  , fn "get_vendor_spending" "Spending with one vendor (if vendor is given) or the top 5 vendors by spend, over a date range (default: last 90 days)."
      ["vendor" .= str "Vendor name. Omit to rank the top 5 vendors.", "from" .= dateP "Start date", "to" .= dateP "End date"] []
  , fn "get_cash_flow" "Inflows, outflows and net cash flow over a date range, grouped by day, week or month."
      ["from" .= dateP "Start date", "to" .= dateP "End date", "group_by" .= enum ["day", "week", "month"] "Grouping interval (default month)"]
      ["from", "to"]
  , fn "list_invoices" "List invoices, optionally filtered by status and due-date range. Returns at most 20."
      [ "status" .= enum ["draft", "unpaid", "paid", "overdue"] "Invoice status"
      , "due_from" .= dateP "Earliest due date"
      , "due_to" .= dateP "Latest due date"
      , "limit" .= int "Max rows (1-20)"
      ]
      []
  , fn "create_payment_draft" "Create a payment DRAFT for the user to review. This never executes or moves money; the user must confirm separately on the Payments page."
      [ "vendor" .= str "Vendor (payee) name"
      , "amount" .= str "Amount in dollars as a decimal string, e.g. \"500\" or \"1250.75\""
      , "source_account_id" .= str "Optional source account UUID. Defaults to the operating account."
      , "memo" .= str "Optional memo, max 140 characters"
      ]
      ["vendor", "amount"]
  , fn "get_payment_status" "Get the status of a payment draft or payment. Omit id for the most recent draft and payment."
      ["id" .= str "Optional payment draft or payment UUID"] []
  ]

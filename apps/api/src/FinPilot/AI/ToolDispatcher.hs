-- | Executes allowlisted tools requested by the model.
--
-- Contract (PLAN §6): reject unknown tools and invalid JSON; validate types, dates and amounts;
-- identity and workspace come from the verified 'Ctx' (never from arguments — the schemas have no
-- such fields and unknown fields are rejected); check role; run parameterized, workspace-scoped
-- queries; return bounded structured results. Every UI block is generated here from database
-- results, so figures shown to the user never depend on model-written text.
module FinPilot.AI.ToolDispatcher
  ( ToolOutcome (..)
  , dispatchTool
  ) where

import Control.Monad (unless)
import Data.Aeson
import qualified Data.ByteString.Lazy as BL
import Data.Maybe (fromMaybe)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Data.Time (Day, addDays, diffDays, fromGregorian, gregorianMonthLength)
import Data.UUID (UUID)
import Database.PostgreSQL.Simple (Connection)
import GHC.Generics (Generic)
import qualified FinPilot.Database.Payments as P
import qualified FinPilot.Database.Queries as Q
import FinPilot.Domain.Finance
import FinPilot.Domain.Validation
import FinPilot.Types

-- | @outcomeStatus@ is one of succeeded | failed | rejected.
data ToolOutcome = ToolOutcome {result :: Value, blocks :: [UiBlock], outcomeStatus :: Text}

success :: Value -> [UiBlock] -> ToolOutcome
success v bs = ToolOutcome v bs "succeeded"

failed :: Text -> ToolOutcome
failed msg = ToolOutcome (object ["error" .= msg]) [] "failed"

rejected :: Text -> ToolOutcome
rejected msg = ToolOutcome (object ["error" .= msg]) [] "rejected"

-- ---------- argument types (unknown fields are rejected) ----------

argOpts :: Options
argOpts = jsonOpts {rejectUnknownFields = True}

newtype BalArgs = BalArgs {account_id :: Maybe UUID} deriving stock (Generic)
instance FromJSON BalArgs where parseJSON = genericParseJSON argOpts

data MonthlyArgs = MonthlyArgs {year :: Int, month :: Int, category :: Maybe Text} deriving stock (Generic)
instance FromJSON MonthlyArgs where parseJSON = genericParseJSON argOpts

data DateRange = DateRange {from :: Day, to :: Day} deriving stock (Generic)
instance FromJSON DateRange where parseJSON = genericParseJSON argOpts

data CompareArgs = CompareArgs {range_a :: DateRange, range_b :: DateRange, vendor :: Maybe Text, category :: Maybe Text}
  deriving stock (Generic)
instance FromJSON CompareArgs where parseJSON = genericParseJSON argOpts

data SearchArgs = SearchArgs
  { from :: Maybe Day, to :: Maybe Day, vendor :: Maybe Text, category :: Maybe Text, type_ :: Maybe Text
  , min_amount :: Maybe Text, max_amount :: Maybe Text, limit :: Maybe Int }
  deriving stock (Generic)
instance FromJSON SearchArgs where parseJSON = genericParseJSON argOpts

data VendorArgs = VendorArgs {vendor :: Maybe Text, from :: Maybe Day, to :: Maybe Day} deriving stock (Generic)
instance FromJSON VendorArgs where parseJSON = genericParseJSON argOpts

data CashArgs = CashArgs {from :: Day, to :: Day, group_by :: Maybe Text} deriving stock (Generic)
instance FromJSON CashArgs where parseJSON = genericParseJSON argOpts

data InvArgs = InvArgs {status :: Maybe Text, due_from :: Maybe Day, due_to :: Maybe Day, limit :: Maybe Int}
  deriving stock (Generic)
instance FromJSON InvArgs where parseJSON = genericParseJSON argOpts

data DraftArgs = DraftArgs {vendor :: Text, amount :: Text, source_account_id :: Maybe UUID, memo :: Maybe Text}
  deriving stock (Generic)
instance FromJSON DraftArgs where parseJSON = genericParseJSON argOpts

newtype StatusArgs = StatusArgs {id_ :: Maybe UUID} deriving stock (Generic)
instance FromJSON StatusArgs where parseJSON = genericParseJSON argOpts

decodeArgs :: FromJSON a => Text -> Either Text a
decodeArgs t =
  let raw = if T.null (T.strip t) then "{}" else t
   in either (\e -> Left ("invalid_arguments: " <> T.take 160 (T.pack e))) Right (eitherDecode (BL.fromStrict (TE.encodeUtf8 raw)))

-- ---------- dispatch ----------

-- | @dispatchTool conn ctx today toolName argumentsJson@
dispatchTool :: Connection -> Ctx -> Day -> Text -> Text -> IO ToolOutcome
dispatchTool conn ctx today name argsText
  | T.length argsText > 4000 = pure (rejected "arguments_too_large")
  | otherwise = case name of
      "get_account_balance" -> with (balanceTool conn ctx)
      "get_monthly_expenses" -> with (monthlyTool conn ctx)
      "compare_expenses" -> with (compareTool conn ctx)
      "search_transactions" -> with (searchTool conn ctx)
      "get_vendor_spending" -> with (vendorTool conn ctx today)
      "get_cash_flow" -> with (cashTool conn ctx)
      "list_invoices" -> with (invoicesTool conn ctx)
      "create_payment_draft" -> with (draftTool conn ctx today)
      "get_payment_status" -> with (statusTool conn ctx)
      _ -> pure (rejected "unknown_tool")
  where
    with :: FromJSON a => (a -> IO ToolOutcome) -> IO ToolOutcome
    with f = either (pure . rejected) f (decodeArgs argsText)

-- ---------- helpers ----------

checkRange :: Day -> Day -> Either Text ()
checkRange a b
  | a > b = Left "from_must_not_be_after_to"
  | diffDays b a > 1830 = Left "range_longer_than_5_years"
  | otherwise = Right ()

clampLimit :: Int -> Int -> Maybe Int -> Int
clampLimit dflt mx = maybe dflt (max 1 . min mx)

resolveVendor :: Connection -> UUID -> Text -> IO (Either ToolOutcome (UUID, Text))
resolveVendor conn ws nm = do
  vs <- Q.findVendors conn ws (T.take 100 nm)
  pure $ case vs of
    [] -> Left (failed "vendor_not_found")
    [v] -> Right v
    _ -> case filter (\(_, n) -> T.toLower n == T.toLower (T.strip nm)) vs of
      [v] -> Right v
      _ -> Left (ToolOutcome (object ["error" .= ("ambiguous_vendor" :: Text), "candidates" .= map snd vs]) [] "failed")

clean :: Text -> Text
clean = T.take 80 . T.filter (>= ' ')

money :: Cents -> Value
money c = object ["amount" .= formatCents c, "amount_minor" .= c]

optVendor :: Connection -> UUID -> Maybe Text -> IO (Either ToolOutcome (Maybe (UUID, Text)))
optVendor _ _ Nothing = pure (Right Nothing)
optVendor conn ws (Just n) = fmap Just <$> resolveVendor conn ws n

-- ---------- tools ----------

balanceTool :: Connection -> Ctx -> BalArgs -> IO ToolOutcome
balanceTool conn ctx args = do
  accts <- Q.getAccounts conn ctx.workspaceId
  let sel = maybe accts (\i -> filter (\a -> a.id_ == i) accts) args.account_id
      total = sumCents (map (\a -> a.balance_minor) sel)
  pure $
    if null sel
      then failed "account_not_found"
      else
        success
          ( object
              [ "accounts" .= [object ["id" .= a.id_, "name" .= a.name, "kind" .= a.kind, "balance" .= formatCents a.balance_minor, "balance_minor" .= a.balance_minor] | a <- sel]
              , "total" .= formatCents total
              , "total_minor" .= total
              ]
          )
          [ MetricBlock (maybe "Total balance" (const "Account balance") args.account_id) total "USD"
          , TableBlock ["Account", "Type", "Balance"] [[a.name, a.kind, formatCents a.balance_minor] | a <- sel]
          ]

monthlyTool :: Connection -> Ctx -> MonthlyArgs -> IO ToolOutcome
monthlyTool conn ctx args
  | args.year < 2000 || args.year > 2100 = pure (rejected "year_out_of_range")
  | args.month < 1 || args.month > 12 = pure (rejected "month_out_of_range")
  | otherwise = do
      let y = fromIntegral args.year
          from = fromGregorian y args.month 1
          to = fromGregorian y args.month (gregorianMonthLength y args.month)
          label = T.pack (show args.year) <> "-" <> T.justifyRight 2 '0' (T.pack (show args.month))
      (total, n) <- Q.sumOutflows conn ctx.workspaceId from to Nothing args.category
      cats <- case args.category of
        Nothing -> Q.outflowsByCategory conn ctx.workspaceId from to
        Just _ -> pure []
      pure $
        success
          ( object
              [ "period" .= label, "category_filter" .= args.category, "total" .= formatCents total, "total_minor" .= total
              , "transaction_count" .= n
              , "by_category" .= [object ["category" .= c, "amount" .= formatCents a, "amount_minor" .= a] | (c, a) <- cats]
              ]
          )
          ( MetricBlock ("Expenses " <> label <> maybe "" (" · " <>) args.category) total "USD"
              : [TableBlock ["Category", "Amount"] [[c, formatCents a] | (c, a) <- cats] | not (null cats)]
          )

compareTool :: Connection -> Ctx -> CompareArgs -> IO ToolOutcome
compareTool conn ctx args = case (checkRange args.range_a.from args.range_a.to, checkRange args.range_b.from args.range_b.to) of
  (Left e, _) -> pure (rejected ("range_a: " <> e))
  (_, Left e) -> pure (rejected ("range_b: " <> e))
  _ -> do
    mv <- optVendor conn ctx.workspaceId args.vendor
    case mv of
      Left out -> pure out
      Right v -> do
        let vid = fst <$> v
            period r = Q.sumOutflows conn ctx.workspaceId r.from r.to vid args.category
        (ta, na) <- period args.range_a
        (tb, nb) <- period args.range_b
        let var = variance ta tb
            pct = maybe "n/a (baseline is zero)" (\b -> T.pack (show (fromIntegral b / 100 :: Double)) <> "%") var.percent_change_bps
            desc r = T.pack (show r.from) <> " to " <> T.pack (show r.to)
        pure $
          success
            ( object
                [ "vendor" .= (snd <$> v), "category" .= args.category
                , "range_a" .= object ["from" .= args.range_a.from, "to" .= args.range_a.to, "total" .= formatCents ta, "total_minor" .= ta, "transaction_count" .= na]
                , "range_b" .= object ["from" .= args.range_b.from, "to" .= args.range_b.to, "total" .= formatCents tb, "total_minor" .= tb, "transaction_count" .= nb]
                , "change" .= object ["delta" .= formatCents var.delta_minor, "delta_minor" .= var.delta_minor, "percent_change_bps" .= var.percent_change_bps]
                ]
            )
            [ TableBlock
                ["Period", "Total", "Transactions"]
                [ [desc args.range_a, formatCents ta, T.pack (show na)]
                , [desc args.range_b, formatCents tb, T.pack (show nb)]
                , ["Change", formatCents var.delta_minor, pct]
                ]
            ]

parseOptAmount :: Maybe Text -> Either Text (Maybe Cents)
parseOptAmount Nothing = Right Nothing
parseOptAmount (Just t) = maybe (Left "invalid_amount") (Right . Just) (parseAmountToCents t)

searchTool :: Connection -> Ctx -> SearchArgs -> IO ToolOutcome
searchTool conn ctx args = case validate of
  Left e -> pure (rejected e)
  Right (ty, mn, mx) -> do
    mv <- optVendor conn ctx.workspaceId args.vendor
    case mv of
      Left out -> pure out
      Right v -> do
        let lim = clampLimit 10 10 args.limit
            f = Q.TxnFilter Nothing ty args.category (fst <$> v) (unCents <$> mn) (unCents <$> mx) args.from args.to 1 lim
        (rows, total) <- Q.searchTransactions conn ctx.workspaceId f
        pure $
          success
            ( object
                [ "total_matches" .= total, "returned" .= length rows
                , "transactions" .= [object ["date" .= t.date, "description" .= clean t.description, "vendor" .= t.vendor_name, "category" .= t.category, "type" .= t.type_, "amount" .= formatCents t.amount_minor, "amount_minor" .= t.amount_minor] | t <- rows]
                ]
            )
            [ TableBlock
                ["Date", "Description", "Category", "Amount"]
                [[T.pack (show t.date), clean t.description, t.category, (if t.type_ == "inflow" then "+" else "-") <> formatCents t.amount_minor] | t <- rows]
            | not (null rows)
            ]
  where
    validate = do
      ty <- traverse validateTxnType args.type_
      mn <- parseOptAmount args.min_amount
      mx <- parseOptAmount args.max_amount
      unless (validDateRange args.from args.to) (Left "from_must_not_be_after_to")
      pure (ty, mn, mx)

vendorTool :: Connection -> Ctx -> Day -> VendorArgs -> IO ToolOutcome
vendorTool conn ctx today args =
  let from = fromMaybe (addDays (-90) today) args.from
      to = fromMaybe today args.to
   in case checkRange from to of
        Left e -> pure (rejected e)
        Right () -> case args.vendor of
          Nothing -> do
            top <- Q.topVendorSpend conn ctx.workspaceId from to 5
            pure $
              success
                (object ["from" .= from, "to" .= to, "top_vendors" .= [object ["vendor" .= n, "total" .= formatCents a, "total_minor" .= a] | (n, a) <- top]])
                [TableBlock ["Vendor", "Spend"] [[n, formatCents a] | (n, a) <- top] | not (null top)]
          Just nm -> do
            rv <- resolveVendor conn ctx.workspaceId nm
            case rv of
              Left out -> pure out
              Right (vid, vname) -> do
                (total, n) <- Q.sumOutflows conn ctx.workspaceId from to (Just vid) Nothing
                (recent, _) <- Q.searchTransactions conn ctx.workspaceId (Q.TxnFilter Nothing Nothing Nothing (Just vid) Nothing Nothing (Just from) (Just to) 1 5)
                pure $
                  success
                    ( object
                        [ "vendor" .= vname, "from" .= from, "to" .= to, "total" .= formatCents total, "total_minor" .= total, "transaction_count" .= n
                        , "recent_transactions" .= [object ["date" .= t.date, "description" .= clean t.description, "amount" .= formatCents t.amount_minor] | t <- recent]
                        ]
                    )
                    [ MetricBlock ("Spend with " <> vname) total "USD"
                    , TableBlock ["Date", "Description", "Amount"] [[T.pack (show t.date), clean t.description, formatCents t.amount_minor] | t <- recent]
                    ]

cashTool :: Connection -> Ctx -> CashArgs -> IO ToolOutcome
cashTool conn ctx args =
  let unit = fromMaybe "month" args.group_by
   in case (checkRange args.from args.to, unit `elem` ["day", "week", "month"]) of
        (Left e, _) -> pure (rejected e)
        (_, False) -> pure (rejected "group_by_must_be_day_week_or_month")
        _ -> do
          rows <- Q.cashFlowBy conn ctx.workspaceId args.from args.to unit
          let inflow = sumCents [i | (_, i, _) <- rows]
              outflow = sumCents [o | (_, _, o) <- rows]
              net = netCashFlow inflow outflow
          pure $
            success
              ( object
                  [ "from" .= args.from, "to" .= args.to, "group_by" .= unit
                  , "total_inflow" .= formatCents inflow, "total_outflow" .= formatCents outflow, "net" .= formatCents net, "net_minor" .= net
                  , "periods" .= [object ["period" .= p, "inflow" .= formatCents i, "outflow" .= formatCents o, "net" .= formatCents (netCashFlow i o)] | (p, i, o) <- rows]
                  ]
              )
              ( MetricBlock "Net cash flow" net "USD"
                  : [TableBlock ["Period", "Inflow", "Outflow", "Net"] [[p, formatCents i, formatCents o, formatCents (netCashFlow i o)] | (p, i, o) <- rows] | not (null rows)]
              )

invoicesTool :: Connection -> Ctx -> InvArgs -> IO ToolOutcome
invoicesTool conn ctx args
  | maybe False (`notElem` ["draft", "unpaid", "paid", "overdue"]) args.status = pure (rejected "invalid_status")
  | not (validDateRange args.due_from args.due_to) = pure (rejected "due_from_must_not_be_after_due_to")
  | otherwise = do
      rows <- Q.listInvoicesFiltered conn ctx.workspaceId args.status args.due_from args.due_to (clampLimit 10 20 args.limit)
      pure $
        success
          ( object
              [ "count" .= length rows
              , "invoices" .= [object ["number" .= i.number, "vendor" .= i.vendor_name, "due_date" .= i.due_date, "amount" .= formatCents i.amount_minor, "amount_minor" .= i.amount_minor, "status" .= i.status] | i <- rows]
              ]
          )
          [TableBlock ["Invoice", "Vendor", "Due", "Amount", "Status"] [[i.number, i.vendor_name, T.pack (show i.due_date), formatCents i.amount_minor, i.status] | i <- rows] | not (null rows)]

-- | Creates a DRAFT only. Execution is a separate, authenticated user action (confirm endpoint).
draftTool :: Connection -> Ctx -> Day -> DraftArgs -> IO ToolOutcome
draftTool conn ctx today args
  | not (canWrite ctx.role) = pure (rejected "your_role_cannot_create_payment_drafts")
  | otherwise = case parseAmountToCents args.amount of
      Nothing -> pure (failed "invalid_amount")
      Just amt -> do
        rv <- resolveVendor conn ctx.workspaceId args.vendor
        case rv of
          Left out -> pure out
          Right (vid, vname) -> do
            src <- maybe (Q.defaultSourceAccount conn ctx.workspaceId) (pure . Just) args.source_account_id
            case src of
              Nothing -> pure (failed "no_source_account_available")
              Just sid -> do
                r <- P.createDraft conn ctx (NewDraft vid amt sid args.memo) today
                pure $ case r of
                  Right d ->
                    success
                      ( object
                          [ "draft_id" .= d.id_, "status" .= d.status, "vendor" .= vname, "amount" .= formatCents amt
                          , "source_account" .= d.source_account_name, "memo" .= d.memo
                          , "note" .= ("Draft only. No money has moved. The user must review and confirm it on the Payments page." :: Text)
                          ]
                      )
                      [DraftBlock d]
                  Left (P.PayValidation errs) -> ToolOutcome (object ["error" .= ("validation_failed" :: Text), "details" .= errs]) [] "failed"
                  Left _ -> failed "could_not_create_draft"

statusTool :: Connection -> Ctx -> StatusArgs -> IO ToolOutcome
statusTool conn ctx args = do
  let ws = ctx.workspaceId
  (draft, payment) <- case args.id_ of
    Just i -> (,) <$> Q.getDraft conn ws i <*> Q.getPaymentById conn ws i
    Nothing -> do
      ds <- Q.listDrafts conn ws
      ps <- Q.listPayments conn ws
      pure (headMay ds, headMay ps)
  pure $
    if draft == Nothing && payment == Nothing
      then failed "not_found"
      else
        success
          (object ["draft" .= draft, "payment" .= payment])
          [ TableBlock
              ["Kind", "Payee", "Amount", "Status"]
              ( [["Draft", d.vendor_name, formatCents d.amount_minor, d.status] | Just d <- [draft]]
                  ++ [["Payment (simulated)", p.vendor_name, formatCents p.amount_minor, "executed"] | Just p <- [payment]]
              )
          ]
  where
    headMay (x : _) = Just x
    headMay [] = Nothing

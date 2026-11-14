-- | Input validation shared by REST handlers and (later) AI tool arguments.
module FinPilot.Domain.Validation
  ( validateAmount
  , validateInvoiceStatus
  , validateMemo
  , validateTxnType
  , clampPage
  , clampPageSize
  , escapeLike
  , parseAmountToCents
  , validDateRange
  ) where

import Data.Text (Text)
import qualified Data.Text as T
import Data.Time (Day)
import FinPilot.Domain.Finance (maxAmountMinor)
import FinPilot.Types

validateAmount :: Cents -> Either Text Cents
validateAmount c
  | c <= 0 = Left "Amount must be greater than zero"
  | c > maxAmountMinor = Left "Amount exceeds the maximum allowed"
  | otherwise = Right c

-- | Statuses a user may set on creation (paid/overdue are system-derived).
validateInvoiceStatus :: Text -> Either Text Text
validateInvoiceStatus s
  | s `elem` ["draft", "unpaid"] = Right s
  | otherwise = Left "Status must be draft or unpaid"

validateMemo :: Maybe Text -> Either Text Text
validateMemo Nothing = Right ""
validateMemo (Just m)
  | T.length m > 140 = Left "Memo must be at most 140 characters"
  | T.any (\c -> c < ' ') m = Left "Memo contains control characters"
  | otherwise = Right (T.strip m)

validateTxnType :: Text -> Either Text Text
validateTxnType t
  | t `elem` ["inflow", "outflow"] = Right t
  | otherwise = Left "Type must be inflow or outflow"

clampPage :: Maybe Int -> Int
clampPage = maybe 1 (max 1 . min 100000)

clampPageSize :: Maybe Int -> Int
clampPageSize = maybe 10 (max 1 . min 100)

-- | Escape LIKE/ILIKE wildcards so user input is matched literally (used with ESCAPE '\').
escapeLike :: Text -> Text
escapeLike = T.concatMap (\c -> if c `elem` ['\\', '%', '_'] then T.pack ['\\', c] else T.singleton c)

-- | Exact decimal parsing of a dollar amount ("500", "500.5", "$1,200.25") into cents.
-- No floating point is involved. At most 2 decimal places; rejects negatives and junk.
parseAmountToCents :: Text -> Maybe Cents
parseAmountToCents raw =
  let t = T.filter (\c -> c /= ',' && c /= '$' && c /= ' ') raw
      (whole, rest) = T.break (== '.') t
      frac = T.drop 1 rest
      digits s = not (T.null s) && T.all (\c -> c >= '0' && c <= '9') s
      okFrac = T.null rest || (digits frac && T.length frac <= 2)
   in if digits whole && T.length whole <= 12 && okFrac
        then Just (Cents (read (T.unpack whole) * 100 + (if T.null frac then 0 else read (T.unpack (T.justifyLeft 2 '0' frac)))))
        else Nothing

validDateRange :: Maybe Day -> Maybe Day -> Bool
validDateRange (Just a) (Just b) = a <= b
validDateRange _ _ = True

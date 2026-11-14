-- | Pure financial calculations on integer minor units. No floating point.
module FinPilot.Domain.Finance
  ( formatCents
  , netCashFlow
  , sumCents
  , percentChangeBps
  , Variance (..)
  , variance
  , canAfford
  , maxAmountMinor
  ) where

import Data.Aeson (ToJSON (..), genericToJSON)
import Data.Int (Int64)
import Data.Text (Text)
import qualified Data.Text as T
import GHC.Generics (Generic)
import FinPilot.Types

-- | Upper bound for any single invoice / payment: $1,000,000.00.
maxAmountMinor :: Cents
maxAmountMinor = Cents 100000000

-- | Format cents as a display string, e.g. 12345 -> "$123.45", -5 -> "-$0.05". Exact integer arithmetic.
formatCents :: Cents -> Text
formatCents (Cents c) =
  let a = abs c
      (d, m) = a `quotRem` 100
      grouped = T.reverse (T.intercalate "," (T.chunksOf 3 (T.reverse (T.pack (show d)))))
   in (if c < 0 then "-" else "") <> "$" <> grouped <> "." <> T.justifyRight 2 '0' (T.pack (show m))

netCashFlow :: Cents -> Cents -> Cents
netCashFlow inflow outflow = inflow - outflow

sumCents :: [Cents] -> Cents
sumCents = sum

-- | Percent change in basis points (1% = 100), truncated toward zero.
-- 'Nothing' when the baseline is zero. Computed in 'Integer' so it cannot overflow.
percentChangeBps :: Cents -> Cents -> Maybe Int64
percentChangeBps (Cents old) (Cents new)
  | old == 0 = Nothing
  | otherwise = Just (fromInteger (((toInteger new - toInteger old) * 10000) `quot` toInteger (abs old)))

data Variance = Variance {delta_minor :: Cents, percent_change_bps :: Maybe Int64}
  deriving stock (Show, Eq, Generic)

instance ToJSON Variance where toJSON = genericToJSON jsonOpts

variance :: Cents -> Cents -> Variance
variance old new = Variance (new - old) (percentChangeBps old new)

-- | A payment is affordable when the (non-negative) balance covers the amount.
canAfford :: Cents -> Cents -> Bool
canAfford balance amount = amount > 0 && balance >= amount

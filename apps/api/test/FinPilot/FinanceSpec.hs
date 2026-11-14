module FinPilot.FinanceSpec (spec) where

import FinPilot.Domain.Finance
import FinPilot.Types
import Test.Hspec
import Test.QuickCheck

newtype Money = Money Cents deriving stock (Show)

instance Arbitrary Money where
  arbitrary = Money . Cents <$> choose (-10 ^ (12 :: Int), 10 ^ (12 :: Int))

spec :: Spec
spec = describe "Finance" $ do
  it "netCashFlow is inflow minus outflow" $
    netCashFlow (Cents 1000) (Cents 250) `shouldBe` Cents 750

  it "sumCents is exact for values floats cannot represent" $
    sumCents (replicate 10 (Cents 10)) `shouldBe` Cents 100

  it "formats cents exactly" $ do
    formatCents (Cents 12345) `shouldBe` "$123.45"
    formatCents (Cents 5) `shouldBe` "$0.05"
    formatCents (Cents (-1284050)) `shouldBe` "-$12,840.50"
    formatCents (Cents 100000000) `shouldBe` "$1,000,000.00"
    formatCents (Cents 0) `shouldBe` "$0.00"

  it "percent change in basis points" $ do
    percentChangeBps (Cents 10000) (Cents 12500) `shouldBe` Just 2500
    percentChangeBps (Cents 10000) (Cents 5000) `shouldBe` Just (-5000)
    percentChangeBps (Cents 0) (Cents 5000) `shouldBe` Nothing

  it "variance reports delta and percent" $
    variance (Cents 200) (Cents 300) `shouldBe` Variance (Cents 100) (Just 5000)

  it "canAfford requires positive amount within balance" $ do
    canAfford (Cents 500) (Cents 500) `shouldBe` True
    canAfford (Cents 499) (Cents 500) `shouldBe` False
    canAfford (Cents 500) (Cents 0) `shouldBe` False
    canAfford (Cents 500) (Cents (-1)) `shouldBe` False

  describe "properties" $ do
    it "sumCents is order independent" $
      property $ \xs -> sumCents [m | Money m <- xs] == sumCents (reverse [m | Money m <- xs])
    it "net cash flow: inflow - outflow + outflow = inflow" $
      property $ \(Money i) (Money o) -> netCashFlow i o + o == i
    it "variance delta equals new - old" $
      property $ \(Money a) (Money b) -> (variance a b).delta_minor == b - a
    it "a payment that is affordable never overdraws" $
      property $ \(Money bal) (Money amt) -> not (canAfford bal amt) || bal - amt >= 0

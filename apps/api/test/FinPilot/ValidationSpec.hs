module FinPilot.ValidationSpec (spec) where

import qualified Data.Text as T
import FinPilot.Domain.Validation
import FinPilot.Types
import Test.Hspec
import Test.QuickCheck

spec :: Spec
spec = describe "Validation" $ do
  it "validates amounts" $ do
    validateAmount (Cents 1) `shouldBe` Right (Cents 1)
    validateAmount (Cents 0) `shouldSatisfy` isLeft'
    validateAmount (Cents (-5)) `shouldSatisfy` isLeft'
    validateAmount (Cents 100000000) `shouldBe` Right (Cents 100000000)
    validateAmount (Cents 100000001) `shouldSatisfy` isLeft'

  it "only allows draft/unpaid invoice statuses on create" $ do
    validateInvoiceStatus "draft" `shouldBe` Right "draft"
    validateInvoiceStatus "paid" `shouldSatisfy` isLeft'
    validateInvoiceStatus "overdue" `shouldSatisfy` isLeft'

  it "limits memos" $ do
    validateMemo Nothing `shouldBe` Right ""
    validateMemo (Just (T.replicate 141 "a")) `shouldSatisfy` isLeft'
    validateMemo (Just "ok\nnewline") `shouldSatisfy` isLeft'
    validateMemo (Just "  October services ") `shouldBe` Right "October services"

  it "clamps pagination" $ do
    clampPage (Just 0) `shouldBe` 1
    clampPage Nothing `shouldBe` 1
    clampPageSize (Just 100000) `shouldBe` 100
    clampPageSize (Just (-3)) `shouldBe` 1

  it "escapes LIKE wildcards" $
    escapeLike "50%_off\\" `shouldBe` "50\\%\\_off\\\\"

  it "parses dollar amounts to exact cents" $ do
    parseAmountToCents "500" `shouldBe` Just (Cents 50000)
    parseAmountToCents "$1,200.25" `shouldBe` Just (Cents 120025)
    parseAmountToCents "0.5" `shouldBe` Just (Cents 50)
    parseAmountToCents "19.99" `shouldBe` Just (Cents 1999)
    mapM_ (\t -> parseAmountToCents t `shouldBe` Nothing) ["", "abc", "-5", "1.234", "1e3", "12.", ".5", "1.2.3", "99999999999999"]

  it "date ranges must be ordered" $ do
    validDateRange Nothing Nothing `shouldBe` True

  it "pagination is always within bounds (property)" $
    property $ \p s -> clampPage p >= 1 && clampPageSize s >= 1 && clampPageSize s <= 100

isLeft' :: Either a b -> Bool
isLeft' = either (const True) (const False)

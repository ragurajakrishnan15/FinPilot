-- | Phase 4 acceptance: no payment executes without explicit confirmation; duplicates,
-- stale drafts, unauthorized and cross-tenant attempts are rejected. Real PostgreSQL required.
module FinPilot.PaymentSpec (spec) where

import Control.Concurrent (forkIO)
import Control.Concurrent.MVar
import Data.Aeson (Value (..), encode, object, (.=))
import qualified Data.ByteString.Char8 as BS
import Data.Int (Int64)
import Data.List (nub)
import Data.Text (Text)
import qualified Data.Text as T
import FinPilot.TestUtil
import Network.HTTP.Types
import Network.Wai (Application)
import Network.Wai.Test
import System.Environment (lookupEnv)
import Test.Hspec

spec :: Spec
spec = describe "Payment workflow (simulated)" $ do
  murl <- runIO (lookupEnv "TEST_DATABASE_URL")
  case murl of
    Nothing -> it "requires TEST_DATABASE_URL" (pendingWith "TEST_DATABASE_URL not set")
    Just url -> do
      apps <- runIO (mkTestApps url)
      let a = app apps
      tokA <- runIO (tokenFor "demo-user-1")
      tokB <- runIO (tokenFor "demo-user-2")
      tokV <- runIO (tokenFor "demo-viewer")

      let balance :: IO Int64
          balance = head <$> scalarQuery url "SELECT balance_minor FROM accounts WHERE id = '00000000-0000-0000-0000-00000000ac01'"
          paymentCount :: IO Int64
          paymentCount = head <$> scalarQuery url "SELECT count(*)::bigint FROM payments"
          mkDraft tok amt = createDraft a tok (T.pack (BS.unpack vendorAbc)) (T.pack (BS.unpack acctOperating)) amt
          idOf r = case jsonField "id" r of Just (String t) -> BS.pack (T.unpack t); _ -> error "no id in response"

      it "creating a draft does not execute a payment or touch the balance" $ do
        b0 <- balance
        n0 <- paymentCount
        r <- mkDraft tokA 50000
        simpleStatus r `shouldBe` status201
        jsonField "status" r `shouldBe` Just (String "pending_confirmation")
        balance `shouldReturn` b0
        paymentCount `shouldReturn` n0

      it "requires an Idempotency-Key to confirm" $ do
        d <- idOf <$> mkDraft tokA 1000
        r <- send a methodPost ("/api/payment-drafts/" <> d <> "/confirm") (authed tokA) ""
        simpleStatus r `shouldBe` status422

      it "confirmation executes once, debits exactly, records ledger + audit, and returns a SIMULATED receipt" $ do
        d <- idOf <$> mkDraft tokA 50000
        b0 <- balance
        r <- confirm a tokA d "key-exec-0001"
        simpleStatus r `shouldBe` status200
        bodyText r `shouldSatisfy` T.isInfixOf "SIMULATED PAYMENT — NO MONEY MOVED"
        b1 <- balance
        b1 `shouldBe` (b0 - 50000)
        led <- scalarQuery url "SELECT count(*)::bigint FROM transactions WHERE description LIKE 'Simulated payment to ABC Vendors%'" :: IO [Int64]
        led `shouldSatisfy` ((>= 1) . head)
        au <- send a methodGet "/api/audit-events" (authed tokA) ""
        bodyText au `shouldSatisfy` T.isInfixOf "payment.executed"

      it "replaying the same confirmation (same key) returns the same receipt and debits only once" $ do
        d <- idOf <$> mkDraft tokA 70000
        r1 <- confirm a tokA d "key-replay-0001"
        b1 <- balance
        r2 <- confirm a tokA d "key-replay-0001"
        simpleStatus r2 `shouldBe` status200
        jsonField "id" r2 `shouldBe` jsonField "id" r1
        balance `shouldReturn` b1

      it "rejects confirming an already executed draft with a different key" $ do
        d <- idOf <$> mkDraft tokA 1500
        _ <- confirm a tokA d "key-first-00001"
        b1 <- balance
        r <- confirm a tokA d "key-second-0001"
        simpleStatus r `shouldBe` status409
        jsonField "code" r `shouldBe` Just (String "invalid_state")
        balance `shouldReturn` b1

      it "rejects reusing an idempotency key for a different draft" $ do
        d1 <- idOf <$> mkDraft tokA 1100
        d2 <- idOf <$> mkDraft tokA 1200
        _ <- confirm a tokA d1 "key-shared-0001"
        r <- confirm a tokA d2 "key-shared-0001"
        simpleStatus r `shouldBe` status409
        jsonField "code" r `shouldBe` Just (String "idempotency_key_reuse")

      it "cancelled drafts cannot be confirmed, and cancelling twice fails" $ do
        d <- idOf <$> mkDraft tokA 2000
        c1 <- send a methodPost ("/api/payment-drafts/" <> d <> "/cancel") (authed tokA) ""
        simpleStatus c1 `shouldBe` status200
        jsonField "status" c1 `shouldBe` Just (String "cancelled")
        b0 <- balance
        r <- confirm a tokA d "key-cancelled-01"
        simpleStatus r `shouldBe` status409
        c2 <- send a methodPost ("/api/payment-drafts/" <> d <> "/cancel") (authed tokA) ""
        simpleStatus c2 `shouldBe` status409
        balance `shouldReturn` b0

      it "rejects insufficient simulated funds at confirmation time and marks the draft rejected" $ do
        d <- idOf <$> mkDraft tokA 100000000 -- $1,000,000 > operating balance
        b0 <- balance
        r <- confirm a tokA d "key-broke-00001"
        simpleStatus r `shouldBe` status409
        jsonField "code" r `shouldBe` Just (String "insufficient_funds")
        balance `shouldReturn` b0
        st <- scalarQuery url ("SELECT status FROM payment_drafts WHERE id = '" <> BS.unpack d <> "'") :: IO [String]
        st `shouldBe` ["rejected"]

      it "validates drafts (amount bounds, memo, credit-card source, unknown vendor)" $ do
        r0 <- mkDraft tokA 0
        simpleStatus r0 `shouldBe` status422
        r1 <- mkDraft tokA 100000001
        simpleStatus r1 `shouldBe` status422
        r2 <- createDraft a tokA (T.pack (BS.unpack vendorAbc)) (T.pack (BS.unpack acctCard)) 100
        simpleStatus r2 `shouldBe` status422
        r3 <- createDraft a tokA "00000000-0000-0000-0000-0000000000ff" (T.pack (BS.unpack acctOperating)) 100
        simpleStatus r3 `shouldBe` status422
        r4 <- send a methodPost "/api/payment-drafts" (authed tokA) (encode (object ["vendor_id" .= BS.unpack vendorAbc, "amount_minor" .= (100 :: Int), "source_account_id" .= BS.unpack acctOperating, "memo" .= T.replicate 141 "x"]))
        simpleStatus r4 `shouldBe` status422

      it "a different workspace cannot see, confirm or cancel the draft (404)" $ do
        d <- idOf <$> mkDraft tokA 3000
        b0 <- balance
        rc <- confirm a tokB d "key-tenant-0001"
        simpleStatus rc `shouldBe` status404
        rx <- send a methodPost ("/api/payment-drafts/" <> d <> "/cancel") (authed tokB) ""
        simpleStatus rx `shouldBe` status404
        rl <- send a methodGet "/api/payment-drafts" (authed tokB) ""
        bodyText rl `shouldSatisfy` (not . T.isInfixOf (T.pack (BS.unpack d)))
        balance `shouldReturn` b0

      it "a workspace cannot create a draft with another workspace's vendor/account" $ do
        r <- createDraft a tokB (T.pack (BS.unpack vendorAbc)) (T.pack (BS.unpack acctOperating)) 100
        simpleStatus r `shouldBe` status422

      it "viewers cannot create, confirm or cancel" $ do
        r <- mkDraft tokV 100
        simpleStatus r `shouldBe` status403
        d <- idOf <$> mkDraft tokA 100
        rc <- confirm a tokV d "key-viewer-0001"
        simpleStatus rc `shouldBe` status403
        rx <- send a methodPost ("/api/payment-drafts/" <> d <> "/cancel") (authed tokV) ""
        simpleStatus rx `shouldBe` status403

      it "concurrent confirmations of one draft execute exactly once" $ do
        d <- idOf <$> mkDraft tokA 4000
        b0 <- balance
        n0 <- paymentCount
        results <- parallel 6 (\i -> confirm a tokA d (BS.pack ("key-race-" <> show i <> "-padding")))
        let oks = length (filter ((== status200) . simpleStatus) results)
        oks `shouldBe` 1
        balance `shouldReturn` (b0 - 4000)
        paymentCount `shouldReturn` (n0 + 1)

      it "concurrent confirmations with the SAME key all return one receipt" $ do
        d <- idOf <$> mkDraft tokA 4100
        b0 <- balance
        results <- parallel 6 (\_ -> confirm a tokA d "key-same-race-0001")
        map simpleStatus results `shouldBe` replicate 6 status200
        length (nub [jsonField "id" r | r <- results]) `shouldBe` 1
        balance `shouldReturn` (b0 - 4100)
  where
    parallel :: Int -> (Int -> IO SResponse) -> IO [SResponse]
    parallel n f = do
      vars <- mapM (\i -> do v <- newEmptyMVar; _ <- forkIO (f i >>= putMVar v); pure v) [1 .. n]
      mapM takeMVar vars

createDraft :: Application -> BS.ByteString -> Text -> Text -> Int -> IO SResponse
createDraft a tok vendor account amt =
  send a methodPost "/api/payment-drafts" (authed tok) $
    encode (object ["vendor_id" .= vendor, "amount_minor" .= amt, "source_account_id" .= account, "memo" .= ("test" :: Text)])

confirm :: Application -> BS.ByteString -> BS.ByteString -> BS.ByteString -> IO SResponse
confirm a tok draftId key =
  send a methodPost ("/api/payment-drafts/" <> draftId <> "/confirm") (authed tok ++ [("Idempotency-Key", key)]) ""

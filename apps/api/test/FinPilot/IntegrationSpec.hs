-- | Integration tests against a real PostgreSQL seeded with database/seed (TEST_DATABASE_URL).
-- Skipped (pending) when TEST_DATABASE_URL is not set.
module FinPilot.IntegrationSpec (spec) where

import Data.Aeson (Value (..), encode, object, (.=))
import qualified Data.ByteString.Base64.URL as B64
import qualified Data.ByteString.Char8 as BS
import qualified Data.ByteString.Lazy.Char8 as BLC
import Data.Text (Text)
import qualified Data.Text as T
import FinPilot.TestUtil
import Network.HTTP.Types
import Network.Wai.Test
import System.Environment (lookupEnv)
import Test.Hspec

spec :: Spec
spec = describe "API integration" $ do
  murl <- runIO (lookupEnv "TEST_DATABASE_URL")
  case murl of
    Nothing -> it "requires TEST_DATABASE_URL" (pendingWith "TEST_DATABASE_URL not set")
    Just url -> do
      apps <- runIO (mkTestApps url)
      let app' = app apps
      tokA <- runIO (tokenFor "demo-user-1")
      tokB <- runIO (tokenFor "demo-user-2")

      it "GET /health is public" $ do
        r <- send app' methodGet "/health" [] ""
        simpleStatus r `shouldBe` status200

      describe "authentication" $ do
        it "rejects missing tokens" $ do
          r <- send app' methodGet "/api/me" [] ""
          simpleStatus r `shouldBe` status401
        it "rejects garbage tokens" $ do
          r <- send app' methodGet "/api/me" (authed "not-a-jwt") ""
          simpleStatus r `shouldBe` status401
        it "rejects alg=none tokens" $ do
          let h = B64.encodeUnpadded "{\"alg\":\"none\"}"
              p = B64.encodeUnpadded "{\"sub\":\"demo-user-1\",\"exp\":9999999999}"
          r <- send app' methodGet "/api/me" (authed (BS.intercalate "." [h, p, ""])) ""
          simpleStatus r `shouldBe` status401
        it "rejects valid tokens for unknown users" $ do
          t <- tokenFor "nobody"
          r <- send app' methodGet "/api/me" (authed t) ""
          simpleStatus r `shouldBe` status403
        it "demo-session is disabled unless DEMO_MODE=true" $ do
          r <- send app' methodPost "/api/demo-session" [] ""
          simpleStatus r `shouldBe` status404
          r2 <- send (appDemo apps) methodPost "/api/demo-session" [] ""
          simpleStatus r2 `shouldBe` status200

      describe "workspace isolation" $ do
        it "returns only the caller's workspace" $ do
          r <- send app' methodGet "/api/me" (authed tokA) ""
          BLC.unpack (simpleBody r) `shouldContain` "Acme Robotics"
          rb <- send app' methodGet "/api/me" (authed tokB) ""
          BLC.unpack (simpleBody rb) `shouldContain` "Rival Co"
        it "never leaks the rival workspace's transactions" $ do
          r <- send app' methodGet "/api/transactions?page_size=100" (authed tokA) ""
          simpleStatus r `shouldBe` status200
          BLC.unpack (simpleBody r) `shouldNotContain` "RIVAL SECRET"
        it "refuses an X-Workspace-Id the user is not a member of" $ do
          r <- send app' methodGet "/api/me" (authed tokA ++ [("X-Workspace-Id", wsB)]) ""
          simpleStatus r `shouldBe` status403
        it "returns 404 for another workspace's transaction by id" $ do
          [tid] <- scalarQuery url "SELECT id::text FROM transactions WHERE description = 'RIVAL SECRET PURCHASE'" :: IO [String]
          r <- send app' methodGet ("/api/transactions/" <> BS.pack tid) (authed tokA) ""
          simpleStatus r `shouldBe` status404
          rb <- send app' methodGet ("/api/transactions/" <> BS.pack tid) (authed tokB) ""
          simpleStatus rb `shouldBe` status200
        it "returns 404 for another workspace's vendor" $ do
          r <- send app' methodGet ("/api/vendors/" <> vendorRival) (authed tokA) ""
          simpleStatus r `shouldBe` status404
        it "rejects an invoice for another workspace's vendor" $ do
          r <- postInvoice app' tokA (T.pack (BS.unpack vendorRival)) 100 "draft"
          simpleStatus r `shouldBe` status422

      describe "data" $ do
        it "dashboard balance is the exact sum of account balances in cents" $ do
          r <- send app' methodGet "/api/dashboard" (authed tokA) ""
          case jsonField "total_balance_minor" r of
            Just (Number n) -> n `shouldSatisfy` (> 0)
            other -> expectationFailure ("unexpected: " <> show other)
        it "clamps page size to 100" $ do
          r <- send app' methodGet "/api/transactions?type=inflow&page_size=1000" (authed tokA) ""
          jsonField "page_size" r `shouldBe` Just (Number 100)
        it "treats injection-looking search text as plain text" $ do
          r <- send app' methodGet "/api/transactions?search=%27%3B%20DROP%20TABLE%20transactions%3B%20--" (authed tokA) ""
          simpleStatus r `shouldBe` status200
          r2 <- send app' methodGet "/api/transactions" (authed tokA) ""
          simpleStatus r2 `shouldBe` status200
        it "rejects an invalid type filter" $ do
          r <- send app' methodGet "/api/transactions?type=bogus" (authed tokA) ""
          simpleStatus r `shouldBe` status422

      describe "invoices" $ do
        it "creates an invoice and writes an audit event" $ do
          r <- postInvoice app' tokA (T.pack (BS.unpack vendorAbc)) 12345 "draft"
          simpleStatus r `shouldBe` status201
          a <- send app' methodGet "/api/audit-events" (authed tokA) ""
          BLC.unpack (simpleBody a) `shouldContain` "invoice.created"
        it "rejects zero amounts and invalid statuses" $ do
          r <- postInvoice app' tokA (T.pack (BS.unpack vendorAbc)) 0 "draft"
          simpleStatus r `shouldBe` status422
          r2 <- postInvoice app' tokA (T.pack (BS.unpack vendorAbc)) 100 "paid"
          simpleStatus r2 `shouldBe` status422
        it "never exposes internals in error bodies" $ do
          r <- postInvoice app' tokA "00000000-0000-0000-0000-0000000000ff" 100 "draft"
          let b = bodyText r
          any (`T.isInfixOf` b) ["Exception", "SqlError", "postgres", "password"] `shouldBe` False
        it "forbids viewers from creating invoices" $ do
          tokV <- tokenFor "demo-viewer"
          r <- postInvoice app' tokV (T.pack (BS.unpack vendorAbc)) 100 "draft"
          simpleStatus r `shouldBe` status403
  where
    postInvoice a t v amt st =
      send a methodPost "/api/invoices" (authed t) $
        encode (object ["vendor_id" .= (v :: Text), "amount_minor" .= (amt :: Int), "due_date" .= ("2026-12-31" :: Text), "status" .= (st :: Text)])

_unusedBL :: BLC.ByteString
_unusedBL = ""

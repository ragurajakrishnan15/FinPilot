-- | The demo reset endpoint: hidden outside demo mode, owner/admin only, scoped to the caller's workspace,
-- restores balances, keeps the audit log, and is rate limited. Real PostgreSQL required.
module FinPilot.DemoResetSpec (spec) where

import Data.Aeson (Value (..), encode, object, (.=))
import qualified Data.ByteString.Char8 as BS
import Data.Int (Int64)
import qualified Data.Text as T
import FinPilot.TestUtil
import Network.HTTP.Types
import Network.Wai.Test
import System.Environment (lookupEnv)
import Test.Hspec

wsA :: String
wsA = "'00000000-0000-0000-0000-00000000aaaa'"

spec :: Spec
spec = describe "Demo reset" $ do
  murl <- runIO (lookupEnv "TEST_DATABASE_URL")
  case murl of
    Nothing -> it "requires TEST_DATABASE_URL" (pendingWith "TEST_DATABASE_URL not set")
    Just url -> do
      apps <- runIO (mkTestApps url)
      let live = app apps -- DEMO_MODE off
          demo = appDemo apps -- DEMO_MODE on
      tokA <- runIO (tokenFor "demo-user-1") -- owner of workspace A
      tokB <- runIO (tokenFor "demo-user-2") -- owner of workspace B
      tokV <- runIO (tokenFor "demo-viewer") -- viewer in workspace A

      let count :: String -> IO Int64
          count q = head <$> scalarQuery url q
          clearCooldown = execSql url "DELETE FROM audit_events WHERE action = 'demo.reset'"
          reset a tok = send a methodPost "/api/demo/reset" (authed tok) ""
          balance = count "SELECT balance_minor FROM accounts WHERE id = '00000000-0000-0000-0000-00000000ac01'"
          invoices = count ("SELECT count(*)::bigint FROM invoices WHERE workspace_id = " <> wsA)
          idOf r = case jsonField "id" r of Just (String t) -> BS.pack (T.unpack t); _ -> error "no id in response"
          draft tok amt =
            send demo methodPost "/api/payment-drafts" (authed tok) $
              encode (object ["vendor_id" .= BS.unpack vendorAbc, "amount_minor" .= (amt :: Int), "source_account_id" .= BS.unpack acctOperating, "memo" .= ("reset test" :: String)])

      it "does not exist outside demo mode" $ do
        r <- reset live tokA
        simpleStatus r `shouldBe` status404

      it "requires authentication" $ do
        r <- send demo methodPost "/api/demo/reset" [(hContentType, "application/json")] ""
        simpleStatus r `shouldBe` status401

      it "is forbidden for viewers" $ do
        r <- reset demo tokV
        simpleStatus r `shouldBe` status403

      it "restores balances, removes demo activity, and keeps the audit log" $ do
        clearCooldown
        _ <- reset demo tokA -- start from a known-clean state (other specs leave payments behind)
        clearCooldown
        b0 <- balance
        i0 <- invoices
        auditBefore <- count ("SELECT count(*)::bigint FROM audit_events WHERE workspace_id = " <> wsA)

        d <- idOf <$> draft tokA 12345
        rc <- send demo methodPost ("/api/payment-drafts/" <> d <> "/confirm") (authed tokA ++ [("Idempotency-Key", "reset-test-0001")]) ""
        simpleStatus rc `shouldBe` status200
        _ <- draft tokA 777 -- a second draft left pending
        ri <-
          send demo methodPost "/api/invoices" (authed tokA) $
            encode (object ["vendor_id" .= BS.unpack vendorAbc, "amount_minor" .= (5000 :: Int), "due_date" .= ("2026-12-31" :: String), "status" .= ("unpaid" :: String)])
        simpleStatus ri `shouldBe` status201
        _ <- send demo methodPost "/api/command" (authed tokA) (encode (object ["message" .= ("hello" :: String)])) -- 503 (no model) still opens no session; fine
        balance `shouldReturn` (b0 - 12345)
        invoices `shouldReturn` (i0 + 1)

        r <- reset demo tokA
        simpleStatus r `shouldBe` status200
        jsonField "payments_removed" r `shouldBe` Just (Number 1)
        jsonField "drafts_removed" r `shouldBe` Just (Number 2)
        jsonField "invoices_removed" r `shouldBe` Just (Number 1)
        jsonField "ledger_entries_removed" r `shouldBe` Just (Number 1)

        balance `shouldReturn` b0
        invoices `shouldReturn` i0
        count ("SELECT count(*)::bigint FROM payments WHERE workspace_id = " <> wsA) `shouldReturn` 0
        count ("SELECT count(*)::bigint FROM payment_drafts WHERE workspace_id = " <> wsA) `shouldReturn` 0
        count ("SELECT count(*)::bigint FROM transactions WHERE workspace_id = " <> wsA <> " AND description LIKE 'Simulated payment to %'") `shouldReturn` 0
        -- The audit log is append-only: nothing was deleted, and the reset itself was recorded.
        auditAfter <- count ("SELECT count(*)::bigint FROM audit_events WHERE workspace_id = " <> wsA)
        (auditAfter >= auditBefore + 1) `shouldBe` True
        count ("SELECT count(*)::bigint FROM audit_events WHERE workspace_id = " <> wsA <> " AND action = 'demo.reset' AND status = 'succeeded'") `shouldReturn` 1

      it "is rate limited per workspace" $ do
        clearCooldown
        r1 <- reset demo tokA
        simpleStatus r1 `shouldBe` status200
        r2 <- reset demo tokA
        simpleStatus r2 `shouldBe` status429
        clearCooldown

      it "only touches the caller's workspace" $ do
        clearCooldown
        d <- draft tokA 4200
        simpleStatus d `shouldBe` status201
        pendingA <- count ("SELECT count(*)::bigint FROM payment_drafts WHERE workspace_id = " <> wsA)
        r <- reset demo tokB -- the rival owner resets THEIR workspace
        simpleStatus r `shouldBe` status200
        count ("SELECT count(*)::bigint FROM payment_drafts WHERE workspace_id = " <> wsA) `shouldReturn` pendingA
        -- the rival workspace's seeded data is intact
        (count "SELECT count(*)::bigint FROM transactions WHERE workspace_id = '00000000-0000-0000-0000-00000000bbbb'" >>= \n -> pure (n > 0)) `shouldReturn` True
        clearCooldown

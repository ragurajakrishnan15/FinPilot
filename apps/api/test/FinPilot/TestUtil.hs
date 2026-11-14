-- | Shared helpers for integration tests (real PostgreSQL via TEST_DATABASE_URL).
module FinPilot.TestUtil
  ( secret
  , cfg
  , tokenFor
  , send
  , authed
  , jsonField
  , bodyText
  , scalarQuery
  , execSql
  , mkTestApps
  , TestApps (..)
  , acctOperating
  , acctCard
  , vendorAbc
  , vendorRival
  , wsB
  ) where

import Data.Aeson (Value (..), decode)
import qualified Data.Aeson.Key as K
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString.Char8 as BS
import qualified Data.ByteString.Lazy as BL
import Data.Pool (defaultPoolConfig, newPool)
import Data.Text (Text)
import qualified Data.Text.Encoding as TE
import Data.Time.Clock.POSIX (getPOSIXTime)
import Data.String (fromString)
import Database.PostgreSQL.Simple (close, connectPostgreSQL, execute_, fromOnly, query_)
import FinPilot.AI.GroqClient (LlmClient, notConfiguredClient)
import Database.PostgreSQL.Simple.FromField (FromField)
import FinPilot.App (mkApp)
import FinPilot.Auth.Jwt
import FinPilot.Config
import FinPilot.Handlers (Env (..))
import Network.HTTP.Types
import Network.Wai (Application, requestHeaders, requestMethod, defaultRequest)
import Network.Wai.Test

secret :: BS.ByteString
secret = "integration-test-secret-at-least-32-chars"

cfg :: BS.ByteString -> Bool -> Config
cfg db demo =
  Config
    { port = 0, appEnv = "test", databaseUrl = db, jwtSecret = secret, jwtIssuer = Nothing
    , corsOrigins = ["http://localhost:5173"], demoMode = demo, maxCommandInputChars = 4000
    , maxToolCallsPerTurn = 5, groqApiKey = Nothing, groqModel = Nothing
    , groqBaseUrl = "http://invalid.local", groqTimeoutSeconds = 5
    }

data TestApps = TestApps
  { app :: Application
  , appDemo :: Application
  , dbUrl :: String
  , appWith :: LlmClient -> Application -- ^ same app, with a scripted model
  }

mkTestApps :: String -> IO TestApps
mkTestApps url = do
  pool <- newPool (defaultPoolConfig (connectPostgreSQL (BS.pack url)) close 30 12)
  let db = BS.pack url
  pure TestApps
    { app = mkApp (Env pool (cfg db False) notConfiguredClient)
    , appDemo = mkApp (Env pool (cfg db True) notConfiguredClient)
    , dbUrl = url
    , appWith = \llm -> mkApp (Env pool (cfg db False) llm)
    }

-- | Run a statement directly against the test database (test setup only).
execSql :: String -> String -> IO ()
execSql url q = do
  c <- connectPostgreSQL (BS.pack url)
  _ <- execute_ c (fromString q)
  close c

tokenFor :: Text -> IO BS.ByteString
tokenFor subj = do
  now <- floor <$> getPOSIXTime
  pure (TE.encodeUtf8 (signJwt secret (Claims subj (now + 600) Nothing)))

send :: Application -> Method -> BS.ByteString -> [Header] -> BL.ByteString -> IO SResponse
send a m path hs body =
  runSession (srequest (SRequest (setPath defaultRequest {requestMethod = m, requestHeaders = hs} path) body)) a

authed :: BS.ByteString -> [Header]
authed t = [(hAuthorization, "Bearer " <> t), (hContentType, "application/json")]

jsonField :: Text -> SResponse -> Maybe Value
jsonField k r = case decode (simpleBody r) of
  Just (Object o) -> KM.lookup (K.fromText k) o
  _ -> Nothing

bodyText :: SResponse -> Text
bodyText = TE.decodeUtf8 . BL.toStrict . simpleBody

-- | Run a single-column query directly against the test database.
scalarQuery :: FromField a => String -> String -> IO [a]
scalarQuery url q = do
  c <- connectPostgreSQL (BS.pack url)
  rs <- query_ c (fromString q)
  close c
  pure (map fromOnly rs)

acctOperating, acctCard, vendorAbc, vendorRival, wsB :: BS.ByteString
acctOperating = "00000000-0000-0000-0000-00000000ac01"
acctCard = "00000000-0000-0000-0000-00000000ac03"
vendorAbc = "00000000-0000-0000-0000-000000000002"
vendorRival = "00000000-0000-0000-0000-0000000000f1"
wsB = "00000000-0000-0000-0000-00000000bbbb"

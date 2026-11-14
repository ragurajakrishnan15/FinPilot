-- | Configuration from environment variables. Secrets are never logged or shown.
module FinPilot.Config
  ( Config (..)
  , loadConfig
  ) where

import qualified Data.ByteString.Char8 as BS
import Data.Maybe (fromMaybe)
import Data.Text (Text)
import qualified Data.Text as T
import System.Environment (lookupEnv)
import Text.Read (readMaybe)

data Config = Config
  { port :: Int
  , appEnv :: Text
  , databaseUrl :: BS.ByteString
  , jwtSecret :: BS.ByteString
  , jwtIssuer :: Maybe Text
  , corsOrigins :: [BS.ByteString]
  , demoMode :: Bool
  , maxCommandInputChars :: Int
  , maxToolCallsPerTurn :: Int
  , groqApiKey :: Maybe Text
  , groqModel :: Maybe Text
  , groqBaseUrl :: String
  , groqTimeoutSeconds :: Int
  }

instance Show Config where
  -- Deliberately omits secrets and connection strings.
  show c = "Config{port=" <> show c.port <> ",appEnv=" <> T.unpack c.appEnv <> ",demoMode=" <> show c.demoMode <> "}"

env :: String -> String -> IO String
env k d = fromMaybe d <$> lookupEnv k

envInt :: String -> Int -> IO Int
envInt k d = (\v -> fromMaybe d (v >>= readMaybe)) <$> lookupEnv k

nonEmpty :: String -> Maybe String
nonEmpty "" = Nothing
nonEmpty s = Just s

-- | Fails fast on unsafe production configuration.
loadConfig :: IO (Either String Config)
loadConfig = do
  port' <- envInt "PORT" 8080
  appEnv' <- env "APP_ENV" "development"
  db <- env "DATABASE_URL" "postgresql://finpilot:finpilot@localhost:5432/finpilot"
  secret <- env "JWT_SECRET" ""
  issuer <- (>>= nonEmpty) <$> lookupEnv "JWT_ISSUER"
  origins <- env "CORS_ALLOWED_ORIGINS" "http://localhost:5173"
  demo <- env "DEMO_MODE" "false"
  maxIn <- envInt "MAX_COMMAND_INPUT_CHARS" 4000
  maxTools <- envInt "MAX_TOOL_CALLS_PER_TURN" 5
  gKey <- (>>= nonEmpty) <$> lookupEnv "GROQ_API_KEY"
  gModel <- (>>= nonEmpty) <$> lookupEnv "GROQ_MODEL"
  gBase <- env "GROQ_BASE_URL" "https://api.groq.com/openai/v1"
  gTimeout <- envInt "GROQ_TIMEOUT_SECONDS" 30
  let isProd = appEnv' == "production"
      weak = length secret < 32
  pure $
    if weak && isProd
      then Left "JWT_SECRET must be set to at least 32 characters when APP_ENV=production"
      else
        if null secret
          then Left "JWT_SECRET is required (use a random 32+ character value; see .env.example)"
          else
            Right
              Config
                { port = port'
                , appEnv = T.pack appEnv'
                , databaseUrl = BS.pack db
                , jwtSecret = BS.pack secret
                , jwtIssuer = T.pack <$> issuer
                , corsOrigins = BS.pack <$> filter (not . null) (splitOn ',' origins)
                , demoMode = demo == "true"
                , maxCommandInputChars = maxIn
                , maxToolCallsPerTurn = maxTools
                , groqApiKey = T.pack <$> gKey
                , groqModel = T.pack <$> gModel
                , groqBaseUrl = gBase
                , groqTimeoutSeconds = gTimeout
                }

splitOn :: Char -> String -> [String]
splitOn c s = case break (== c) s of
  (a, []) -> [trim a]
  (a, _ : rest) -> trim a : splitOn c rest
  where
    trim = reverse . dropWhile (== ' ') . reverse . dropWhile (== ' ')

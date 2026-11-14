-- | Small Groq (OpenAI-compatible chat completions) client. The model name and key come from
-- configuration (GROQ_MODEL / GROQ_API_KEY); neither is ever logged or returned to the browser.
-- The rest of the app depends only on the 'LlmClient' interface so it can be tested with a fake.
module FinPilot.AI.GroqClient
  ( LlmClient (..)
  , LlmReply (..)
  , ToolCall (..)
  , LlmError (..)
  , mkGroqClient
  , notConfiguredClient
  , parseReply
  ) where

import Control.Exception (try)
import Data.Aeson
import Data.Aeson.Types (Parser, parseMaybe)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import FinPilot.Config
import Network.HTTP.Client
import Network.HTTP.Client.TLS (newTlsManagerWith, tlsManagerSettings)
import Network.HTTP.Types (statusCode)

data ToolCall = ToolCall {callId :: Text, toolName :: Text, toolArgs :: Text}
  deriving stock (Show, Eq)

data LlmReply = LlmReply {replyContent :: Maybe Text, replyToolCalls :: [ToolCall]}
  deriving stock (Show, Eq)

data LlmError = LlmNotConfigured | LlmTimeout | LlmRateLimited | LlmProviderError Int | LlmBadResponse | LlmNetwork
  deriving stock (Show, Eq)

-- | @runLlm messages toolDefinitions@
newtype LlmClient = LlmClient {runLlm :: [Value] -> [Value] -> IO (Either LlmError LlmReply)}

notConfiguredClient :: LlmClient
notConfiguredClient = LlmClient (\_ _ -> pure (Left LlmNotConfigured))

maxResponseBytes :: Int
maxResponseBytes = 1024 * 1024

mkGroqClient :: Config -> IO LlmClient
mkGroqClient cfg = case (cfg.groqApiKey, cfg.groqModel) of
  (Just key, Just model) -> do
    mgr <- newTlsManagerWith tlsManagerSettings {managerResponseTimeout = responseTimeoutMicro (cfg.groqTimeoutSeconds * 1000000)}
    pure (LlmClient (call mgr key model))
  _ -> pure notConfiguredClient
  where
    call mgr key model msgs tools = do
      reqE <- try (parseRequest (cfg.groqBaseUrl <> "/chat/completions"))
      case reqE of
        Left (_ :: HttpException) -> pure (Left LlmNetwork)
        Right base -> do
          let body =
                object $
                  ["model" .= model, "messages" .= msgs, "temperature" .= (0 :: Int), "max_tokens" .= (1024 :: Int)]
                    ++ (if null tools then [] else ["tools" .= tools, "tool_choice" .= ("auto" :: Text)])
              req =
                base
                  { method = "POST"
                  , requestHeaders = [("Authorization", "Bearer " <> TE.encodeUtf8 key), ("Content-Type", "application/json")]
                  , requestBody = RequestBodyLBS (encode body)
                  }
          r <- try (withResponse req mgr (\resp -> (,) (responseStatus resp) <$> brReadSome (responseBody resp) maxResponseBytes))
          pure $ case r of
            Left (HttpExceptionRequest _ ResponseTimeout) -> Left LlmTimeout
            Left (HttpExceptionRequest _ ConnectionTimeout) -> Left LlmTimeout
            Left (_ :: HttpException) -> Left LlmNetwork
            Right (st, bytes)
              | statusCode st == 429 -> Left LlmRateLimited
              | statusCode st < 200 || statusCode st >= 300 -> Left (LlmProviderError (statusCode st))
              | otherwise -> maybe (Left LlmBadResponse) Right (decode bytes >>= parseReply)

-- | Parse an OpenAI-compatible chat completion response.
parseReply :: Value -> Maybe LlmReply
parseReply = parseMaybe $ withObject "completion" $ \o -> do
  choices <- o .: "choices" :: Parser [Value]
  case choices of
    [] -> fail "no choices"
    (c : _) -> flip (withObject "choice") c $ \co -> do
      msg <- co .: "message"
      flip (withObject "message") msg $ \mo -> do
        content <- mo .:? "content"
        calls <- mo .:? "tool_calls" .!= []
        LlmReply (T.strip <$> content) <$> mapM parseCall calls
  where
    parseCall = withObject "tool_call" $ \o -> do
      i <- o .: "id"
      fn <- o .: "function"
      flip (withObject "function") fn $ \f -> ToolCall i <$> f .: "name" <*> (f .:? "arguments" .!= "{}")

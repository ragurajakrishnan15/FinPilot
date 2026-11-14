-- | Bounded agent loop: model <-> tools.
-- Bounds: at most 'maxCalls' tool executions per turn (extra requested calls are refused and the
-- model is told so), at most maxCalls+2 model rounds, history capped by the caller, tool results
-- capped in size. Unknown tools / malformed arguments are rejected by the dispatcher.
-- UI blocks come only from tool outcomes (database results), never from model text.
module FinPilot.AI.AgentLoop
  ( AgentResult (..)
  , runAgent
  ) where

import Control.Monad (forM)
import Data.Aeson
import qualified Data.ByteString.Lazy as BL
import Data.Maybe (fromMaybe)
import Data.Pool (Pool, withResource)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Data.Time (Day)
import Database.PostgreSQL.Simple (Connection)
import FinPilot.AI.GroqClient
import FinPilot.AI.PromptBuilder (systemPrompt)
import FinPilot.AI.ToolDefinitions (toolDefinitions)
import FinPilot.AI.ToolDispatcher
import qualified FinPilot.Database.Queries as Q
import FinPilot.Types

data AgentResult = AgentResult
  { answer :: Text
  , uiBlocks :: [UiBlock]
  , activity :: [ToolActivity]
  }

maxBlocks :: Int
maxBlocks = 6

maxToolResultBytes :: Int
maxToolResultBytes = 6000

maxAnswerChars :: Int
maxAnswerChars = 4000

-- | @runAgent llm pool maxCalls ctx today history userMessage@. History is (role, text) pairs, oldest first.
runAgent :: LlmClient -> Pool Connection -> Int -> Ctx -> Day -> [(Text, Text)] -> Text -> IO (Either LlmError AgentResult)
runAgent llm pool maxCalls ctx today history userMsg = go initial 0 [] [] (0 :: Int)
  where
    initial =
      [msg "system" (systemPrompt today ctx)]
        ++ [msg r c | (r, c) <- history, r `elem` ["user", "assistant"]]
        ++ [msg "user" userMsg]
    msg :: Text -> Text -> Value
    msg r c = object ["role" .= r, "content" .= c]

    go msgs used blocks acts round
      | round > maxCalls + 2 = finish "I couldn't complete that request. Please try rephrasing it." blocks acts
      | otherwise = do
          -- Once the tool budget is spent, withhold the tools so the model must answer.
          reply <- runLlm llm msgs (if used >= maxCalls then [] else toolDefinitions)
          case reply of
            Left e -> pure (Left e)
            Right r
              | null r.replyToolCalls ->
                  finish (fromMaybe "" r.replyContent) blocks acts
              | otherwise -> do
                  let (now, over) = splitAt (max 0 (maxCalls - used)) r.replyToolCalls
                  done <- forM now $ \tc -> do
                    out <- withResource pool (\c -> dispatchTool c ctx today tc.toolName tc.toolArgs)
                    -- Audit tool name + status only (no arguments, no prompt content).
                    withResource pool (\c -> Q.insertAudit c ctx.workspaceId ("AI: " <> T.take 40 tc.toolName) "ai_tool.invoked" (T.take 40 tc.toolName) out.outcomeStatus (object []))
                    pure (tc, out)
                  let refused = [(tc, ToolOutcome (object ["error" .= ("tool_call_limit_reached" :: Text)]) [] "rejected") | tc <- over]
                      all' = done ++ refused
                      assistantMsg =
                        object
                          [ "role" .= ("assistant" :: Text)
                          , "content" .= r.replyContent
                          , "tool_calls" .= [object ["id" .= tc.callId, "type" .= ("function" :: Text), "function" .= object ["name" .= tc.toolName, "arguments" .= tc.toolArgs]] | tc <- r.replyToolCalls]
                          ]
                      toolMsgs = [object ["role" .= ("tool" :: Text), "tool_call_id" .= tc.callId, "content" .= bounded out.result] | (tc, out) <- all']
                  go
                    (msgs ++ [assistantMsg] ++ toolMsgs)
                    (used + length now)
                    (blocks ++ concatMap (\(_, o) -> o.blocks) all')
                    (acts ++ [ToolActivity tc.toolName o.outcomeStatus | (tc, o) <- all'])
                    (round + 1)

    finish txt blocks acts =
      let a = T.take maxAnswerChars (T.strip txt)
       in pure (Right (AgentResult (if T.null a then "I wasn't able to produce an answer. Please try rephrasing." else a) (take maxBlocks blocks) acts))

-- | Tool results sent back to the model are size-capped.
bounded :: Value -> Text
bounded v =
  let t = TE.decodeUtf8 (BL.toStrict (encode v))
   in if T.length t > maxToolResultBytes then "{\"error\":\"result_too_large\"}" else t

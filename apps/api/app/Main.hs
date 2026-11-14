module Main (main) where

import Data.Pool (defaultPoolConfig, newPool)
import Database.PostgreSQL.Simple (close, connectPostgreSQL)
import FinPilot.AI.GroqClient (mkGroqClient)
import FinPilot.App (mkApp)
import FinPilot.Config
import FinPilot.Handlers (Env (..))
import Network.Wai.Handler.Warp (run)
import System.Exit (exitFailure)
import System.IO (hPutStrLn, stderr)

main :: IO ()
main = do
  cfg <- loadConfig
  case cfg of
    Left err -> hPutStrLn stderr ("Configuration error: " <> err) >> exitFailure
    Right c -> do
      pool <- newPool (defaultPoolConfig (connectPostgreSQL c.databaseUrl) close 30 10)
      llm <- mkGroqClient c
      putStrLn ("finpilot-api listening on port " <> show c.port <> " (" <> show c <> ")")
      putStrLn ("AI assistant: " <> maybe "NOT configured (set GROQ_API_KEY and GROQ_MODEL)" (const "configured") (c.groqApiKey >> c.groqModel))
      run c.port (mkApp (Env pool c llm))

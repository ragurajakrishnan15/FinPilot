-- | WAI application: authentication, CORS, security headers, request-size guard, logging.
module FinPilot.App
  ( mkApp
  , authHandler
  ) where

import Control.Monad.IO.Class (liftIO)
import qualified Data.ByteString as BS
import Data.Pool (withResource)
import Data.UUID (UUID)
import qualified Data.UUID as UUID
import FinPilot.Api (api)
import FinPilot.Auth.Jwt
import FinPilot.Config
import qualified FinPilot.Database.Queries as Q
import FinPilot.Error
import FinPilot.Handlers
import FinPilot.Types (Ctx)
import Data.Time.Clock.POSIX (getPOSIXTime)
import Network.HTTP.Types (hAuthorization, status413)
import Network.Wai
import Network.Wai.Middleware.Cors
import Network.Wai.Middleware.RequestLogger (logStdout)
import Servant (Context (..), serveWithContext)
import Servant.Server.Experimental.Auth (AuthHandler, mkAuthHandler)

maxBodyBytes :: Integer
maxBodyBytes = 64 * 1024

-- | Verifies the bearer token, then resolves user + workspace from the database.
-- A client-supplied X-Workspace-Id is only honoured if the user is a member of that workspace.
authHandler :: Env -> AuthHandler Request Ctx
authHandler env = mkAuthHandler $ \req -> do
  let hdrs = requestHeaders req
  tok <- case lookup hAuthorization hdrs of
    Just h | "Bearer " `BS.isPrefixOf` h -> pure (BS.drop 7 h)
    _ -> unauthorized
  now <- liftIO getPOSIXTime
  claims <- either (const unauthorized) pure (verifyJwt env.config.jwtSecret env.config.jwtIssuer (floor now) tok)
  wanted <- case lookup "X-Workspace-Id" hdrs of
    Nothing -> pure Nothing
    Just raw -> maybe (badRequest "Invalid X-Workspace-Id") (pure . Just) (UUID.fromASCIIBytes raw :: Maybe UUID)
  mctx <- liftIO (withResource env.pool (\c -> Q.resolveCtx c claims.sub wanted))
  maybe (forbidden "No access to a workspace for this user") pure mctx

securityHeaders :: Middleware
securityHeaders app req respond =
  app req (respond . mapResponseHeaders (++ extra))
  where
    extra =
      [ ("X-Content-Type-Options", "nosniff")
      , ("Cache-Control", "no-store")
      , ("Referrer-Policy", "no-referrer")
      , ("X-Frame-Options", "DENY")
      ]

limitBody :: Middleware
limitBody app req respond = case requestBodyLength req of
  KnownLength n | toInteger n > maxBodyBytes -> respond (responseLBS status413 [("Content-Type", "application/json")] "{\"code\":\"payload_too_large\",\"message\":\"Request body too large\"}")
  _ -> app req respond

mkApp :: Env -> Application
mkApp env =
  logStdout . securityHeaders . cors (const (Just policy)) . limitBody $
    serveWithContext api (authHandler env :. EmptyContext) (server env)
  where
    policy =
      simpleCorsResourcePolicy
        { corsOrigins = Just (env.config.corsOrigins, True)
        , corsMethods = ["GET", "POST", "OPTIONS"]
        , corsRequestHeaders = ["Authorization", "Content-Type", "X-Workspace-Id", "Idempotency-Key"]
        }

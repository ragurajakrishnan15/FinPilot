-- | Consistent, safe API errors: {code, message, details?}. Never includes stack traces or secrets.
module FinPilot.Error
  ( apiError
  , badRequest
  , validationError
  , unauthorized
  , forbidden
  , notFound
  , conflict
  , internalError
  , serviceUnavailable
  ) where

import Control.Monad.Error.Class (MonadError, throwError)
import Data.Aeson (encode, object, (.=))
import qualified Data.Map.Strict as M
import Data.Text (Text)
import Servant (ServerError (..), err400, err401, err403, err404, err409, err422, err500, err503)

apiError :: MonadError ServerError m => ServerError -> Text -> Text -> M.Map Text Text -> m a
apiError base code msg details =
  throwError
    base
      { errBody = encode (object (["code" .= code, "message" .= msg] ++ ["details" .= details | not (M.null details)]))
      , errHeaders = [("Content-Type", "application/json")]
      }

badRequest :: MonadError ServerError m => Text -> m a
badRequest m = apiError err400 "bad_request" m M.empty

validationError :: MonadError ServerError m => M.Map Text Text -> m a
validationError = apiError err422 "validation_error" "Request validation failed"

unauthorized :: MonadError ServerError m => m a
unauthorized = apiError err401 "unauthorized" "Authentication required" M.empty

forbidden :: MonadError ServerError m => Text -> m a
forbidden m = apiError err403 "forbidden" m M.empty

notFound :: MonadError ServerError m => Text -> m a
notFound what = apiError err404 "not_found" (what <> " not found") M.empty

conflict :: MonadError ServerError m => Text -> Text -> m a
conflict code m = apiError err409 code m M.empty

internalError :: MonadError ServerError m => m a
internalError = apiError err500 "internal_error" "Something went wrong" M.empty

serviceUnavailable :: MonadError ServerError m => Text -> m a
serviceUnavailable m = apiError err503 "service_unavailable" m M.empty

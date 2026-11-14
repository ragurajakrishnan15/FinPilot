-- | Minimal HS256 JWT signing/verification.
-- Verification rules: exactly alg=HS256 (no "none"), constant-time signature check,
-- mandatory non-empty `sub` and `exp`, optional `nbf`, and optional `iss` match.
-- Asymmetric (JWKS) verification for Supabase projects is a documented follow-up.
module FinPilot.Auth.Jwt
  ( Claims (..)
  , JwtError (..)
  , signJwt
  , verifyJwt
  ) where

import Crypto.Hash.Algorithms (SHA256)
import Crypto.MAC.HMAC (HMAC, hmac, hmacGetDigest)
import Data.Aeson
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteArray as BA
import qualified Data.ByteString as BS
import qualified Data.ByteString.Base64.URL as B64
import qualified Data.ByteString.Lazy as BL
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE

data Claims = Claims
  { sub :: Text
  , exp_ :: Integer
  , iss :: Maybe Text
  }
  deriving stock (Show, Eq)

data JwtError = Malformed | BadAlgorithm | BadSignature | Expired | NotYetValid | BadIssuer | MissingClaim
  deriving stock (Show, Eq)

hs256 :: BS.ByteString -> BS.ByteString -> BS.ByteString
hs256 secret msg = BA.convert (hmacGetDigest (hmac secret msg :: HMAC SHA256))

signJwt :: BS.ByteString -> Claims -> Text
signJwt secret c =
  let header = BL.toStrict (encode (object ["alg" .= ("HS256" :: Text), "typ" .= ("JWT" :: Text)]))
      payload =
        BL.toStrict $
          encode $
            object (["sub" .= c.sub, "exp" .= c.exp_] ++ ["iss" .= i | Just i <- [c.iss]])
      signingInput = B64.encodeUnpadded header <> "." <> B64.encodeUnpadded payload
   in TE.decodeUtf8 (signingInput <> "." <> B64.encodeUnpadded (hs256 secret signingInput))

-- | @verifyJwt secret expectedIssuer nowEpochSeconds token@
verifyJwt :: BS.ByteString -> Maybe Text -> Integer -> BS.ByteString -> Either JwtError Claims
verifyJwt secret expectedIss now tok = do
  (h, p, s) <- case BS.split 46 tok of
    [h, p, s] | not (BS.null h || BS.null p || BS.null s) -> Right (h, p, s)
    _ -> Left Malformed
  hdr <- decodePart h
  case KM.lookup "alg" hdr of
    Just (String "HS256") -> Right ()
    _ -> Left BadAlgorithm
  sig <- either (const (Left Malformed)) Right (B64.decodeUnpadded s)
  let expected = hs256 secret (h <> "." <> p)
  if BA.constEq expected sig then Right () else Left BadSignature
  pl <- decodePart p
  subj <- case KM.lookup "sub" pl of
    Just (String t) | not (T.null t) -> Right t
    _ -> Left MissingClaim
  expT <- case KM.lookup "exp" pl of
    Just (Number n) -> Right (floor n :: Integer)
    _ -> Left MissingClaim
  if expT <= now then Left Expired else Right ()
  case KM.lookup "nbf" pl of
    Just (Number n) | (floor n :: Integer) > now -> Left NotYetValid
    _ -> Right ()
  let tokIss = case KM.lookup "iss" pl of Just (String t) -> Just t; _ -> Nothing
  case expectedIss of
    Just want | tokIss /= Just want -> Left BadIssuer
    _ -> Right ()
  pure (Claims subj expT tokIss)
  where
    decodePart :: BS.ByteString -> Either JwtError Object
    decodePart b = do
      raw <- either (const (Left Malformed)) Right (B64.decodeUnpadded b)
      maybe (Left Malformed) Right (decodeStrict raw)

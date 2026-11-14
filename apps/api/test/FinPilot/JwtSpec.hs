module FinPilot.JwtSpec (spec) where

import qualified Data.ByteString.Base64.URL as B64
import qualified Data.ByteString.Char8 as BS
import qualified Data.Text.Encoding as TE
import FinPilot.Auth.Jwt
import Test.Hspec

secret :: BS.ByteString
secret = "unit-test-secret-at-least-32-characters-long"

now :: Integer
now = 1_800_000_000

good :: Claims
good = Claims {sub = "demo-user-1", exp_ = now + 600, iss = Nothing}

tokenOf :: Claims -> BS.ByteString
tokenOf = TE.encodeUtf8 . signJwt secret

spec :: Spec
spec = describe "JWT (HS256)" $ do
  it "accepts a valid token" $
    verifyJwt secret Nothing now (tokenOf good) `shouldBe` Right good

  it "rejects an expired token" $
    verifyJwt secret Nothing now (tokenOf good {exp_ = now - 1}) `shouldBe` Left Expired

  it "rejects a token signed with another secret" $
    verifyJwt "another-secret-another-secret-another" Nothing now (tokenOf good) `shouldBe` Left BadSignature

  it "rejects a tampered payload" $ do
    let [h, _, s] = BS.split '.' (tokenOf good)
        forged = B64.encodeUnpadded "{\"sub\":\"admin\",\"exp\":9999999999}"
    verifyJwt secret Nothing now (BS.intercalate "." [h, forged, s]) `shouldBe` Left BadSignature

  it "rejects alg=none tokens" $ do
    let h = B64.encodeUnpadded "{\"alg\":\"none\",\"typ\":\"JWT\"}"
        p = B64.encodeUnpadded "{\"sub\":\"demo-user-1\",\"exp\":9999999999}"
    verifyJwt secret Nothing now (BS.intercalate "." [h, p, ""]) `shouldBe` Left Malformed
    verifyJwt secret Nothing now (BS.intercalate "." [h, p, "x"]) `shouldBe` Left BadAlgorithm

  it "rejects other algorithms" $ do
    let h = B64.encodeUnpadded "{\"alg\":\"HS512\"}"
        p = B64.encodeUnpadded "{\"sub\":\"a\",\"exp\":9999999999}"
    verifyJwt secret Nothing now (BS.intercalate "." [h, p, "x"]) `shouldBe` Left BadAlgorithm

  it "rejects malformed tokens" $ do
    mapM_ (\t -> verifyJwt secret Nothing now t `shouldBe` Left Malformed) ["", "abc", "a.b", "a.b.c.d"]

  it "enforces the issuer when configured" $ do
    let c = good {iss = Just "https://issuer.example"}
    verifyJwt secret (Just "https://issuer.example") now (tokenOf c) `shouldBe` Right c
    verifyJwt secret (Just "https://other.example") now (tokenOf c) `shouldBe` Left BadIssuer
    verifyJwt secret (Just "https://issuer.example") now (tokenOf good) `shouldBe` Left BadIssuer

  it "requires a non-empty subject" $
    verifyJwt secret Nothing now (tokenOf good {sub = ""}) `shouldBe` Left MissingClaim

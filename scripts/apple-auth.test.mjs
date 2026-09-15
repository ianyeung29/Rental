import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import test from "node:test";
import { appleAuthorizationUrl, createAppleClientSecret, verifyAppleIdentityTokenWithJwks } from "../app/lib/apple.ts";

const envNames = ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "APPLE_REDIRECT_URI"];

function withAppleEnvironment(values, run) {
  const prior = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  Object.assign(process.env, values);
  try {
    return run();
  } finally {
    for (const name of envNames) {
      if (prior[name] === undefined) delete process.env[name];
      else process.env[name] = prior[name];
    }
  }
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signedIdentityToken(privateKey, claims, header = { alg: "RS256", kid: "apple-test-key" }) {
  const signingInput = encode(header) + "." + encode(claims);
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return signingInput + "." + signature.toString("base64url");
}

test("Apple authorization URL uses the registered Services ID and POST callback", () => {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const url = withAppleEnvironment({
    APPLE_CLIENT_ID: "com.anjurentals.web",
    APPLE_TEAM_ID: "TEAM123456",
    APPLE_KEY_ID: "KEY1234567",
    APPLE_PRIVATE_KEY: privateKey,
    APPLE_REDIRECT_URI: "https://www.anjurentals.com/api/auth/apple/callback",
  }, () => new URL(appleAuthorizationUrl("state-value", "nonce-value")));

  assert.equal(url.origin, "https://appleid.apple.com");
  assert.equal(url.pathname, "/auth/authorize");
  assert.equal(url.searchParams.get("client_id"), "com.anjurentals.web");
  assert.equal(url.searchParams.get("redirect_uri"), "https://www.anjurentals.com/api/auth/apple/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("response_mode"), "form_post");
  assert.equal(url.searchParams.get("scope"), "name email");
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("nonce"), "nonce-value");
});

test("Apple client secret is signed as an ES256 JWT for the Services ID", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const token = withAppleEnvironment({
    APPLE_CLIENT_ID: "com.anjurentals.web",
    APPLE_TEAM_ID: "TEAM123456",
    APPLE_KEY_ID: "KEY1234567",
    APPLE_PRIVATE_KEY: privateKey,
    APPLE_REDIRECT_URI: "https://www.anjurentals.com/api/auth/apple/callback",
  }, () => createAppleClientSecret());
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

  assert.equal(header.alg, "ES256");
  assert.equal(header.kid, "KEY1234567");
  assert.equal(payload.iss, "TEAM123456");
  assert.equal(payload.aud, "https://appleid.apple.com");
  assert.equal(payload.sub, "com.anjurentals.web");
  assert.equal(payload.exp - payload.iat, 300);
  assert.equal(verify("sha256", Buffer.from(encodedHeader + "." + encodedPayload), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(encodedSignature, "base64url")), true);
});

test("Apple identity token verification checks signature, issuer, audience, expiry, and nonce", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "apple-test-key", use: "sig", alg: "RS256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://appleid.apple.com",
    aud: "com.anjurentals.web",
    exp: now + 600,
    iat: now,
    sub: "apple-subject-123",
    nonce: "expected-nonce",
    email: "renter@privaterelay.appleid.com",
    email_verified: true,
  };
  const token = signedIdentityToken(privateKey, claims);
  const jwks = { keys: [jwk] };
  const result = verifyAppleIdentityTokenWithJwks(token, "expected-nonce", "com.anjurentals.web", jwks);
  assert.equal(result.sub, claims.sub);
  assert.equal(result.email, claims.email);

  assert.throws(() => verifyAppleIdentityTokenWithJwks(token, "wrong-nonce", "com.anjurentals.web", jwks), /nonce is invalid/);
  assert.throws(() => verifyAppleIdentityTokenWithJwks(token, "expected-nonce", "different-client", jwks), /issuer or audience is invalid/);
  assert.throws(() => verifyAppleIdentityTokenWithJwks(signedIdentityToken(privateKey, { ...claims, exp: now - 1 }), "expected-nonce", "com.anjurentals.web", jwks), /expired or not yet valid/);
  assert.throws(() => verifyAppleIdentityTokenWithJwks(signedIdentityToken(privateKey, claims, { alg: "none", kid: "apple-test-key" }), "expected-nonce", "com.anjurentals.web", jwks), /unsupported identity token/);
});

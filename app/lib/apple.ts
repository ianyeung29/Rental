import { createPrivateKey, createPublicKey, randomBytes, sign as signJwt, verify as verifyJwt } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";
import { isIP } from "node:net";
import type { AccountType } from "./account-types";

export const APPLE_STATE_COOKIE = "apple_oauth_state";
export const APPLE_NONCE_COOKIE = "apple_oauth_nonce";
export const APPLE_ACCOUNT_TYPE_COOKIE = "apple_oauth_account_type";

const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const STATE_TTL_SECONDS = 600;

export class AppleConfigError extends Error {
  status = 503;
}

type AppleJwk = NodeJsonWebKey & {
  kid: string;
  kty: string;
  use?: string;
  alg?: string;
};

type AppleJwkSet = { keys: AppleJwk[] };

export type AppleIdentityClaims = {
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  sub: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
};

type AppleConfig = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  redirectUri: string;
};

let cachedJwks: { value: AppleJwkSet; expiresAt: number } | null = null;

function normalizeAppleAccountType(value: unknown): AccountType {
  return value === "agent" ? "agent" : "user";
}

function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3010")).replace(/\/+$/, "");
}

function configuredRedirectUri() {
  const redirectUri = (process.env.APPLE_REDIRECT_URI || appBaseUrl() + "/api/auth/apple/callback").trim();
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new AppleConfigError("Apple sign-in needs a valid HTTPS callback URL.");
  }
  if (url.protocol !== "https:" || !url.hostname || url.hash || url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || isIP(url.hostname)) {
    throw new AppleConfigError("Apple sign-in needs a registered HTTPS callback URL with a public domain.");
  }
  return redirectUri;
}

function appleConfig(): AppleConfig {
  const clientId = process.env.APPLE_CLIENT_ID?.trim() || "";
  const teamId = process.env.APPLE_TEAM_ID?.trim() || "";
  const keyId = process.env.APPLE_KEY_ID?.trim() || "";
  const privateKey = (process.env.APPLE_PRIVATE_KEY || "").trim().replace(/\\n/g, "\n");
  if (!clientId || !teamId || !keyId || !privateKey) {
    throw new AppleConfigError("Apple sign-in is not configured on the server yet.");
  }
  return { clientId, teamId, keyId, privateKey, redirectUri: configuredRedirectUri() };
}

export function appleIsConfigured() {
  try {
    appleConfig();
    return true;
  } catch {
    return false;
  }
}

export function createAppleState() {
  return randomBytes(32).toString("base64url");
}

export function createAppleNonce() {
  return randomBytes(32).toString("base64url");
}

export function appleAuthorizationUrl(state: string, nonce: string) {
  const config = appleConfig();
  const url = new URL(APPLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  return url.toString();
}

function setShortLivedCookie(response: Response, name: string, value: string) {
  const mutableResponse = response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } };
  mutableResponse.cookies?.set({
    name,
    value,
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
}

function clearShortLivedCookie(response: Response, name: string) {
  const mutableResponse = response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } };
  mutableResponse.cookies?.set({
    name,
    value: "",
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

export function setAppleFlowCookies(response: Response, state: string, nonce: string, accountType: AccountType) {
  setShortLivedCookie(response, APPLE_STATE_COOKIE, state);
  setShortLivedCookie(response, APPLE_NONCE_COOKIE, nonce);
  setShortLivedCookie(response, APPLE_ACCOUNT_TYPE_COOKIE, normalizeAppleAccountType(accountType));
}

export function clearAppleFlowCookies(response: Response) {
  clearShortLivedCookie(response, APPLE_STATE_COOKIE);
  clearShortLivedCookie(response, APPLE_NONCE_COOKIE);
  clearShortLivedCookie(response, APPLE_ACCOUNT_TYPE_COOKIE);
}

export function createAppleClientSecret() {
  const config = appleConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: config.keyId, typ: "JWT" };
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + 300,
    aud: "https://appleid.apple.com",
    sub: config.clientId,
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = encode(header) + "." + encode(payload);
  const signature = signJwt("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return signingInput + "." + signature.toString("base64url");
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

export function verifyAppleIdentityTokenWithJwks(idToken: string, expectedNonce: string, clientId: string, jwks: AppleJwkSet): AppleIdentityClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error("Apple returned a malformed identity token.");
  const header = decodeJsonSegment<{ alg?: string; kid?: string }>(parts[0]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Apple returned an unsupported identity token.");
  const jwk = jwks.keys.find((key) => key.kid === header.kid && key.kty === "RSA" && (!key.use || key.use === "sig") && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw new Error("Apple identity token signing key was not found.");
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signingInput = parts[0] + "." + parts[1];
  const signature = Buffer.from(parts[2], "base64url");
  if (!verifyJwt("RSA-SHA256", Buffer.from(signingInput), publicKey, signature)) throw new Error("Apple identity token signature is invalid.");

  const claims = decodeJsonSegment<AppleIdentityClaims>(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== "https://appleid.apple.com" || !audiences.includes(clientId)) throw new Error("Apple identity token issuer or audience is invalid.");
  if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 300) throw new Error("Apple identity token is expired or not yet valid.");
  if (!claims.sub || typeof claims.sub !== "string" || claims.nonce !== expectedNonce) throw new Error("Apple identity token subject or nonce is invalid.");
  return claims;
}

async function appleJwks() {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.value;
  const response = await fetch(APPLE_KEYS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Apple public keys could not be loaded.");
  const body = await response.json() as AppleJwkSet;
  if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error("Apple returned no public keys.");
  cachedJwks = { value: body, expiresAt: Date.now() + 60 * 60 * 1000 };
  return body;
}

function cleanNamePart(value: unknown) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) : "";
}

function nameFromAppleUser(userValue: unknown) {
  if (typeof userValue !== "string" || userValue.length > 5_000) return "";
  let user: { name?: { firstName?: unknown; lastName?: unknown } };
  try {
    user = JSON.parse(userValue) as { name?: { firstName?: unknown; lastName?: unknown } };
  } catch {
    return "";
  }
  return [cleanNamePart(user.name?.firstName), cleanNamePart(user.name?.lastName)].filter(Boolean).join(" ").slice(0, 80);
}

export async function appleProfileFromCode(code: string, expectedNonce: string, userValue: unknown) {
  const config = appleConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: createAppleClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Apple authorization code exchange failed.");
  const tokenResponse = await response.json() as { id_token?: string; error?: string };
  if (tokenResponse.error || !tokenResponse.id_token) throw new Error("Apple did not return an identity token.");

  let claims: AppleIdentityClaims;
  try {
    claims = verifyAppleIdentityTokenWithJwks(tokenResponse.id_token, expectedNonce, config.clientId, await appleJwks());
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Apple identity token signing key was not found.") throw error;
    cachedJwks = null;
    claims = verifyAppleIdentityTokenWithJwks(tokenResponse.id_token, expectedNonce, config.clientId, await appleJwks());
  }
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase().slice(0, 240) : "";
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  if (!claims.sub || !email || !/^\S+@\S+\.\S+$/.test(email) || !emailVerified) throw new Error("Apple did not return a verified email identity.");
  const displayName = nameFromAppleUser(userValue) || email.split("@")[0].slice(0, 80) || "Apple user";
  return { subject: claims.sub, email, displayName };
}

import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "node:crypto";

export const GOOGLE_STATE_COOKIE = "google_oauth_state";

class GoogleConfigError extends Error {
  status = 503;
}

function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3010")).replace(/\/+$/, "");
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl()}/api/auth/google/callback`).trim();
  if (!clientId || !clientSecret) throw new GoogleConfigError("Google login is not configured on the server yet.");
  return { clientId, clientSecret, redirectUri };
}

export function googleIsConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function createGoogleState() {
  return randomBytes(32).toString("base64url");
}

export function googleClient() {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export function googleAuthorizationUrl(state: string) {
  const { clientId } = googleConfig();
  return googleClient().generateAuthUrl({
    access_type: "online",
    client_id: clientId,
    include_granted_scopes: true,
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });
}

export async function googleProfileFromCode(code: string) {
  const { clientId } = googleConfig();
  const ticket = await googleClient().getToken(code);
  if (!ticket.tokens.id_token) throw new Error("Google did not return an identity token.");
  const verified = await googleClient().verifyIdToken({ idToken: ticket.tokens.id_token, audience: clientId });
  const payload = verified.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error("Google did not return a verified email identity.");
  return {
    subject: payload.sub,
    email: payload.email,
    displayName: String(payload.name || payload.email.split("@")[0] || "Google user").slice(0, 80),
  };
}

export function setGoogleStateCookie(response: Response, state: string) {
  const mutableResponse = response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } };
  mutableResponse.cookies?.set({
    name: GOOGLE_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
}

export function clearGoogleStateCookie(response: Response) {
  const mutableResponse = response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } };
  mutableResponse.cookies?.set({
    name: GOOGLE_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

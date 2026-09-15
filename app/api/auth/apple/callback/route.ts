import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { loginWithApple, setSessionCookie } from "../../../../lib/auth";
import { recordAuditEventSafely } from "../../../../lib/audit";
import { appleProfileFromCode, APPLE_ACCOUNT_TYPE_COOKIE, APPLE_NONCE_COOKIE, APPLE_STATE_COOKIE, clearAppleFlowCookies } from "../../../../lib/apple";
import { normalizeAccountType } from "../../../../lib/account-types";

export const runtime = "nodejs";

function matchesState(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length > 0 && receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

function redirectWithStatus(request: Request, reason: string) {
  const target = new URL("/", request.url);
  target.searchParams.set("apple", reason);
  const response = NextResponse.redirect(target, 303);
  clearAppleFlowCookies(response);
  return response;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(APPLE_STATE_COOKIE)?.value || "";
  const nonce = cookieStore.get(APPLE_NONCE_COOKIE)?.value || "";
  const requestedAccountType = normalizeAccountType(cookieStore.get(APPLE_ACCOUNT_TYPE_COOKIE)?.value);

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!contentType.startsWith("application/x-www-form-urlencoded") || contentLength > 20_000) {
    await recordAuditEventSafely({ request, eventType: "auth.apple", outcome: "failure", metadata: { reason: "invalid_response" } });
    return redirectWithStatus(request, "error");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    await recordAuditEventSafely({ request, eventType: "auth.apple", outcome: "failure", metadata: { reason: "invalid_response" } });
    return redirectWithStatus(request, "error");
  }

  const state = String(form.get("state") || "");
  if (!expectedState || !nonce || !matchesState(state, expectedState)) {
    await recordAuditEventSafely({ request, eventType: "auth.apple", outcome: "failure", metadata: { reason: "invalid_state" } });
    return redirectWithStatus(request, "invalid_state");
  }

  if (form.get("error")) {
    await recordAuditEventSafely({ request, eventType: "auth.apple", outcome: "failure", metadata: { reason: "cancelled" } });
    return redirectWithStatus(request, "cancelled");
  }

  const code = String(form.get("code") || "").trim();
  if (!code || code.length > 4_096) {
    await recordAuditEventSafely({ request, eventType: "auth.apple", outcome: "failure", metadata: { reason: "missing_code" } });
    return redirectWithStatus(request, "error");
  }

  try {
    const profile = await appleProfileFromCode(code, nonce, form.get("user"));
    const result = await loginWithApple(profile, requestedAccountType);
    const response = NextResponse.redirect(new URL("/?apple=success", request.url), 303);
    setSessionCookie(response, result.token);
    clearAppleFlowCookies(response);
    await recordAuditEventSafely({ request, eventType: "auth.apple", user: result.user, metadata: { accountType: requestedAccountType } });
    return response;
  } catch {
    await recordAuditEventSafely({ request, eventType: "auth.apple", outcome: "failure", metadata: { reason: "provider_error", accountType: requestedAccountType } });
    return redirectWithStatus(request, "error");
  }
}

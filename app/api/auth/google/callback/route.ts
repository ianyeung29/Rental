import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createMobileAuthHandoff, loginWithGoogle, setSessionCookie } from "../../../../lib/auth";
import { recordAuditEventSafely } from "../../../../lib/audit";
import { clearGoogleAccountTypeCookie, clearGoogleNativeRedirectCookie, clearGoogleStateCookie, googleProfileFromCode, GOOGLE_ACCOUNT_TYPE_COOKIE, GOOGLE_NATIVE_REDIRECT_COOKIE, GOOGLE_NATIVE_REDIRECT_URI, GOOGLE_STATE_COOKIE } from "../../../../lib/google";
import { normalizeAccountType } from "../../../../lib/account-types";

function failedRedirect(request: Request, reason: string, nativeRedirect = "") {
  if (nativeRedirect === GOOGLE_NATIVE_REDIRECT_URI) {
    const nativeUrl = new URL(nativeRedirect);
    nativeUrl.searchParams.set("status", "error");
    nativeUrl.searchParams.set("reason", reason);
    return NextResponse.redirect(nativeUrl);
  }
  const url = new URL("/", request.url);
  url.searchParams.set("google", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const nativeRedirect = cookieStore.get(GOOGLE_NATIVE_REDIRECT_COOKIE)?.value === GOOGLE_NATIVE_REDIRECT_URI ? GOOGLE_NATIVE_REDIRECT_URI : "";
  if (url.searchParams.get("error")) {
    await recordAuditEventSafely({ request, eventType: "auth.google", outcome: "failure", metadata: { reason: "cancelled" } });
    return failedRedirect(request, "cancelled", nativeRedirect);
  }
  const code = url.searchParams.get("code")?.trim() || "";
  const state = url.searchParams.get("state")?.trim() || "";
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value || "";
  const requestedAccountType = normalizeAccountType(cookieStore.get(GOOGLE_ACCOUNT_TYPE_COOKIE)?.value);
  if (!code || !state || !expectedState || state.length !== expectedState.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
    await recordAuditEventSafely({ request, eventType: "auth.google", outcome: "failure", metadata: { reason: "invalid_state" } });
    return failedRedirect(request, "invalid_state", nativeRedirect);
  }
  try {
    const profile = await googleProfileFromCode(code);
    const result = await loginWithGoogle(profile, requestedAccountType);
    const response = nativeRedirect
      ? NextResponse.redirect(new URL(`${nativeRedirect}?status=success&handoff=${encodeURIComponent(await createMobileAuthHandoff(result.user.id))}`))
      : NextResponse.redirect(new URL("/?google=success", request.url));
    if (!nativeRedirect) setSessionCookie(response, result.token);
    clearGoogleStateCookie(response);
    clearGoogleAccountTypeCookie(response);
    clearGoogleNativeRedirectCookie(response);
    await recordAuditEventSafely({ request, eventType: "auth.google", user: result.user, metadata: { accountType: requestedAccountType } });
    return response;
  } catch {
    await recordAuditEventSafely({ request, eventType: "auth.google", outcome: "failure", metadata: { reason: "provider_error", accountType: requestedAccountType } });
    return failedRedirect(request, "error", nativeRedirect);
  }
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { loginWithGoogle, setSessionCookie } from "../../../../lib/auth";
import { clearGoogleAccountTypeCookie, clearGoogleStateCookie, googleProfileFromCode, GOOGLE_ACCOUNT_TYPE_COOKIE, GOOGLE_STATE_COOKIE } from "../../../../lib/google";
import { normalizeAccountType } from "../../../../lib/account-types";

function failedRedirect(request: Request, reason: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("google", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return failedRedirect(request, "cancelled");
  const code = url.searchParams.get("code")?.trim() || "";
  const state = url.searchParams.get("state")?.trim() || "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value || "";
  const requestedAccountType = normalizeAccountType(cookieStore.get(GOOGLE_ACCOUNT_TYPE_COOKIE)?.value);
  if (!code || !state || !expectedState || state.length !== expectedState.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
    return failedRedirect(request, "invalid_state");
  }
  try {
    const profile = await googleProfileFromCode(code);
    const result = await loginWithGoogle(profile, requestedAccountType);
    const response = NextResponse.redirect(new URL("/?google=success", request.url));
    setSessionCookie(response, result.token);
    clearGoogleStateCookie(response);
    clearGoogleAccountTypeCookie(response);
    return response;
  } catch {
    return failedRedirect(request, "error");
  }
}

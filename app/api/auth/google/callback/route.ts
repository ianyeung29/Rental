import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { loginWithGoogle, setSessionCookie } from "../../../../lib/auth";
import { clearGoogleStateCookie, googleProfileFromCode, GOOGLE_STATE_COOKIE } from "../../../../lib/google";

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
  if (!code || !state || !expectedState || state.length !== expectedState.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
    return failedRedirect(request, "invalid_state");
  }
  try {
    const profile = await googleProfileFromCode(code);
    const result = await loginWithGoogle(profile);
    const response = NextResponse.redirect(new URL("/?google=success", request.url));
    setSessionCookie(response, result.token);
    clearGoogleStateCookie(response);
    return response;
  } catch {
    return failedRedirect(request, "error");
  }
}

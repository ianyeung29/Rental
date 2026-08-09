import { NextResponse } from "next/server";
import { createGoogleState, googleAuthorizationUrl, googleIsConfigured, GOOGLE_NATIVE_REDIRECT_URI, setGoogleAccountTypeCookie, setGoogleNativeRedirectCookie, setGoogleStateCookie } from "../../../lib/google";
import { normalizeAccountType } from "../../../lib/account-types";

export async function GET(request: Request) {
  const redirectUrl = new URL("/", request.url);
  if (!googleIsConfigured()) {
    redirectUrl.searchParams.set("google", "unconfigured");
    return NextResponse.redirect(redirectUrl);
  }
  try {
    const state = createGoogleState();
    const requestUrl = new URL(request.url);
    const accountType = normalizeAccountType(requestUrl.searchParams.get("accountType"));
    const nativeRedirect = requestUrl.searchParams.get("redirectUri") === GOOGLE_NATIVE_REDIRECT_URI && requestUrl.searchParams.get("native") === "1"
      ? GOOGLE_NATIVE_REDIRECT_URI
      : "";
    const response = NextResponse.redirect(googleAuthorizationUrl(state));
    setGoogleStateCookie(response, state);
    setGoogleAccountTypeCookie(response, accountType);
    if (nativeRedirect) setGoogleNativeRedirectCookie(response, nativeRedirect);
    return response;
  } catch {
    redirectUrl.searchParams.set("google", "error");
    return NextResponse.redirect(redirectUrl);
  }
}

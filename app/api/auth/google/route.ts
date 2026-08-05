import { NextResponse } from "next/server";
import { createGoogleState, googleAuthorizationUrl, googleIsConfigured, setGoogleAccountTypeCookie, setGoogleStateCookie } from "../../../lib/google";
import { normalizeAccountType } from "../../../lib/account-types";

export async function GET(request: Request) {
  const redirectUrl = new URL("/", request.url);
  if (!googleIsConfigured()) {
    redirectUrl.searchParams.set("google", "unconfigured");
    return NextResponse.redirect(redirectUrl);
  }
  try {
    const state = createGoogleState();
    const accountType = normalizeAccountType(new URL(request.url).searchParams.get("accountType"));
    const response = NextResponse.redirect(googleAuthorizationUrl(state));
    setGoogleStateCookie(response, state);
    setGoogleAccountTypeCookie(response, accountType);
    return response;
  } catch {
    redirectUrl.searchParams.set("google", "error");
    return NextResponse.redirect(redirectUrl);
  }
}

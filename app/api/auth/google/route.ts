import { NextResponse } from "next/server";
import { createGoogleState, googleAuthorizationUrl, googleIsConfigured, setGoogleStateCookie } from "../../../lib/google";

export async function GET(request: Request) {
  const redirectUrl = new URL("/", request.url);
  if (!googleIsConfigured()) {
    redirectUrl.searchParams.set("google", "unconfigured");
    return NextResponse.redirect(redirectUrl);
  }
  try {
    const state = createGoogleState();
    const response = NextResponse.redirect(googleAuthorizationUrl(state));
    setGoogleStateCookie(response, state);
    return response;
  } catch {
    redirectUrl.searchParams.set("google", "error");
    return NextResponse.redirect(redirectUrl);
  }
}

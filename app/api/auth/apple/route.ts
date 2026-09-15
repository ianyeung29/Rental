import { NextResponse } from "next/server";
import { appleAuthorizationUrl, appleIsConfigured, createAppleNonce, createAppleState, setAppleFlowCookies } from "../../../lib/apple";
import { normalizeAccountType } from "../../../lib/account-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const target = new URL("/", request.url);
  if (!appleIsConfigured()) {
    target.searchParams.set("apple", "unconfigured");
    return NextResponse.redirect(target);
  }

  try {
    const state = createAppleState();
    const nonce = createAppleNonce();
    const accountType = normalizeAccountType(new URL(request.url).searchParams.get("accountType"));
    const response = NextResponse.redirect(appleAuthorizationUrl(state, nonce));
    setAppleFlowCookies(response, state, nonce, accountType);
    return response;
  } catch {
    target.searchParams.set("apple", "error");
    return NextResponse.redirect(target);
  }
}

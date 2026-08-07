import { NextResponse } from "next/server";
import { AuthError, verifyEmailToken } from "../../../lib/auth";
import { recordAuditEventSafely } from "../../../lib/audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() || "";
  const redirectUrl = new URL("/", request.url);
  if (!token) {
    redirectUrl.searchParams.set("verified", "invalid");
    return NextResponse.redirect(redirectUrl);
  }
  try {
    await verifyEmailToken(token);
    await recordAuditEventSafely({ request, eventType: "auth.email_verify", metadata: { result: "success" } });
    redirectUrl.searchParams.set("verified", "success");
  } catch (error) {
    await recordAuditEventSafely({ request, eventType: "auth.email_verify", outcome: "failure", metadata: { result: error instanceof AuthError ? "invalid" : "error" } });
    redirectUrl.searchParams.set("verified", error instanceof AuthError ? "invalid" : "error");
  }
  return NextResponse.redirect(redirectUrl);
}

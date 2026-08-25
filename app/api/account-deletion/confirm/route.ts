import { NextResponse } from "next/server";
import { AccountDeletionError, deleteAccountWithConfirmationToken } from "../../../lib/account-deletion";
import { recordAuditEventSafely } from "../../../lib/audit";
import { clearSessionCookie } from "../../../lib/auth";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  let body: { token?: unknown } = {};
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "This account-deletion link is invalid or expired." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "This account-deletion link is invalid or expired." }, { status: 400 });

  try {
    const limit = await consumeRateLimit({ key: `account-delete:confirm:ip:${hashRateLimitPart(requestAddress(request))}`, limit: 5, windowSeconds: 60 * 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying this deletion link again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    await deleteAccountWithConfirmationToken(token);
    await recordAuditEventSafely({ request, eventType: "account.deleted", metadata: { method: "email_confirmation" } });
    const response = NextResponse.json({ deleted: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    await recordAuditEventSafely({ request, eventType: "account.deletion_confirm", outcome: "failure" });
    const status = error instanceof AccountDeletionError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account deletion is unavailable right now." }, { status });
  }
}

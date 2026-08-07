import { NextResponse } from "next/server";
import { AuthError, resetPasswordWithToken } from "../../../lib/auth";
import { recordAuditEventSafely } from "../../../lib/audit";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; password?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    const limit = await consumeRateLimit({ key: `auth:password-reset-submit:${hashRateLimitPart(requestAddress(request))}`, limit: 10, windowSeconds: 15 * 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    await resetPasswordWithToken(token, password);
    await recordAuditEventSafely({ request, eventType: "auth.password_reset_complete", metadata: { result: "success" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 503;
    await recordAuditEventSafely({ request, eventType: "auth.password_reset_complete", outcome: status === 429 ? "blocked" : "failure", metadata: { result: error instanceof AuthError ? "invalid" : "error", status } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password reset is unavailable right now." }, { status });
  }
}

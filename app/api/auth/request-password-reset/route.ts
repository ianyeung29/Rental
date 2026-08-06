import { NextResponse } from "next/server";
import { requestPasswordReset } from "../../../lib/auth";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  let body: { email?: unknown } = {};
  try {
    body = await request.json() as { email?: unknown };
  } catch {
    // Always use the same response for malformed or unknown reset requests.
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  try {
    const ipLimit = await consumeRateLimit({ key: `auth:password-reset:ip:${hashRateLimitPart(requestAddress(request))}`, limit: 10, windowSeconds: 60 * 60 });
    const emailLimit = await consumeRateLimit({ key: `auth:password-reset:email:${hashRateLimitPart(email)}`, limit: 3, windowSeconds: 60 * 60 });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return NextResponse.json({ error: "Please wait before requesting another password reset email." }, { status: 429, headers: { "Retry-After": String(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)) } });
    }
    await requestPasswordReset(email);
    return NextResponse.json({ accepted: true });
  } catch {
    return NextResponse.json({ error: "Password reset is unavailable right now." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { AuthError, loginUser, normalizeEmail, setSessionCookie } from "../../../lib/auth";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email : "";
    const ipLimit = await consumeRateLimit({ key: `auth:login:ip:${hashRateLimitPart(requestAddress(request))}`, limit: 20, windowSeconds: 15 * 60 });
    const emailLimit = await consumeRateLimit({ key: `auth:login:email:${hashRateLimitPart(normalizeEmail(email))}`, limit: 10, windowSeconds: 15 * 60 });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
      return NextResponse.json({ error: "Too many sign-in attempts. Please wait and try again." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
    }
    const result = await loginUser({
      email,
      password: typeof body.password === "string" ? body.password : "",
    });
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.token);
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign in is unavailable right now." }, { status });
  }
}

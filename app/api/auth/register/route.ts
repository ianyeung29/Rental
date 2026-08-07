import { NextResponse } from "next/server";
import { AuthError, normalizeEmail, registerUser, setSessionCookie } from "../../../lib/auth";
import { recordAuditEventSafely } from "../../../lib/audit";
import { hashRateLimitPart } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  let email = "";
  let accountType = "user";
  try {
    const body = await request.json() as { email?: unknown; password?: unknown; displayName?: unknown; accountType?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    accountType = body.accountType === "agent" ? "agent" : "user";
    const result = await registerUser({
      email,
      password: typeof body.password === "string" ? body.password : "",
      displayName: typeof body.displayName === "string" ? body.displayName : "",
      accountType: accountType as "agent" | "user",
    });
    const response = NextResponse.json({ user: result.user, verificationSent: result.verificationSent }, { status: 201 });
    setSessionCookie(response, result.token);
    await recordAuditEventSafely({ request, eventType: "auth.register", user: result.user, metadata: { accountType, verificationSent: result.verificationSent } });
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    await recordAuditEventSafely({ request, eventType: "auth.register", outcome: status === 429 ? "blocked" : "failure", metadata: { accountType, emailHash: hashRateLimitPart(normalizeEmail(email)), status } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account creation is unavailable right now." }, { status });
  }
}

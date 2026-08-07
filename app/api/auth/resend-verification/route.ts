import { NextResponse } from "next/server";
import { AuthError, getCurrentUser, resendVerificationEmail } from "../../../lib/auth";
import { recordAuditEventSafely } from "../../../lib/audit";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in before requesting a verification email." }, { status: 401 });
    const result = await resendVerificationEmail(user.id);
    await recordAuditEventSafely({ request, eventType: "auth.verification_resend", user, metadata: { alreadyVerified: result.alreadyVerified, sent: result.sent } });
    return NextResponse.json(result);
  } catch (error) {
    await recordAuditEventSafely({ request, eventType: "auth.verification_resend", outcome: "failure" });
    const status = error instanceof AuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The verification email could not be sent." }, { status });
  }
}

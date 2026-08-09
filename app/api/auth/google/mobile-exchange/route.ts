import { NextResponse } from "next/server";
import { AuthError, consumeMobileAuthHandoff, setSessionCookie } from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { handoff?: unknown };
    const handoff = typeof body.handoff === "string" ? body.handoff : "";
    const sessionToken = await consumeMobileAuthHandoff(handoff);
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mobile sign-in could not be completed." }, { status });
  }
}

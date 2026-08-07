import { NextResponse } from "next/server";
import { clearSessionCookie, destroyCurrentSession, getCurrentUser } from "../../../lib/auth";
import { recordAuditEventSafely } from "../../../lib/audit";

export async function POST(request: Request) {
  let user = null;
  try {
    user = await getCurrentUser();
    await destroyCurrentSession();
    await recordAuditEventSafely({ request, eventType: "auth.logout", user, metadata: { method: "session" } });
  } catch {
    await recordAuditEventSafely({ request, eventType: "auth.logout", outcome: "failure", metadata: { method: "session" } });
  } finally {
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  }
}

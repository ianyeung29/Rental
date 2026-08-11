import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { recordAuditEventSafely } from "../../lib/audit";
import { ensureDatabaseSchema, sql } from "../../lib/db";

export async function POST(request: Request) {
  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }

  if (!currentUser) return NextResponse.json({ error: "Sign in before applying as an agent." }, { status: 401 });
  if (!currentUser.emailVerified) return NextResponse.json({ error: "Verify your email before applying as an agent." }, { status: 403 });
  if (currentUser.accountType === "agent") return NextResponse.json({ user: currentUser, changed: false });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });

  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      UPDATE rental_users
      SET account_type = 'agent', agent_verification_status = 'unsubmitted', updated_at = NOW()
      WHERE id = $1 AND account_type = 'user'
      RETURNING id, email, display_name, phone, role, account_type, agent_verification_status, email_verified_at
    `, [currentUser.id]);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: "This account cannot start an agent application right now." }, { status: 409 });

    const user = {
      ...currentUser,
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
      phone: String(row.phone || ""),
      role: String(row.role || "user"),
      accountType: "agent" as const,
      agentVerificationStatus: "unsubmitted" as const,
      agentVerified: false,
      emailVerified: Boolean(row.email_verified_at),
    };
    await recordAuditEventSafely({ request, eventType: "agent.application_start", user, metadata: { previousAccountType: "user" } });
    return NextResponse.json({ user, changed: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The agent application could not be started right now." }, { status: 502 });
  }
}

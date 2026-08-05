import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../../lib/db";

const REVIEW_STATUSES = new Set(["verified", "rejected", "expired", "pending"]);

async function adminContext() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to access agent verification." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before accessing agent verification." }, { status: 403 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "Agent verification access is restricted." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await adminContext();
  if (auth.error) return auth.error;
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const db = sql;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { status?: unknown; note?: unknown };
  const status = typeof body.status === "string" && REVIEW_STATUSES.has(body.status) ? body.status : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1_000) : "";
  if (!status) return NextResponse.json({ error: "Choose verified, rejected, expired, or pending." }, { status: 400 });

  try {
    await ensureDatabaseSchema();
    const profileRows = await db.query(`
      SELECT u.id AS user_id, u.account_type, p.id AS profile_id,
             p.license_state, p.license_number
      FROM rental_users u
      LEFT JOIN rental_agent_profiles p ON p.user_id = u.id
      WHERE u.id = $1 AND u.account_type = 'agent'
      LIMIT 1
    `, [id]);
    const profile = profileRows[0] as Record<string, unknown> | undefined;
    if (!profile) return NextResponse.json({ error: "Agent account not found." }, { status: 404 });
    if (status === "verified" && (!profile.profile_id || !profile.license_state || !profile.license_number)) {
      return NextResponse.json({ error: "A submitted license profile is required before approval." }, { status: 400 });
    }
    const verified = status === "verified";
    await db.transaction((tx) => [
      tx.query("UPDATE rental_users SET agent_verification_status = $1, updated_at = NOW() WHERE id = $2", [status, id]),
      tx.query(`
        UPDATE rental_agent_profiles
        SET is_verified = $1, is_active = $1,
            verification_reviewed_at = NOW(), verification_note = $2, updated_at = NOW()
        WHERE user_id = $3
      `, [verified, note, id]),
    ]);
    return NextResponse.json({ userId: id, status, agentVerified: verified });
  } catch {
    return NextResponse.json({ error: "The agent verification decision could not be saved." }, { status: 502 });
  }
}

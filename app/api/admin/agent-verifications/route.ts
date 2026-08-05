import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

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

export async function GET() {
  const context = await adminContext();
  if (context.error) return context.error;
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const db = sql;
  try {
    await ensureDatabaseSchema();
    const rows = await db.query(`
      SELECT u.id AS user_id, u.display_name, u.email, u.account_type,
             u.agent_verification_status, p.id AS profile_id, p.portrait_url, p.brokerage,
             p.license_state, p.license_number, p.verification_submitted_at,
             p.verification_reviewed_at, p.verification_note
      FROM rental_users u
      LEFT JOIN rental_agent_profiles p ON p.user_id = u.id
      WHERE u.account_type = 'agent'
        AND u.agent_verification_status IN ('pending', 'rejected', 'expired', 'unsubmitted')
      ORDER BY p.verification_submitted_at DESC NULLS LAST, u.created_at DESC
      LIMIT 200
    `);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "The agent verification queue could not be loaded right now." }, { status: 502 });
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { recordAuditEventSafely } from "../../lib/audit";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { isAgentPortraitKeyForUser, publicUrlForKey } from "../../lib/r2";

const LICENSE_STATE_PATTERN = /^[A-Za-z]{2}$/;
const LICENSE_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .-]{1,39}$/;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function applicationFromRow(row: Record<string, unknown> | undefined, status: string) {
  if (!row) return { status, application: null };
  return {
    status,
    application: {
      licenseState: String(row.license_state || ""),
      licenseNumber: String(row.license_number || ""),
      brokerage: String(row.brokerage || ""),
      portraitUrl: String(row.portrait_url || ""),
      submittedAt: row.verification_submitted_at instanceof Date ? row.verification_submitted_at.toISOString() : row.verification_submitted_at ? String(row.verification_submitted_at) : null,
      reviewedAt: row.verification_reviewed_at instanceof Date ? row.verification_reviewed_at.toISOString() : row.verification_reviewed_at ? String(row.verification_reviewed_at) : null,
      reviewNote: String(row.verification_note || ""),
    },
  };
}

async function currentAgent() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage agent verification." }, { status: 401 }) };
  if (user.accountType !== "agent") return { error: NextResponse.json({ error: "Choose an agent account to submit license verification." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

export async function GET() {
  const context = await currentAgent();
  if (context.error) return context.error;
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const db = sql;
  try {
    await ensureDatabaseSchema();
    const rows = await db.query(`
      SELECT license_state, license_number, brokerage, portrait_url, verification_submitted_at,
             verification_reviewed_at, verification_note
      FROM rental_agent_profiles
      WHERE user_id = $1
      LIMIT 1
    `, [context.user.id]);
    return NextResponse.json(applicationFromRow(rows[0] as Record<string, unknown> | undefined, context.user.agentVerificationStatus));
  } catch {
    return NextResponse.json({ error: "Agent verification details are unavailable right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const context = await currentAgent();
  if (context.error) return context.error;
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const db = sql;
  if (!context.user.emailVerified) return NextResponse.json({ error: "Verify your email before submitting agent verification." }, { status: 403 });
  if (context.user.agentVerified) return NextResponse.json({ error: "This agent account is already verified." }, { status: 409 });

  let body: { licenseState?: unknown; licenseNumber?: unknown; brokerage?: unknown; displayNameZh?: unknown; displayNameEn?: unknown; portraitKey?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Send the license state, license number, and brokerage." }, { status: 400 });
  }

  const licenseState = text(body.licenseState, 2).toUpperCase();
  const licenseNumber = text(body.licenseNumber, 40);
  const brokerage = text(body.brokerage, 120);
  const displayNameZh = text(body.displayNameZh, 80) || context.user.displayName;
  const displayNameEn = text(body.displayNameEn, 80) || context.user.displayName;
  const portraitKey = text(body.portraitKey, 240);
  if (!LICENSE_STATE_PATTERN.test(licenseState)) return NextResponse.json({ error: "Enter a valid two-letter license state." }, { status: 400 });
  if (!LICENSE_NUMBER_PATTERN.test(licenseNumber)) return NextResponse.json({ error: "Enter a valid license number." }, { status: 400 });
  if (brokerage.length < 2) return NextResponse.json({ error: "Enter the brokerage name associated with the license." }, { status: 400 });
  if (portraitKey && !isAgentPortraitKeyForUser(portraitKey, context.user.id)) return NextResponse.json({ error: "Upload the portrait through the agent profile form before submitting." }, { status: 400 });

  try {
    await ensureDatabaseSchema();
    const profileId = `agent-profile-${randomUUID()}`;
    const portraitUrl = portraitKey ? publicUrlForKey(portraitKey) : "";
    const result = await db.transaction((tx) => [
      tx.query(`
        INSERT INTO rental_agent_profiles (
          id, user_id, display_name_zh, display_name_en, brokerage, license_state,
          license_number, service_areas, languages, is_verified, is_sample, is_active,
          verification_submitted_at, verification_reviewed_at, verification_note,
          portrait_key, portrait_url, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, '["zh", "en"]'::jsonb, FALSE, FALSE, FALSE, NOW(), NULL, '', $8, $9, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          display_name_zh = EXCLUDED.display_name_zh,
          display_name_en = EXCLUDED.display_name_en,
          brokerage = EXCLUDED.brokerage,
          license_state = EXCLUDED.license_state,
          license_number = EXCLUDED.license_number,
          is_verified = FALSE,
          is_active = FALSE,
          verification_submitted_at = NOW(),
          verification_reviewed_at = NULL,
          verification_note = '',
          portrait_key = CASE WHEN $8 <> '' THEN $8 ELSE rental_agent_profiles.portrait_key END,
          portrait_url = CASE WHEN $9 <> '' THEN $9 ELSE rental_agent_profiles.portrait_url END,
          updated_at = NOW()
        RETURNING license_state, license_number, brokerage, portrait_url, verification_submitted_at,
                  verification_reviewed_at, verification_note
      `, [profileId, context.user.id, displayNameZh, displayNameEn, brokerage, licenseState, licenseNumber, portraitKey, portraitUrl]),
      tx.query("UPDATE rental_users SET agent_verification_status = 'pending', updated_at = NOW() WHERE id = $1", [context.user.id]),
    ]);
    const row = result[0]?.[0] as Record<string, unknown> | undefined;
    await recordAuditEventSafely({ request, eventType: "agent.verification_submit", user: context.user, metadata: { licenseState, brokerage, hasPortrait: Boolean(portraitKey) } });
    return NextResponse.json(applicationFromRow(row, "pending"), { status: 201 });
  } catch {
    return NextResponse.json({ error: "The agent verification request could not be submitted." }, { status: 502 });
  }
}

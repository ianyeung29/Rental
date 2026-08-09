import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

async function verifiedUser() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage device notifications." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before enabling device notifications." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query("SELECT COUNT(*)::int AS count FROM rental_native_push_tokens WHERE user_id = $1", [result.user.id]);
    return NextResponse.json({ enabled: Number((rows[0] as Record<string, unknown> | undefined)?.count || 0) > 0 });
  } catch {
    return NextResponse.json({ error: "Device notification status is unavailable right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const token = text(body.token, 4096);
    const platform = text(body.platform, 16);
    const userAgent = text(body.userAgent, 500);
    if (!token || (platform !== "android" && platform !== "ios")) return NextResponse.json({ error: "Send a valid Android or iOS push token." }, { status: 400 });
    await ensureDatabaseSchema();
    const rows = await sql!.query(`
      INSERT INTO rental_native_push_tokens (id, user_id, platform, token, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (platform, token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW()
      RETURNING id
    `, [`native-push-${randomUUID()}`, result.user.id, platform, token, userAgent]);
    await sql!.query(`
      INSERT INTO rental_notification_preferences (user_id, push_enabled)
      VALUES ($1, TRUE)
      ON CONFLICT (user_id) DO UPDATE SET push_enabled = TRUE, updated_at = NOW()
    `, [result.user.id]);
    return NextResponse.json({ ok: true, id: String(rows[0]?.id || "") });
  } catch {
    return NextResponse.json({ error: "Device notifications could not be enabled right now." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const token = text(body.token, 4096);
    await ensureDatabaseSchema();
    if (token) await sql!.query("DELETE FROM rental_native_push_tokens WHERE user_id = $1 AND token = $2", [result.user.id, token]);
    else await sql!.query("DELETE FROM rental_native_push_tokens WHERE user_id = $1", [result.user.id]);
    const remaining = await sql!.query("SELECT 1 FROM rental_native_push_tokens WHERE user_id = $1 LIMIT 1", [result.user.id]);
    if (remaining.length === 0) await sql!.query("UPDATE rental_notification_preferences SET push_enabled = FALSE, updated_at = NOW() WHERE user_id = $1", [result.user.id]);
    return NextResponse.json({ ok: true, enabled: remaining.length > 0 });
  } catch {
    return NextResponse.json({ error: "Device notifications could not be disabled right now." }, { status: 502 });
  }
}

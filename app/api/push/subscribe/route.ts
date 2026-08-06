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
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage browser notifications." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before enabling browser notifications." }, { status: 403 }) };
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
    const rows = await sql!.query("SELECT COUNT(*)::int AS count FROM rental_push_subscriptions WHERE user_id = $1", [result.user.id]);
    return NextResponse.json({ enabled: Number((rows[0] as Record<string, unknown> | undefined)?.count || 0) > 0 });
  } catch {
    return NextResponse.json({ error: "Browser notification status is unavailable right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    const source = body.subscription && typeof body.subscription === "object" ? body.subscription as Record<string, unknown> : body;
    const keys = source.keys && typeof source.keys === "object" ? source.keys as Record<string, unknown> : {};
    const endpoint = text(source.endpoint, 2_048);
    const p256dh = text(keys.p256dh, 512);
    const auth = text(keys.auth, 512);
    const userAgent = text(body.userAgent, 500);
    if (!endpoint.startsWith("https://") || !p256dh || !auth) return NextResponse.json({ error: "Send a valid browser push subscription." }, { status: 400 });
    await ensureDatabaseSchema();
    const rows = await sql!.query(`
      INSERT INTO rental_push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW()
      RETURNING id
    `, [`push-${randomUUID()}`, result.user.id, endpoint, p256dh, auth, userAgent]);
    await sql!.query(`
      INSERT INTO rental_notification_preferences (user_id, push_enabled)
      VALUES ($1, TRUE)
      ON CONFLICT (user_id) DO UPDATE SET push_enabled = TRUE, updated_at = NOW()
    `, [result.user.id]);
    return NextResponse.json({ ok: true, id: String(rows[0]?.id || "") });
  } catch {
    return NextResponse.json({ error: "Browser notifications could not be enabled right now." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const endpoint = text(body.endpoint, 2_048);
    await ensureDatabaseSchema();
    if (endpoint) await sql!.query("DELETE FROM rental_push_subscriptions WHERE user_id = $1 AND endpoint = $2", [result.user.id, endpoint]);
    else await sql!.query("DELETE FROM rental_push_subscriptions WHERE user_id = $1", [result.user.id]);
    const remaining = await sql!.query("SELECT 1 FROM rental_push_subscriptions WHERE user_id = $1 LIMIT 1", [result.user.id]);
    if (remaining.length === 0) await sql!.query("UPDATE rental_notification_preferences SET push_enabled = FALSE, updated_at = NOW() WHERE user_id = $1", [result.user.id]);
    return NextResponse.json({ ok: true, enabled: remaining.length > 0 });
  } catch {
    return NextResponse.json({ error: "Browser notifications could not be disabled right now." }, { status: 502 });
  }
}

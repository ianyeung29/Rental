import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

async function verifiedUser() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to view notifications." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before viewing notifications." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function notificationFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    type: String(row.type || "general"),
    titleZh: String(row.title_zh || "安居通知"),
    titleEn: String(row.title_en || "Anjurentals notification"),
    bodyZh: String(row.body_zh || ""),
    bodyEn: String(row.body_en || ""),
    link: String(row.link || ""),
    readAt: row.read_at instanceof Date ? row.read_at.toISOString() : row.read_at ? String(row.read_at) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
  };
}

export async function GET(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    await ensureDatabaseSchema();
    const unreadOnly = new URL(request.url).searchParams.get("unreadOnly") === "true";
    const rows = await sql!.query(`
      SELECT id, type, title_zh, title_en, body_zh, body_en, link, read_at, created_at
      FROM rental_notifications
      WHERE user_id = $1 ${unreadOnly ? "AND read_at IS NULL" : ""}
      ORDER BY created_at DESC
      LIMIT 50
    `, [result.user.id]);
    const unreadRows = await sql!.query("SELECT COUNT(*)::int AS count FROM rental_notifications WHERE user_id = $1 AND read_at IS NULL", [result.user.id]);
    return NextResponse.json({ notifications: rows.map((row) => notificationFromRow(row as Record<string, unknown>)), unreadCount: Number((unreadRows[0] as Record<string, unknown> | undefined)?.count || 0) });
  } catch {
    return NextResponse.json({ error: "Notifications could not be loaded right now." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  const body = await request.json().catch(() => ({})) as { id?: unknown; all?: unknown };
  try {
    await ensureDatabaseSchema();
    if (body.all === true) {
      await sql!.query("UPDATE rental_notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = $1", [result.user.id]);
    } else if (typeof body.id === "string" && body.id.trim()) {
      await sql!.query("UPDATE rental_notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2", [body.id.trim().slice(0, 120), result.user.id]);
    } else {
      return NextResponse.json({ error: "Choose a notification to mark as read." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Notification state could not be updated." }, { status: 502 });
  }
}

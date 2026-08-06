import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function requireUser() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    throw new Error("AUTH_UNAVAILABLE");
  }
  if (!user) throw new Error("AUTH_REQUIRED");
  if (!user.emailVerified) throw new Error("EMAIL_REQUIRED");
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");
  await ensureDatabaseSchema();
  return user;
}

function authError(error: unknown) {
  if (error instanceof Error && error.message === "AUTH_UNAVAILABLE") return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  if (error instanceof Error && error.message === "AUTH_REQUIRED") return NextResponse.json({ error: "Sign in before managing blocked publishers." }, { status: 401 });
  if (error instanceof Error && error.message === "EMAIL_REQUIRED") return NextResponse.json({ error: "Verify your email before managing blocked publishers." }, { status: 403 });
  if (error instanceof Error && error.message === "DATABASE_UNAVAILABLE") return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await sql!.query(`
      SELECT b.blocked_user_id, b.created_at, u.display_name, u.account_type
      FROM rental_user_blocks b
      JOIN rental_users u ON u.id = b.blocked_user_id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC
    `, [user.id]);
    return NextResponse.json(rows.map((row) => {
      const record = row as Record<string, unknown>;
      return {
        id: String(record.blocked_user_id || ""),
        displayName: String(record.display_name || "Publisher"),
        accountType: String(record.account_type || "user"),
        blockedAt: record.created_at instanceof Date ? record.created_at.toISOString() : String(record.created_at || ""),
      };
    }));
  } catch (error) {
    return authError(error) || NextResponse.json({ error: "Blocked publishers could not be loaded right now." }, { status: 502 });
  }
}

async function ownerIdForListing(listingId: string, userId: string) {
  const rows = await sql!.query("SELECT owner_id, is_sample FROM rental_listings WHERE id = $1 LIMIT 1", [listingId]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row || row.is_sample === true || !row.owner_id) return null;
  if (String(row.owner_id) === userId) return "self";
  return String(row.owner_id);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const rawBody = await request.text();
    if (rawBody.length > 1_500) return NextResponse.json({ error: "Block request is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as { listingId?: unknown; blockedUserId?: unknown };
    let blockedUserId = text(body.blockedUserId, 120);
    if (body.listingId) blockedUserId = await ownerIdForListing(text(body.listingId, 120), user.id) || "";
    if (!blockedUserId) return NextResponse.json({ error: "Choose a publisher to block." }, { status: 400 });
    if (blockedUserId === "self") return NextResponse.json({ error: "You cannot block your own account." }, { status: 400 });
    const target = await sql!.query("SELECT id FROM rental_users WHERE id = $1 LIMIT 1", [blockedUserId]);
    if (!target[0]) return NextResponse.json({ error: "That publisher is no longer available." }, { status: 404 });
    await sql!.query(`
      INSERT INTO rental_user_blocks (blocker_id, blocked_user_id)
      VALUES ($1, $2)
      ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING
    `, [user.id, blockedUserId]);
    return NextResponse.json({ ok: true, blockedUserId, id: `block-${randomUUID()}` }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Block request is not valid JSON." }, { status: 400 });
    return authError(error) || NextResponse.json({ error: "The publisher could not be blocked right now." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const rawBody = await request.text();
    if (rawBody.length > 1_500) return NextResponse.json({ error: "Unblock request is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as { listingId?: unknown; blockedUserId?: unknown };
    let blockedUserId = text(body.blockedUserId, 120);
    if (!blockedUserId && body.listingId) blockedUserId = await ownerIdForListing(text(body.listingId, 120), user.id) || "";
    if (!blockedUserId || blockedUserId === "self") return NextResponse.json({ error: "Choose a publisher to unblock." }, { status: 400 });
    await sql!.query("DELETE FROM rental_user_blocks WHERE blocker_id = $1 AND blocked_user_id = $2", [user.id, blockedUserId]);
    return NextResponse.json({ ok: true, blockedUserId });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Unblock request is not valid JSON." }, { status: 400 });
    return authError(error) || NextResponse.json({ error: "The publisher could not be unblocked right now." }, { status: 502 });
  }
}

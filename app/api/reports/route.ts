import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

const REASONS = new Set(["misleading", "scam", "discriminatory", "privacy", "other"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before reporting a listing." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before reporting a listing." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });

  try {
    const rawBody = await request.text();
    if (rawBody.length > 3_000) return NextResponse.json({ error: "Report is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as { listingId?: unknown; reason?: unknown; details?: unknown };
    const listingId = text(body.listingId, 120);
    const reason = text(body.reason, 40);
    const details = text(body.details, 1_000);
    if (!listingId || !REASONS.has(reason)) return NextResponse.json({ error: "Choose a report reason first." }, { status: 400 });

    await ensureDatabaseSchema();
    const listings = await sql.query(`
      SELECT id, owner_id, moderation_status
      FROM rental_listings
      WHERE id = $1
        AND status = 'published'
        AND moderation_status <> 'rejected'
        AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
      LIMIT 1
    `, [listingId]);
    const listing = listings[0] as Record<string, unknown> | undefined;
    if (!listing) return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
    if (String(listing.owner_id || "") === user.id) return NextResponse.json({ error: "You cannot report your own listing." }, { status: 400 });

    const id = `report-${randomUUID()}`;
    const currentModerationStatus = String(listing.moderation_status || "approved");
    const nextModerationStatus = currentModerationStatus === "approved" ? "under_review" : currentModerationStatus;
    const admins = await sql.query("SELECT id FROM rental_users WHERE role = 'admin'");
    await sql.transaction((tx) => [
      tx.query(
        "INSERT INTO rental_listing_reports (id, listing_id, reporter_id, reason, details) VALUES ($1, $2, $3, $4, $5)",
        [id, listingId, user.id, reason, details],
      ),
      tx.query(
        "UPDATE rental_listings SET moderation_status = $1, moderation_updated_at = NOW(), updated_at = NOW() WHERE id = $2 AND moderation_status = 'approved'",
        [nextModerationStatus, listingId],
      ),
      tx.query(
        "INSERT INTO rental_moderation_events (id, listing_id, report_id, actor_id, action, from_status, to_status, note) VALUES ($1, $2, $3, $4, 'report_received', $5, $6, $7)",
        [`moderation-${randomUUID()}`, listingId, id, user.id, currentModerationStatus, nextModerationStatus, details],
      ),
      ...admins.map((admin) => {
        const adminId = String((admin as Record<string, unknown>).id || "");
        return tx.query(`
          INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
          VALUES ($1, $2, 'moderation', '收到新的安全举报', 'New safety report', $3, $4, '/admin/reports')
        `, [
          `notification-${randomUUID()}`,
          adminId,
          `房源需要审核。举报类型：${reason}`,
          `A listing needs review. Report reason: ${reason}`,
        ]);
      }),
    ]);
    return NextResponse.json({ id, status: "open", moderationStatus: nextModerationStatus }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return NextResponse.json({ error: "You have already reported this listing." }, { status: 409 });
    return NextResponse.json({ error: "The report could not be submitted right now." }, { status: 502 });
  }
}

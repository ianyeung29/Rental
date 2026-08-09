import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { recordAuditEventSafely } from "../../lib/audit";
import { ensureDatabaseSchema, sql } from "../../lib/db";

const EVENT_TYPES = new Set(["view", "save", "contact", "share", "compare"]);

export async function POST(request: Request) {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { listingId?: unknown; eventType?: unknown; sessionKey?: unknown; metadata?: unknown };
  const listingId = typeof body.listingId === "string" ? body.listingId.trim().slice(0, 120) : "";
  const eventType = typeof body.eventType === "string" && EVENT_TYPES.has(body.eventType) ? body.eventType : "";
  const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.trim().slice(0, 160) : "";
  if (!listingId || !eventType) return NextResponse.json({ error: "A listing and event type are required." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const listingRows = await sql.query("SELECT id, owner_id FROM rental_listings WHERE id = $1 AND status = 'published' AND moderation_status = 'approved' AND (expires_on IS NULL OR expires_on >= CURRENT_DATE) LIMIT 1", [listingId]);
    if (listingRows.length === 0) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (eventType === "view" && sessionKey) {
      const duplicateRows = await sql.query("SELECT 1 FROM rental_listing_events WHERE listing_id = $1 AND event_type = 'view' AND session_key = $2 AND created_at > NOW() - INTERVAL '1 day' LIMIT 1", [listingId, sessionKey]);
      if (duplicateRows.length > 0) return NextResponse.json({ ok: true, deduped: true });
    }
    let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
    try {
      user = await getCurrentUser();
    } catch {
      user = null;
    }
    if (eventType === "view" && user?.id && String((listingRows[0] as Record<string, unknown>).owner_id || "") === user.id) {
      return NextResponse.json({ ok: true, excluded: "owner" });
    }
    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
    const metadataJson = JSON.stringify(metadata).slice(0, 2_000);
    await sql.query(`
      INSERT INTO rental_listing_events (id, listing_id, user_id, event_type, session_key, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `, [`event-${randomUUID()}`, listingId, user?.id || null, eventType, sessionKey, metadataJson]);
    await recordAuditEventSafely({ request, eventType: `listing.${eventType}`, user, metadata: { listingId, sessionKeyPresent: Boolean(sessionKey) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Listing activity could not be recorded." }, { status: 502 });
  }
}

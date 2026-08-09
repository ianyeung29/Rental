import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { DEFAULT_REPLY_TEMPLATES, listingNeedsAvailabilityConfirmation } from "../../lib/owner-operations";
import { sendPushToUser } from "../../lib/push";

const AVAILABILITY_STALE_DAYS = 14;

async function verifiedUser() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage owner operations." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before managing owner operations." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function dateTime(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : null;
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" && value ? value.slice(0, 10) : null;
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function operationListing(row: Record<string, unknown>) {
  const availabilityAnchor = dateTime(row.availability_anchor);
  const today = new Date().toISOString().slice(0, 10);
  const expiresOn = dateOnly(row.expires_on);
  const needsConfirmation = listingNeedsAvailabilityConfirmation({
    status: String(row.status || ""),
    availabilityAnchor,
    staleDays: AVAILABILITY_STALE_DAYS,
  }) && (!expiresOn || expiresOn >= today);
  return {
    id: String(row.id),
    titleZh: String(row.title_zh || "房源"),
    titleEn: String(row.title_en || "Listing"),
    status: String(row.status || "published"),
    expiresOn,
    availabilityConfirmedAt: dateTime(row.availability_confirmed_at),
    availabilityAnchor,
    availabilityReminderSentAt: dateTime(row.availability_reminder_sent_at),
    needsConfirmation,
    views30d: number(row.views_30d),
    shares30d: number(row.shares_30d),
    inquiries30d: number(row.inquiries_30d),
    ownerAlertsActive: Boolean(row.owner_alerts_active),
  };
}

function replyTemplateFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    titleZh: String(row.title_zh || ""),
    titleEn: String(row.title_en || ""),
    bodyZh: String(row.body_zh || ""),
    bodyEn: String(row.body_en || ""),
    isDefault: false,
  };
}

async function loadOperationRows(userId: string) {
  return sql!.query(`
    SELECT l.id, l.title_zh, l.title_en, l.status, l.expires_on,
           l.availability_confirmed_at, l.availability_reminder_sent_at,
           COALESCE(l.availability_confirmed_at, l.published_at, l.updated_at, l.created_at) AS availability_anchor,
           (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'view' AND e.created_at >= NOW() - INTERVAL '30 days' AND (e.user_id IS NULL OR e.user_id <> l.owner_id))::int AS views_30d,
           (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'share' AND e.created_at >= NOW() - INTERVAL '30 days')::int AS shares_30d,
           (SELECT COUNT(*) FROM rental_inquiries i WHERE i.listing_id = l.id AND i.created_at >= NOW() - INTERVAL '30 days')::int AS inquiries_30d,
           EXISTS (
             SELECT 1 FROM rental_listing_notification_addons addon
             WHERE addon.listing_id = l.id AND addon.owner_id = l.owner_id
               AND addon.status = 'active' AND addon.payment_status = 'paid'
               AND (addon.expires_at IS NULL OR addon.expires_at >= CURRENT_DATE)
           ) AS owner_alerts_active
    FROM rental_listings l
    WHERE l.owner_id = $1
    ORDER BY CASE WHEN l.status = 'published' THEN 0 ELSE 1 END, l.updated_at DESC
  `, [userId]);
}

export async function GET() {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    await ensureDatabaseSchema();
    const rows = await loadOperationRows(result.user.id);
    for (const row of rows as Record<string, unknown>[]) {
      const listing = operationListing(row);
      if (!listing.needsConfirmation || !listing.ownerAlertsActive) continue;
      const updatedRows = await sql!.query(`
        UPDATE rental_listings
        SET availability_reminder_sent_at = NOW()
        WHERE id = $1 AND owner_id = $2
          AND (availability_reminder_sent_at IS NULL OR availability_reminder_sent_at < COALESCE(availability_confirmed_at, published_at, updated_at, created_at))
        RETURNING id
      `, [listing.id, result.user.id]);
      if (updatedRows.length === 0) continue;
      const titleZh = listing.titleZh;
      const titleEn = listing.titleEn;
      await sql!.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'listingAvailability', '请确认房源是否仍可租', 'Confirm listing availability', $3, $4, '/#account')
      `, [
        `notification-${randomUUID()}`,
        result.user.id,
        `「${titleZh}」已经 ${AVAILABILITY_STALE_DAYS} 天没有确认，请确认仍可出租，或暂时暂停房源。`,
        `“${titleEn}” has not been confirmed in ${AVAILABILITY_STALE_DAYS} days. Confirm it is still available or pause the listing.`,
      ]);
      await sendPushToUser(result.user.id, {
        title: "安居 / Anjurentals",
        body: `请确认「${titleZh}」是否仍可租。 / Confirm “${titleEn}” is still available.`,
        url: "/#account",
        tag: `listing-availability-${listing.id}`,
      }).catch(() => undefined);
      row.availability_reminder_sent_at = new Date().toISOString();
    }
    const listings = (rows as Record<string, unknown>[]).map(operationListing);
    const customRows = await sql!.query(`
      SELECT id, title_zh, title_en, body_zh, body_en
      FROM rental_reply_templates
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 30
    `, [result.user.id]);
    const replyTemplates = [
      ...DEFAULT_REPLY_TEMPLATES,
      ...(customRows as Record<string, unknown>[]).map(replyTemplateFromRow),
    ];
    return NextResponse.json({
      staleDays: AVAILABILITY_STALE_DAYS,
      summary: {
        activeListings: listings.filter((listing) => listing.status === "published").length,
        needsConfirmation: listings.filter((listing) => listing.needsConfirmation).length,
        views30d: listings.reduce((total, listing) => total + listing.views30d, 0),
        shares30d: listings.reduce((total, listing) => total + listing.shares30d, 0),
        inquiries30d: listings.reduce((total, listing) => total + listing.inquiries30d, 0),
      },
      listings,
      replyTemplates,
    });
  } catch {
    return NextResponse.json({ error: "Owner operations could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  const body = await request.json().catch(() => ({})) as { action?: unknown; listingId?: unknown };
  const action = body.action === "confirmAvailability" || body.action === "pauseStale" ? body.action : "";
  const listingId = typeof body.listingId === "string" ? body.listingId.trim().slice(0, 120) : "";
  if (!action || !listingId) return NextResponse.json({ error: "Choose a listing operation first." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    if (action === "confirmAvailability") {
      const rows = await sql!.query(`
        UPDATE rental_listings
        SET availability_confirmed_at = NOW(), availability_reminder_sent_at = NULL, updated_at = NOW()
        WHERE id = $1 AND owner_id = $2 AND status IN ('published', 'paused')
        RETURNING id, status, availability_confirmed_at
      `, [listingId, result.user.id]);
      if (rows.length === 0) return NextResponse.json({ error: "Listing not found or cannot be confirmed." }, { status: 404 });
      const row = rows[0] as Record<string, unknown>;
      return NextResponse.json({ id: listingId, action, status: String(row.status || "published"), availabilityConfirmedAt: dateTime(row.availability_confirmed_at) });
    }

    const rows = await sql!.query(`
      UPDATE rental_listings
      SET status = 'paused', paused_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND owner_id = $2 AND status = 'published'
      RETURNING id, status
    `, [listingId, result.user.id]);
    if (rows.length === 0) return NextResponse.json({ error: "Only a published listing can be paused." }, { status: 404 });
    await sql!.query("UPDATE rental_agent_requests SET status = 'cancelled', updated_at = NOW() WHERE listing_id = $1 AND status = 'pending'", [listingId]);
    return NextResponse.json({ id: listingId, action, status: "paused" });
  } catch {
    return NextResponse.json({ error: "The owner operation could not be completed." }, { status: 502 });
  }
}

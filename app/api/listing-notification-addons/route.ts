import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { addonFromRow, listingNotificationAddonPriceCents } from "../../lib/listing-notification-addon";

async function verifiedOwner() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage listing alert add-ons." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before managing listing alert add-ons." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function addonResponse(row: Record<string, unknown>, priceCents: number) {
  return {
    ...addonFromRow(row),
    listingTitleZh: String(row.title_zh || "房源"),
    listingTitleEn: String(row.title_en || "Listing"),
    listingStatus: String(row.listing_status || ""),
    configuredPriceCents: priceCents,
    checkoutConfigured: false,
  };
}

export async function GET() {
  const context = await verifiedOwner();
  if (context.error) return context.error;
  try {
    await ensureDatabaseSchema();
    const priceCents = listingNotificationAddonPriceCents();
    const rows = await sql!.query(`
      SELECT a.listing_id, a.owner_id, a.status, a.payment_status, a.price_cents, a.payment_reference,
             a.paid_at, a.activated_at, a.expires_at, a.created_at, a.updated_at,
             l.title_zh, l.title_en, l.status AS listing_status
      FROM rental_listing_notification_addons a
      JOIN rental_listings l ON l.id = a.listing_id
      WHERE a.owner_id = $1
      ORDER BY a.updated_at DESC
    `, [context.user.id]);
    return NextResponse.json({
      addons: rows.map((row) => addonResponse(row as Record<string, unknown>, priceCents)),
      configuredPriceCents: priceCents,
      checkoutConfigured: false,
    });
  } catch {
    return NextResponse.json({ error: "Listing alert add-ons could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const context = await verifiedOwner();
  if (context.error) return context.error;
  const body = await request.json().catch(() => ({})) as { listingId?: unknown };
  const listingId = typeof body.listingId === "string" ? body.listingId.trim().slice(0, 120) : "";
  if (!listingId) return NextResponse.json({ error: "Choose a listing first." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const listingRows = await sql!.query(`
      SELECT id, title_zh, title_en, status
      FROM rental_listings
      WHERE id = $1 AND owner_id = $2 AND status IN ('published', 'paused')
      LIMIT 1
    `, [listingId, context.user.id]);
    const listing = listingRows[0] as Record<string, unknown> | undefined;
    if (!listing) return NextResponse.json({ error: "Only your published or paused listings can use owner alerts." }, { status: 404 });

    const existingRows = await sql!.query(`
      SELECT a.listing_id, a.owner_id, a.status, a.payment_status, a.price_cents, a.payment_reference,
             a.paid_at, a.activated_at, a.expires_at, a.created_at, a.updated_at,
             l.title_zh, l.title_en, l.status AS listing_status
      FROM rental_listing_notification_addons a
      JOIN rental_listings l ON l.id = a.listing_id
      WHERE a.listing_id = $1 AND a.owner_id = $2
      LIMIT 1
    `, [listingId, context.user.id]);
    if (existingRows[0]) {
      const existing = existingRows[0] as Record<string, unknown>;
      if (existing.status === "cancelled" || existing.status === "expired") {
        const priceCents = listingNotificationAddonPriceCents();
        const reopenedRows = await sql!.query(`
          UPDATE rental_listing_notification_addons
          SET status = 'pending_payment', payment_status = 'unpaid', price_cents = $1,
              payment_reference = '', paid_at = NULL, activated_at = NULL, updated_at = NOW()
          WHERE listing_id = $2 AND owner_id = $3
          RETURNING listing_id, owner_id, status, payment_status, price_cents, payment_reference, paid_at, activated_at, expires_at, created_at, updated_at
        `, [priceCents, listingId, context.user.id]);
        return NextResponse.json({
          addon: addonResponse({ ...(reopenedRows[0] as Record<string, unknown>), ...listing, listing_status: listing.status }, priceCents),
          paymentRequired: true,
          checkoutConfigured: false,
          idempotent: false,
          reopened: true,
          requestId: `listing-alert-${randomUUID()}`,
        }, { status: 201 });
      }
      return NextResponse.json({ addon: addonResponse(existing, listingNotificationAddonPriceCents()), alreadyRequested: true });
    }

    const priceCents = listingNotificationAddonPriceCents();
    const rows = await sql!.query(`
      INSERT INTO rental_listing_notification_addons (listing_id, owner_id, status, payment_status, price_cents)
      VALUES ($1, $2, 'pending_payment', 'unpaid', $3)
      RETURNING listing_id, owner_id, status, payment_status, price_cents, payment_reference, paid_at, activated_at, expires_at, created_at, updated_at
    `, [listingId, context.user.id, priceCents]);
    const addon = rows[0] as Record<string, unknown> | undefined;
    return NextResponse.json({
      addon: addonResponse({ ...addon, ...listing, listing_status: listing.status }, priceCents),
      paymentRequired: true,
      checkoutConfigured: false,
      idempotent: false,
      requestId: `listing-alert-${randomUUID()}`,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Listing alert add-on could not be requested right now." }, { status: 502 });
  }
}

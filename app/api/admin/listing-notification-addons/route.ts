import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../../lib/auth";
import { recordAuditEventSafely } from "../../../lib/audit";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { addonFromRow, listingNotificationAddonPriceCents } from "../../../lib/listing-notification-addon";

async function adminContext() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to access notification add-ons." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before accessing notification add-ons." }, { status: 403 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "Notification add-on access is restricted." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function responseFromRow(row: Record<string, unknown>) {
  return {
    ...addonFromRow(row),
    listingTitleZh: String(row.title_zh || "房源"),
    listingTitleEn: String(row.title_en || "Listing"),
    listingAreaZh: String(row.area_zh || ""),
    listingAreaEn: String(row.area_en || ""),
    ownerName: String(row.owner_name || ""),
    ownerEmail: String(row.owner_email || ""),
    listingStatus: String(row.listing_status || ""),
  };
}

const rowsQuery = `
  SELECT a.listing_id, a.owner_id, a.status, a.payment_status, a.price_cents, a.payment_reference,
         a.paid_at, a.activated_at, a.expires_at, a.created_at, a.updated_at,
         l.title_zh, l.title_en, l.area_zh, l.area_en, l.status AS listing_status,
         u.display_name AS owner_name, u.email AS owner_email
  FROM rental_listing_notification_addons a
  JOIN rental_listings l ON l.id = a.listing_id
  JOIN rental_users u ON u.id = a.owner_id
`;

export async function GET() {
  const context = await adminContext();
  if (context.error) return context.error;
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query(`${rowsQuery} ORDER BY CASE WHEN a.status = 'pending_payment' THEN 0 ELSE 1 END, a.updated_at DESC LIMIT 500`);
    return NextResponse.json({ addons: rows.map((row) => responseFromRow(row as Record<string, unknown>)), configuredPriceCents: listingNotificationAddonPriceCents(), checkoutConfigured: false });
  } catch {
    return NextResponse.json({ error: "Notification add-ons could not be loaded right now." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const context = await adminContext();
  if (context.error) return context.error;
  const body = await request.json().catch(() => ({})) as { listingId?: unknown; action?: unknown; paymentReference?: unknown };
  const listingId = typeof body.listingId === "string" ? body.listingId.trim().slice(0, 120) : "";
  const action = body.action === "confirm_paid" || body.action === "cancel" || body.action === "refund" ? body.action : "";
  const paymentReference = typeof body.paymentReference === "string" ? body.paymentReference.trim().slice(0, 160) : "";
  if (!listingId || !action) return NextResponse.json({ error: "Choose a listing and a valid payment action." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const rows = action === "confirm_paid"
      ? await sql!.query(`
          UPDATE rental_listing_notification_addons
          SET status = 'active', payment_status = 'paid', payment_reference = $1,
              paid_at = COALESCE(paid_at, NOW()), activated_at = COALESCE(activated_at, NOW()), updated_at = NOW()
          WHERE listing_id = $2
          RETURNING listing_id, owner_id, status, payment_status, price_cents, payment_reference, paid_at, activated_at, expires_at, created_at, updated_at
        `, [paymentReference, listingId])
      : await sql!.query(`
          UPDATE rental_listing_notification_addons
          SET status = $1, payment_status = $2, updated_at = NOW()
          WHERE listing_id = $3
          RETURNING listing_id, owner_id, status, payment_status, price_cents, payment_reference, paid_at, activated_at, expires_at, created_at, updated_at
        `, [action === "refund" ? "expired" : "cancelled", action === "refund" ? "refunded" : "unpaid", listingId]);
    const addon = rows[0] as Record<string, unknown> | undefined;
    if (!addon) return NextResponse.json({ error: "Notification add-on not found." }, { status: 404 });
    const ownerId = String(addon.owner_id || "");
    const active = action === "confirm_paid";
    await sql!.query(`
      INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
      VALUES ($1, $2, 'listingNotificationAddon', $3, $4, $5, $6, '/#account')
    `, [
      `notification-${randomUUID()}`,
      ownerId,
      active ? "房源提醒已开通" : action === "refund" ? "房源提醒已停止" : "房源提醒申请已取消",
      active ? "Listing alerts are active" : action === "refund" ? "Listing alerts were stopped" : "Listing alert request cancelled",
      active ? "付款已确认，你的房源现在可以接收咨询、申请和到期提醒。" : action === "refund" ? "这项房源提醒已停止；如需重新开通，请再次申请。" : "这项房源提醒申请没有被开通。",
      active ? "Payment was confirmed. This listing can now receive inquiry, application, and expiration alerts." : action === "refund" ? "These listing alerts were stopped. Request them again if needed." : "This listing alert request was not activated.",
    ]);
    await recordAuditEventSafely({ request, eventType: "listing_notification_addon.update", user: context.user, metadata: { listingId, action, paymentReference } });
    const joinedRows = await sql!.query(`${rowsQuery} WHERE a.listing_id = $1 LIMIT 1`, [listingId]);
    return NextResponse.json({ addon: joinedRows[0] ? responseFromRow(joinedRows[0] as Record<string, unknown>) : addon });
  } catch {
    return NextResponse.json({ error: "Notification add-on status could not be updated right now." }, { status: 502 });
  }
}

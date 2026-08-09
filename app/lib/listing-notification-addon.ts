import { sql } from "./db";

export type ListingNotificationAddonStatus = "pending_payment" | "active" | "expired" | "cancelled";

export type ListingNotificationAddon = {
  listingId: string;
  ownerId: string;
  status: ListingNotificationAddonStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
  priceCents: number;
  paymentReference: string;
  paidAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function listingNotificationAddonPriceCents() {
  const configured = Number(process.env.LISTING_NOTIFICATION_ADDON_PRICE_CENTS || 0);
  return Number.isFinite(configured) && configured > 0 ? Math.round(configured) : 0;
}

function timestamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : null;
}

export function addonFromRow(row?: Record<string, unknown>): ListingNotificationAddon | null {
  if (!row) return null;
  const status = String(row.status || "pending_payment");
  const paymentStatus = String(row.payment_status || "unpaid");
  return {
    listingId: String(row.listing_id || ""),
    ownerId: String(row.owner_id || ""),
    status: status === "active" || status === "expired" || status === "cancelled" ? status : "pending_payment",
    paymentStatus: paymentStatus === "paid" || paymentStatus === "refunded" ? paymentStatus : "unpaid",
    priceCents: Math.max(0, Number(row.price_cents || 0)),
    paymentReference: String(row.payment_reference || ""),
    paidAt: timestamp(row.paid_at),
    activatedAt: timestamp(row.activated_at),
    expiresAt: timestamp(row.expires_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

export async function hasActiveSavedSearchExposure(listingId: string, ownerId: string) {
  if (!sql || !listingId || !ownerId) return false;
  try {
    const rows = await sql.query(`
      SELECT 1
      FROM rental_listing_notification_addons
      WHERE listing_id = $1
        AND owner_id = $2
        AND status = 'active'
        AND payment_status = 'paid'
        AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
      LIMIT 1
    `, [listingId, ownerId]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

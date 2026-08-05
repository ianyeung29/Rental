import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

async function verifiedUser() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in before requesting promotion." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before requesting promotion." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

export async function GET() {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query(`
      SELECT p.id, p.listing_id, p.package, p.status, p.price_cents, p.note, p.created_at, p.updated_at, l.title_zh, l.title_en
      FROM rental_listing_promotions p
      JOIN rental_listings l ON l.id = p.listing_id
      WHERE p.requester_id = $1
      ORDER BY p.created_at DESC
    `, [result.user.id]);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Promotion requests could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  const body = await request.json().catch(() => ({})) as { listingId?: unknown; package?: unknown; note?: unknown };
  const listingId = typeof body.listingId === "string" ? body.listingId.trim().slice(0, 120) : "";
  const packageName = body.package === "spotlight" ? "spotlight" : "featured";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!listingId) return NextResponse.json({ error: "Choose a listing first." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const listingRows = await sql!.query("SELECT id, title_zh, title_en FROM rental_listings WHERE id = $1 AND owner_id = $2 AND status IN ('published', 'paused') LIMIT 1", [listingId, result.user.id]);
    const listing = listingRows[0] as Record<string, unknown> | undefined;
    if (!listing) return NextResponse.json({ error: "Only your published or paused listings can be promoted." }, { status: 404 });
    const existing = await sql!.query("SELECT id, status FROM rental_listing_promotions WHERE listing_id = $1 AND status IN ('requested', 'active') LIMIT 1", [listingId]);
    if (existing[0]) return NextResponse.json({ id: String((existing[0] as Record<string, unknown>).id), status: String((existing[0] as Record<string, unknown>).status), alreadyRequested: true });
    const id = `promotion-${randomUUID()}`;
    await sql!.query(`
      INSERT INTO rental_listing_promotions (id, listing_id, requester_id, package, note)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, listingId, result.user.id, packageName, note]);
    const admins = await sql!.query("SELECT id FROM rental_users WHERE role = 'admin'");
    for (const admin of admins) {
      const adminId = String((admin as Record<string, unknown>).id || "");
      if (!adminId) continue;
      await sql!.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'promotion', '收到推广申请', 'New promotion request', $3, $4, '/admin/promotions')
      `, [`notification-${randomUUID()}`, adminId, `房源「${String(listing.title_zh || listing.title_en || "房源")}」申请了推广展示。`, `The listing “${String(listing.title_en || listing.title_zh || "A listing")}” requested promotional placement.`]);
    }
    return NextResponse.json({ id, listingId, package: packageName, status: "requested" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Promotion request could not be submitted right now." }, { status: 502 });
  }
}

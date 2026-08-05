import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to view listing analytics." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before viewing listing analytics." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT l.id, l.title_zh, l.title_en, l.status, l.created_at,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'view')::int AS views,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'save')::int AS saves,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'contact')::int AS contacts,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'share')::int AS shares,
        (SELECT COUNT(*) FROM rental_inquiries i WHERE i.listing_id = l.id)::int AS inquiries
      FROM rental_listings l
      WHERE l.owner_id = $1
      ORDER BY l.created_at DESC
    `, [user.id]);
    const listings = rows.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        titleZh: String(item.title_zh || ""),
        titleEn: String(item.title_en || ""),
        status: String(item.status || ""),
        createdAt: item.created_at instanceof Date ? item.created_at.toISOString() : String(item.created_at || ""),
        views: number(item.views), saves: number(item.saves), contacts: number(item.contacts), shares: number(item.shares), inquiries: number(item.inquiries),
      };
    });
    return NextResponse.json({ totals: listings.reduce((total, item) => ({ views: total.views + item.views, saves: total.saves + item.saves, contacts: total.contacts + item.contacts, shares: total.shares + item.shares, inquiries: total.inquiries + item.inquiries }), { views: 0, saves: 0, contacts: 0, shares: 0, inquiries: 0 }), listings });
  } catch {
    return NextResponse.json({ error: "Listing analytics could not be loaded right now." }, { status: 502 });
  }
}

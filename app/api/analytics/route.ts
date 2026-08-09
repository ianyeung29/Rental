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
      SELECT l.id, l.title_zh, l.title_en, l.status, l.created_at, l.updated_at, l.availability_confirmed_at,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'view' AND (e.user_id IS NULL OR e.user_id <> l.owner_id))::int AS views,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'save')::int AS saves,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'contact')::int AS contacts,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'share')::int AS shares,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'share' AND e.metadata->>'channel' IN ('wechat', 'wechat-moments'))::int AS wechat_shares,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'share' AND e.metadata->>'channel' = 'tiktok')::int AS tiktok_shares,
        (SELECT COUNT(*) FROM rental_listing_events e WHERE e.listing_id = l.id AND e.event_type = 'share' AND e.metadata->>'channel' = 'poster')::int AS poster_shares,
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
        updatedAt: item.updated_at instanceof Date ? item.updated_at.toISOString() : String(item.updated_at || ""),
        availabilityConfirmedAt: item.availability_confirmed_at instanceof Date ? item.availability_confirmed_at.toISOString() : item.availability_confirmed_at ? String(item.availability_confirmed_at) : null,
        views: number(item.views), saves: number(item.saves), contacts: number(item.contacts), shares: number(item.shares), inquiries: number(item.inquiries),
        wechatShares: number(item.wechat_shares), tiktokShares: number(item.tiktok_shares), posterShares: number(item.poster_shares),
      };
    });
    const totals = listings.reduce((total, item) => ({
      views: total.views + item.views,
      saves: total.saves + item.saves,
      contacts: total.contacts + item.contacts,
      shares: total.shares + item.shares,
      inquiries: total.inquiries + item.inquiries,
      wechatShares: total.wechatShares + item.wechatShares,
      tiktokShares: total.tiktokShares + item.tiktokShares,
      posterShares: total.posterShares + item.posterShares,
    }), { views: 0, saves: 0, contacts: 0, shares: 0, inquiries: 0, wechatShares: 0, tiktokShares: 0, posterShares: 0 });
    const topListing = [...listings].sort((left, right) => right.inquiries - left.inquiries || right.views - left.views)[0] || null;
    return NextResponse.json({
      totals,
      summary: {
        activeListings: listings.filter((listing) => listing.status === "published").length,
        inquiryRate: totals.views > 0 ? Number(((totals.inquiries / totals.views) * 100).toFixed(1)) : 0,
        topListingId: topListing?.id || null,
        topListingTitleZh: topListing?.titleZh || null,
        topListingTitleEn: topListing?.titleEn || null,
      },
      listings,
    });
  } catch {
    return NextResponse.json({ error: "Listing analytics could not be loaded right now." }, { status: 502 });
  }
}

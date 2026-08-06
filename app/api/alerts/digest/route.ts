import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { emailIsConfigured, sendListingExpirationAlert, sendSavedSearchAlert } from "../../../lib/email";
import { emailAlertsAllowed } from "../../../lib/notification-preferences";
import { sendPushToUser } from "../../../lib/push";

function list(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countMatches(listingValue: unknown, filter: string) {
  if (!filter) return true;
  const listing = String(listingValue || "").replace("+", "");
  const listingNumber = Number(listing);
  if (!Number.isFinite(listingNumber)) return false;
  if (filter.endsWith("+")) return listingNumber >= Number(filter.slice(0, -1));
  if (listing.endsWith("+") || String(listingValue || "").includes("+")) return false;
  return listingNumber === Number(filter);
}

function moveInMatches(listingValue: unknown, filter: string) {
  if (!filter) return true;
  const listing = String(listingValue || "").toLowerCase();
  if (listing === "immediate") return true;
  const months: Record<string, string> = { august: "08", september: "09", october: "10" };
  return months[filter] ? listing.slice(5, 7) === months[filter] : true;
}

function matches(search: Record<string, unknown>, listing: Record<string, unknown>) {
  const location = String(search.location || "").trim().toLowerCase();
  const searchable = `${String(listing.title_zh || "")} ${String(listing.title_en || "")} ${String(listing.area_zh || "")} ${String(listing.area_en || "")}`.toLowerCase();
  const minPrice = search.min_price == null ? 0 : number(search.min_price);
  const maxPrice = search.max_price == null ? Number.POSITIVE_INFINITY : number(search.max_price);
  const minSqft = search.min_sqft == null ? 0 : number(search.min_sqft);
  const maxSqft = search.max_sqft == null ? Number.POSITIVE_INFINITY : number(search.max_sqft);
  const listingPrice = number(listing.price);
  const listingSqft = number(listing.square_feet);
  const features = list(listing.features);
  const requiredFeatures = list(search.features);
  return (!location || searchable.includes(location)) &&
    listingPrice >= minPrice && listingPrice <= maxPrice &&
    (!search.min_sqft && !search.max_sqft || listingSqft >= minSqft && listingSqft <= maxSqft) &&
    countMatches(listing.bedrooms, String(search.bedrooms || "")) &&
    countMatches(listing.bathrooms, String(search.bathrooms || "")) &&
    (String(search.rental_type || "all") === "all" || String(listing.rental_type || "") === String(search.rental_type)) &&
    moveInMatches(listing.move_in, String(search.move_in || "")) &&
    requiredFeatures.every((feature) => features.includes(feature));
}

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : request.headers.get("x-cron-secret")?.trim() || "";
  if (!configuredSecret || suppliedSecret !== configuredSecret) return NextResponse.json({ error: "Alert digest is not authorized." }, { status: 503 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    await ensureDatabaseSchema();
    const searches = await sql.query(`
      SELECT s.user_id, s.location, s.min_price, s.max_price, s.min_sqft, s.max_sqft, s.bedrooms, s.bathrooms,
             s.rental_type, s.move_in, s.features, s.last_alert_at,
             u.email, u.display_name,
             COALESCE(p.email_enabled, TRUE) AS email_enabled,
             COALESCE(p.saved_search_alerts, TRUE) AS saved_search_alerts
      FROM rental_saved_searches s
      JOIN rental_users u ON u.id = s.user_id
      LEFT JOIN rental_notification_preferences p ON p.user_id = s.user_id
      WHERE s.alert_frequency = 'daily'
        AND u.email_verified_at IS NOT NULL
        AND (s.last_alert_at IS NULL OR s.last_alert_at < NOW() - INTERVAL '20 hours')
      LIMIT 500
    `);
    const listings = await sql.query(`
      SELECT id, title_zh, title_en, area_zh, area_en, price, bedrooms, bathrooms, square_feet, rental_type, move_in, features, created_at
      FROM rental_listings
      WHERE status = 'published' AND moderation_status = 'approved' AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 1000
    `);
    let processed = 0;
    let sent = 0;
    let emailFailed = 0;
    for (const searchRow of searches) {
      const search = searchRow as Record<string, unknown>;
      const defaultCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const storedCutoff = search.last_alert_at ? Date.parse(String(search.last_alert_at)) : Number.NaN;
      const cutoff = Number.isFinite(storedCutoff) ? storedCutoff : defaultCutoff;
      const matchesForSearch = listings.filter((listing) => {
        const listingCreatedAt = Date.parse(String((listing as Record<string, unknown>).created_at || ""));
        return Number.isFinite(listingCreatedAt) && listingCreatedAt > cutoff && matches(search, listing as Record<string, unknown>);
      }).slice(0, 8) as Record<string, unknown>[];
      if (matchesForSearch.length > 0) {
        const titles = matchesForSearch.map((listing) => String(listing.title_zh || listing.title_en || "新房源"));
        if (emailIsConfigured() && search.email_enabled !== false && search.saved_search_alerts !== false && await emailAlertsAllowed(String(search.user_id), "saved_search_alerts")) {
          try {
            await sendSavedSearchAlert({ email: String(search.email), displayName: String(search.display_name || ""), location: String(search.location || ""), listingTitles: titles });
            sent += 1;
          } catch {
            emailFailed += 1;
          }
        }
        await sql.query(`
          INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
          VALUES ($1, $2, 'savedSearch', '保存的搜索有新房源', 'New listings for your saved search', $3, $4, '/#rentals')
        `, [`notification-${randomUUID()}`, String(search.user_id), `你的搜索发现了 ${titles.length} 套新房源。`, `${titles.length} new listings match your saved search.`]);
        await sendPushToUser(String(search.user_id), {
          title: "安居 / Anjurentals",
          body: `${titles.length} 套新房源符合你的保存搜索。 / ${titles.length} new listings match your saved search.`,
          url: "/#rentals",
          tag: `saved-search-${String(search.user_id)}`,
        }).catch(() => undefined);
      }
      await sql.query("UPDATE rental_saved_searches SET last_alert_at = NOW() WHERE user_id = $1", [String(search.user_id)]);
      processed += 1;
    }
    const expirationRows = await sql.query(`
      SELECT l.id, l.owner_id, l.title_zh, l.title_en, l.expires_on,
             u.email, u.display_name,
             COALESCE(p.email_enabled, TRUE) AS email_enabled,
             COALESCE(p.listing_expiration_alerts, TRUE) AS listing_expiration_alerts
      FROM rental_listings l
      JOIN rental_users u ON u.id = l.owner_id
      LEFT JOIN rental_notification_preferences p ON p.user_id = l.owner_id
      WHERE l.status IN ('published', 'paused')
        AND l.expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        AND u.email_verified_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM rental_listing_expiration_alerts sent_alert
          WHERE sent_alert.listing_id = l.id AND sent_alert.expires_on = l.expires_on
        )
      ORDER BY l.expires_on ASC
      LIMIT 500
    `);
    let expirationProcessed = 0;
    for (const row of expirationRows as Record<string, unknown>[]) {
      const ownerId = String(row.owner_id || "");
      const expiresOn = String(row.expires_on || "").slice(0, 10);
      const titleZh = String(row.title_zh || row.title_en || "房源");
      const titleEn = String(row.title_en || row.title_zh || "your listing");
      if (!ownerId || !expiresOn) continue;
      await sql.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'listingExpiration', '房源即将到期', 'Listing expiring soon', $3, $4, '/#account')
      `, [`notification-${randomUUID()}`, ownerId, `「${titleZh}」将在 ${expiresOn} 到期，请及时续期或修改房源。`, `“${titleEn}” expires on ${expiresOn}. Renew or update it from your account desk.`]);
      await sendPushToUser(ownerId, {
        title: "安居 / Anjurentals",
        body: `「${titleZh}」即将到期。 / “${titleEn}” is expiring soon.`,
        url: "/#account",
        tag: `listing-expiration-${String(row.id)}`,
      }).catch(() => undefined);
      if (emailIsConfigured() && row.email_enabled !== false && row.listing_expiration_alerts !== false && await emailAlertsAllowed(ownerId, "listing_expiration_alerts")) {
        try {
          await sendListingExpirationAlert({ email: String(row.email || ""), displayName: String(row.display_name || ""), listingTitle: titleZh, expiresOn });
          sent += 1;
        } catch {
          emailFailed += 1;
        }
      }
      await sql.query("INSERT INTO rental_listing_expiration_alerts (listing_id, user_id, expires_on) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [String(row.id), ownerId, expiresOn]);
      expirationProcessed += 1;
    }
    return NextResponse.json({ ok: true, processed, expirationProcessed, sent, emailFailed, configuredEmail: emailIsConfigured() });
  } catch {
    return NextResponse.json({ error: "Saved search alerts could not be processed right now." }, { status: 502 });
  }
}

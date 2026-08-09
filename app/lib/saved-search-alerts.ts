import { randomUUID } from "node:crypto";
import { sendSavedSearchAlert, emailIsConfigured } from "./email";
import { sql } from "./db";
import { hasActiveSavedSearchExposure } from "./listing-notification-addon";
import { savedSearchExposureIsActive } from "./listing-exposure-policy";
import { sendPushToUser } from "./push";

function list(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countMatches(listingValue: unknown, filter: string) {
  if (!filter) return true;
  const rawListing = String(listingValue || "");
  const listing = rawListing.replace("+", "");
  const listingNumber = Number(listing);
  if (!Number.isFinite(listingNumber)) return false;
  if (filter.endsWith("+")) return listingNumber >= Number(filter.slice(0, -1));
  if (rawListing.includes("+")) return false;
  return listingNumber === Number(filter);
}

function moveInMatches(listingValue: unknown, filter: string) {
  if (!filter) return true;
  const listing = String(listingValue || "").toLowerCase();
  if (listing === "immediate") return true;
  const months: Record<string, string> = { august: "08", september: "09", october: "10" };
  return months[filter] ? listing.slice(5, 7) === months[filter] : true;
}

export function matchesSavedSearch(search: Record<string, unknown>, listing: Record<string, unknown>) {
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

export async function notifyInstantSavedSearches(listing: Record<string, unknown>) {
  if (!sql) return { matched: 0, notified: 0, emailSent: 0 };
  const listingId = String(listing.id || "");
  const ownerId = String(listing.owner_id || "");
  if (!savedSearchExposureIsActive(listingId, ownerId, await hasActiveSavedSearchExposure(listingId, ownerId))) {
    return { matched: 0, notified: 0, emailSent: 0 };
  }
  const searches = await sql.query(`
    SELECT s.user_id, s.location, s.min_price, s.max_price, s.min_sqft, s.max_sqft, s.bedrooms, s.bathrooms,
           s.rental_type, s.move_in, s.features,
           u.email, u.display_name,
           COALESCE(p.email_enabled, TRUE) AS email_enabled,
           COALESCE(p.saved_search_alerts, TRUE) AS saved_search_alerts
    FROM rental_saved_searches s
    JOIN rental_users u ON u.id = s.user_id
    LEFT JOIN rental_notification_preferences p ON p.user_id = s.user_id
    WHERE s.alert_frequency = 'instant'
      AND u.email_verified_at IS NOT NULL
    LIMIT 500
  `);
  let matched = 0;
  let notified = 0;
  let emailSent = 0;
  const listingTitleZh = String(listing.title_zh || listing.title_en || "新房源");
  const listingTitleEn = String(listing.title_en || listing.title_zh || "New listing");
  for (const row of searches as Record<string, unknown>[]) {
    const search = row as Record<string, unknown>;
    if (String(search.user_id || "") === String(listing.owner_id || "") || !matchesSavedSearch(search, listing)) continue;
    matched += 1;
    await sql.query(`
      INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
      VALUES ($1, $2, 'savedSearch', '找到匹配的新房源', 'A saved search found a match', $3, $4, '/#rentals')
    `, [
      `notification-${randomUUID()}`,
      String(search.user_id),
      `「${listingTitleZh}」符合你保存的搜索条件。`,
      `“${listingTitleEn}” matches your saved search.`,
    ]);
    await sendPushToUser(String(search.user_id), {
      title: "安居 / Anjurentals",
      body: `找到匹配的新房源：${listingTitleZh} / New saved-search match: ${listingTitleEn}`,
      url: "/#rentals",
      tag: `saved-search-${listingId}`,
    }).catch(() => undefined);
    if (emailIsConfigured() && search.email_enabled !== false && search.saved_search_alerts !== false && String(search.email || "") && !String(search.email).endsWith(".invalid")) {
      try {
        await sendSavedSearchAlert({
          email: String(search.email),
          displayName: String(search.display_name || ""),
          location: String(search.location || ""),
          listingTitles: [listingTitleZh],
        });
        emailSent += 1;
      } catch {
        // Keep the in-app alert even if optional email delivery fails.
      }
    }
    await sql.query("UPDATE rental_saved_searches SET last_alert_at = NOW(), updated_at = NOW() WHERE user_id = $1", [String(search.user_id)]);
    notified += 1;
  }
  return { matched, notified, emailSent };
}

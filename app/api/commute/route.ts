import { NextResponse } from "next/server";
import { buildCommuteEstimate, buildNearbyChineseSupermarketEstimate } from "../../lib/location-context";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { recordApplicationErrorSafely, recordLocationQualityEventSafely } from "../../lib/monitoring";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../lib/rate-limit";
import { recordApiUsageSafely } from "../../lib/usage";

const MAX_BODY_LENGTH = 2_500;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Commute request is too large." }, { status: 413 });
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Please send a valid commute request." }, { status: 400 });
  }

  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const preset = body.preset === "nearbyChineseSupermarket" ? "nearbyChineseSupermarket" : null;
  const listingId = typeof body.listingId === "string" ? body.listingId.trim().slice(0, 180) : "";
  if (!destination && !preset) return NextResponse.json({ error: "Add a destination such as a school, landmark, or neighborhood." }, { status: 400 });
  if (preset && !listingId) return NextResponse.json({ error: "This listing cannot use a private-address supermarket estimate." }, { status: 400 });

  let rateLimit;
  try {
    rateLimit = await consumeRateLimit({ key: `maps:commute:${hashRateLimitPart(requestAddress(request))}`, limit: 20, windowSeconds: 60 * 60 });
  } catch {
    return NextResponse.json({ error: "Usage limits are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many route estimates. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  let estimate;
  try {
    if (preset === "nearbyChineseSupermarket") {
      if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
      await ensureDatabaseSchema();
      const rows = await sql.query(`
        SELECT l.area_zh, l.area_en, pd.private_address
        FROM rental_listings l
        JOIN rental_listing_private_details pd ON pd.listing_id = l.id
        WHERE l.id = $1
          AND l.status = 'published'
          AND l.moderation_status = 'approved'
          AND (l.expires_on IS NULL OR l.expires_on >= CURRENT_DATE)
        LIMIT 1
      `, [listingId]);
      const listing = rows[0] as Record<string, unknown> | undefined;
      if (!listing || !String(listing.private_address || "").trim()) {
        return NextResponse.json({ error: "A private-address supermarket estimate is not available for this listing." }, { status: 404 });
      }
      estimate = await buildNearbyChineseSupermarketEstimate({
        privateAddress: String(listing.private_address),
        areaEn: String(listing.area_en || ""),
        areaZh: String(listing.area_zh || ""),
        mode: body.mode,
        locale: body.locale === "en" ? "en" : "zh",
      });
    } else {
      estimate = await buildCommuteEstimate({
        areaEn: typeof body.areaEn === "string" ? body.areaEn : "",
        areaZh: typeof body.areaZh === "string" ? body.areaZh : "",
        boroughEn: typeof body.boroughEn === "string" ? body.boroughEn : "",
        boroughZh: typeof body.boroughZh === "string" ? body.boroughZh : "",
        destination,
        mode: body.mode,
        locale: body.locale === "en" ? "en" : "zh",
      });
    }
  } catch (error) {
    await recordApplicationErrorSafely({ source: "google_maps", route: "/api/commute", method: "POST", message: "Google Maps commute estimate failed.", errorName: error instanceof Error ? error.name : "UnknownError", stack: error instanceof Error ? error.stack : "" });
    return NextResponse.json({ error: "Map services are temporarily unavailable; try again later." }, { status: 502 });
  }
  if (estimate.usage.placesCalls > 0 || estimate.usage.routeCalls > 0 || estimate.usage.cacheHit) {
    await recordApiUsageSafely({
      provider: "google_maps",
      endpoint: "commute-estimate",
      placesCalls: estimate.usage.placesCalls,
      routeCalls: estimate.usage.routeCalls,
      cacheHit: estimate.usage.cacheHit,
      status: estimate.usage.cacheHit ? "cached" : estimate.source === "google" ? "success" : "empty",
      metadata: { mode: estimate.mode, preset: preset || "freeText" },
    });
  }
  if (!estimate.cached && (estimate.usage.placesCalls > 0 || estimate.usage.routeCalls > 0)) {
    await recordLocationQualityEventSafely({
      lookupKind: "commute",
      placesCalls: estimate.usage.placesCalls,
      routeCalls: estimate.usage.routeCalls,
      placesQualityIssues: estimate.source === "none" && estimate.usage.placesCalls > 0 ? 1 : 0,
      routesQualityIssues: !estimate.minutes && estimate.usage.routeCalls > 0 ? 1 : 0,
      rejectionReasons: [
        ...(estimate.source === "none" && estimate.usage.placesCalls > 0 ? ["commute-place-not-found"] : []),
        ...(!estimate.minutes && estimate.usage.routeCalls > 0 ? ["commute-route-not-verifiable"] : []),
      ],
      metadata: { mode: estimate.mode, preset: preset || "freeText" },
    });
  }
  const { usage: _usage, ...payload } = estimate;
  void _usage;
  return NextResponse.json(payload);
}

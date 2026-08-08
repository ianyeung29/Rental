import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { clearLocationContextCache, DEFAULT_LOCATION_LOOKUP_SETTINGS, LOCATION_LOOKUP_LIMITS, ensureDatabaseSchema, readLocationLookupSettings, sql, updateLocationLookupSettings } from "../../../lib/db";
import { DEFAULT_USAGE_ALERT_SETTINGS, getUsageMonitoringSnapshot, updateUsageAlertSettings } from "../../../lib/monitoring";
import { clearLocationContextMemoryCache } from "../../../lib/location-context";
import { estimateGoogleMapsGrossCost, GOOGLE_PLACES_PRO_COST_PER_THOUSAND, GOOGLE_ROUTES_COST_PER_THOUSAND } from "../../../lib/usage";

async function adminContext() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to access API usage." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before accessing API usage." }, { status: 403 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "API usage access is restricted." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayValue(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
}

function summaryFromRow(row: Record<string, unknown>) {
  const placesCalls = numberValue(row.places_calls);
  const routeCalls = numberValue(row.route_calls);
  return {
    provider: String(row.provider || ""),
    requests: numberValue(row.requests),
    inputTokens: numberValue(row.input_tokens),
    outputTokens: numberValue(row.output_tokens),
    totalTokens: numberValue(row.total_tokens),
    placesCalls,
    routeCalls,
    cacheHits: numberValue(row.cache_hits),
    grossCostUsd: numberValue(row.estimated_cost_usd) || estimateGoogleMapsGrossCost(placesCalls, routeCalls),
  };
}

export async function GET(request: Request) {
  const context = await adminContext();
  if (context.error) return context.error;
  const requestedDays = Number(new URL(request.url).searchParams.get("days"));
  const days = requestedDays === 7 || requestedDays === 90 ? requestedDays : 30;
  try {
    await ensureDatabaseSchema();
    const [summaryRows, monitoring, endpointRows, dailyRows, rateRows, locationLookup] = await Promise.all([
      sql!.query(`
        SELECT provider,
               COUNT(*)::int AS requests,
               COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
               COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
               COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
               COALESCE(SUM(places_calls), 0)::bigint AS places_calls,
               COALESCE(SUM(route_calls), 0)::bigint AS route_calls,
               COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)::int AS cache_hits,
               COALESCE(SUM(estimated_cost_usd), 0)::numeric AS estimated_cost_usd
        FROM rental_api_usage
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
        GROUP BY provider
        ORDER BY provider
      `, [days]),
      getUsageMonitoringSnapshot(),
      sql!.query(`
        SELECT provider, endpoint, model,
               COUNT(*)::int AS requests,
               COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
               COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
               COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
               COALESCE(SUM(places_calls), 0)::bigint AS places_calls,
               COALESCE(SUM(route_calls), 0)::bigint AS route_calls,
               COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)::int AS cache_hits,
               COALESCE(SUM(estimated_cost_usd), 0)::numeric AS estimated_cost_usd
        FROM rental_api_usage
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
        GROUP BY provider, endpoint, model
        ORDER BY requests DESC, provider, endpoint
        LIMIT 100
      `, [days]),
      sql!.query(`
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
               COUNT(*)::int AS requests,
               COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
               COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
               COALESCE(SUM(places_calls), 0)::bigint AS places_calls,
               COALESCE(SUM(route_calls), 0)::bigint AS route_calls,
               COALESCE(SUM(estimated_cost_usd), 0)::numeric AS estimated_cost_usd
        FROM rental_api_usage
        WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY day DESC
        LIMIT 90
      `, [days]),
      sql!.query(`
        SELECT COUNT(*)::int AS active_keys,
               COALESCE(SUM(request_count), 0)::bigint AS current_requests,
               COALESCE(SUM(blocked_count), 0)::bigint AS blocked_requests
        FROM rental_rate_limits
        WHERE updated_at >= NOW() - ($1 * INTERVAL '1 day')
      `, [days]),
      readLocationLookupSettings(),
    ]);

    const summary = summaryRows.map((row) => summaryFromRow(row as Record<string, unknown>));
    const endpoints = endpointRows.map((row) => summaryFromRow({ ...(row as Record<string, unknown>), provider: `${String((row as Record<string, unknown>).provider || "")} · ${String((row as Record<string, unknown>).endpoint || "")}` }));
    const daily = dailyRows.map((row) => {
      const value = row as Record<string, unknown>;
      const placesCalls = numberValue(value.places_calls);
      const routeCalls = numberValue(value.route_calls);
      return {
        day: dayValue(value.day),
        requests: numberValue(value.requests),
        inputTokens: numberValue(value.input_tokens),
        outputTokens: numberValue(value.output_tokens),
        placesCalls,
        routeCalls,
        grossCostUsd: numberValue(value.estimated_cost_usd) || estimateGoogleMapsGrossCost(placesCalls, routeCalls),
      };
    });
    const rate = rateRows[0] as Record<string, unknown> | undefined;
    return NextResponse.json({
      days,
      generatedAt: new Date().toISOString(),
      summary,
      endpoints,
      daily,
      rateLimits: {
        activeKeys: numberValue(rate?.active_keys),
        currentRequests: numberValue(rate?.current_requests),
        blockedRequests: numberValue(rate?.blocked_requests),
      },
      pricing: {
        googlePlacesFreeMonthly: 5000,
        googleRoutesFreeMonthly: 10000,
        googlePlacesCostPerCall: GOOGLE_PLACES_PRO_COST_PER_THOUSAND / 1000,
        googleRoutesCostPerCall: GOOGLE_ROUTES_COST_PER_THOUSAND / 1000,
        note: "Google gross estimates do not subtract the monthly free usage caps; OpenAI estimates use recorded token counts.",
      },
      locationLookup,
      monitoring,
    });
  } catch {
    return NextResponse.json({ error: "API usage could not be loaded right now." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const context = await adminContext();
  if (context.error) return context.error;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 2_000) return NextResponse.json({ error: "Admin settings are too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const hasLocationLookup = body.locationLookup !== undefined;
    const hasAlertSettings = ["enabled", "openaiMonthlyCostUsd", "googlePlacesMonthlyCalls", "googleRoutesMonthlyCalls", "blockedRequestsThreshold", "googlePlacesQualityIssuesThreshold", "googleRoutesQualityIssuesThreshold"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    const clearLocationCacheRequested = body.clearLocationCache === true;
    if (!hasLocationLookup && !hasAlertSettings && !clearLocationCacheRequested) return NextResponse.json({ error: "No admin setting changes were supplied." }, { status: 400 });

    let settings;
    if (hasAlertSettings) {
      const openaiMonthlyCostUsd = Number(body.openaiMonthlyCostUsd);
      const googlePlacesMonthlyCalls = Number(body.googlePlacesMonthlyCalls);
      const googleRoutesMonthlyCalls = Number(body.googleRoutesMonthlyCalls);
      const blockedRequestsThreshold = Number(body.blockedRequestsThreshold);
      const googlePlacesQualityIssuesThreshold = Number(body.googlePlacesQualityIssuesThreshold);
      const googleRoutesQualityIssuesThreshold = Number(body.googleRoutesQualityIssuesThreshold);
      settings = {
        enabled: body.enabled === undefined ? DEFAULT_USAGE_ALERT_SETTINGS.enabled : Boolean(body.enabled),
        openaiMonthlyCostUsd,
        googlePlacesMonthlyCalls,
        googleRoutesMonthlyCalls,
        blockedRequestsThreshold,
        googlePlacesQualityIssuesThreshold,
        googleRoutesQualityIssuesThreshold,
      };
      if (!Number.isFinite(openaiMonthlyCostUsd) || openaiMonthlyCostUsd < 0.01 || openaiMonthlyCostUsd > 1_000_000) return NextResponse.json({ error: "Set an OpenAI threshold between $0.01 and $1,000,000." }, { status: 400 });
      if (!Number.isInteger(googlePlacesMonthlyCalls) || googlePlacesMonthlyCalls < 1 || googlePlacesMonthlyCalls > 100_000_000) return NextResponse.json({ error: "Set a valid Google Places call threshold." }, { status: 400 });
      if (!Number.isInteger(googleRoutesMonthlyCalls) || googleRoutesMonthlyCalls < 1 || googleRoutesMonthlyCalls > 100_000_000) return NextResponse.json({ error: "Set a valid Google Routes call threshold." }, { status: 400 });
      if (!Number.isInteger(blockedRequestsThreshold) || blockedRequestsThreshold < 1 || blockedRequestsThreshold > 100_000_000) return NextResponse.json({ error: "Set a valid blocked-request threshold." }, { status: 400 });
      if (!Number.isInteger(googlePlacesQualityIssuesThreshold) || googlePlacesQualityIssuesThreshold < 1 || googlePlacesQualityIssuesThreshold > 100_000_000) return NextResponse.json({ error: "Set a valid Places quality-issue threshold." }, { status: 400 });
      if (!Number.isInteger(googleRoutesQualityIssuesThreshold) || googleRoutesQualityIssuesThreshold < 1 || googleRoutesQualityIssuesThreshold > 100_000_000) return NextResponse.json({ error: "Set a valid Routes quality-issue threshold." }, { status: 400 });
      await updateUsageAlertSettings(settings, context.user.id);
    }

    let locationLookup;
    if (hasLocationLookup) {
      if (!body.locationLookup || typeof body.locationLookup !== "object" || Array.isArray(body.locationLookup)) return NextResponse.json({ error: "Map lookup settings are invalid." }, { status: 400 });
      const input = body.locationLookup as Record<string, unknown>;
      const placesCallsPerLookup = Number(input.placesCallsPerLookup);
      const routeCallsPerLookup = Number(input.routeCallsPerLookup);
      if (!Number.isInteger(placesCallsPerLookup) || placesCallsPerLookup < LOCATION_LOOKUP_LIMITS.minPlacesCallsPerLookup || placesCallsPerLookup > LOCATION_LOOKUP_LIMITS.maxPlacesCallsPerLookup) return NextResponse.json({ error: `Places lookups must be a whole number from ${LOCATION_LOOKUP_LIMITS.minPlacesCallsPerLookup} to ${LOCATION_LOOKUP_LIMITS.maxPlacesCallsPerLookup} per uncached lookup.` }, { status: 400 });
      if (!Number.isInteger(routeCallsPerLookup) || routeCallsPerLookup < LOCATION_LOOKUP_LIMITS.minRouteCallsPerLookup || routeCallsPerLookup > LOCATION_LOOKUP_LIMITS.maxRouteCallsPerLookup) return NextResponse.json({ error: `Routes lookups must be a whole number from ${LOCATION_LOOKUP_LIMITS.minRouteCallsPerLookup} to ${LOCATION_LOOKUP_LIMITS.maxRouteCallsPerLookup} per uncached lookup.` }, { status: 400 });
      locationLookup = await updateLocationLookupSettings({ placesCallsPerLookup, routeCallsPerLookup }, context.user.id);
    }

    let clearedLocationCache;
    if (clearLocationCacheRequested) {
      const persistent = await clearLocationContextCache();
      const memory = clearLocationContextMemoryCache();
      clearedLocationCache = { persistent, memory };
    }

    return NextResponse.json({ ...(settings ? { settings } : {}), ...(locationLookup ? { locationLookup } : {}), ...(clearedLocationCache ? { clearedLocationCache } : {}) });
  } catch {
    return NextResponse.json({ error: "Admin settings could not be saved right now." }, { status: 502 });
  }
}

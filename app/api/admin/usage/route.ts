import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { estimateGoogleMapsGrossCost } from "../../../lib/usage";

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
    const [summaryRows, endpointRows, dailyRows, rateRows] = await Promise.all([
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
        note: "Google gross estimates do not subtract the monthly free usage caps; OpenAI estimates use recorded token counts.",
      },
    });
  } catch {
    return NextResponse.json({ error: "API usage could not be loaded right now." }, { status: 502 });
  }
}

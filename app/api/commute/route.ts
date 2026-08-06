import { NextResponse } from "next/server";
import { buildCommuteEstimate } from "../../lib/location-context";
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
  if (!destination) return NextResponse.json({ error: "Add a destination such as a school, landmark, or neighborhood." }, { status: 400 });

  let rateLimit;
  try {
    rateLimit = await consumeRateLimit({ key: `maps:commute:${hashRateLimitPart(requestAddress(request))}`, limit: 20, windowSeconds: 60 * 60 });
  } catch {
    return NextResponse.json({ error: "Usage limits are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many route estimates. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  const estimate = await buildCommuteEstimate({
    areaEn: typeof body.areaEn === "string" ? body.areaEn : "",
    areaZh: typeof body.areaZh === "string" ? body.areaZh : "",
    boroughEn: typeof body.boroughEn === "string" ? body.boroughEn : "",
    boroughZh: typeof body.boroughZh === "string" ? body.boroughZh : "",
    destination,
    mode: body.mode,
    locale: body.locale === "en" ? "en" : "zh",
  });
  if (estimate.usage.placesCalls > 0 || estimate.usage.routeCalls > 0 || estimate.usage.cacheHit) {
    await recordApiUsageSafely({
      provider: "google_maps",
      endpoint: "commute-estimate",
      placesCalls: estimate.usage.placesCalls,
      routeCalls: estimate.usage.routeCalls,
      cacheHit: estimate.usage.cacheHit,
      status: estimate.usage.cacheHit ? "cached" : estimate.source === "google" ? "success" : "empty",
      metadata: { mode: estimate.mode },
    });
  }
  const { usage: _usage, ...payload } = estimate;
  void _usage;
  return NextResponse.json(payload);
}

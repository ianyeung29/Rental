import { NextResponse } from "next/server";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../lib/rate-limit";
import { recordApiUsageSafely } from "../../lib/usage";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function component(components: AddressComponent[], type: string) {
  const match = components.find((item) => item.types?.includes(type));
  return (match?.longText || match?.shortText || "").trim();
}

function boroughId(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("queens")) return "queens";
  if (normalized.includes("brooklyn") || normalized.includes("kings")) return "brooklyn";
  if (normalized.includes("manhattan") || normalized.includes("new york county")) return "manhattan";
  if (normalized.includes("bronx")) return "bronx";
  if (normalized.includes("staten island") || normalized.includes("richmond")) return "staten-island";
  if (normalized.includes("nassau") || normalized.includes("suffolk")) return "long-island";
  return "upstate";
}

export async function POST(request: Request) {
  let rateLimit;
  try {
    rateLimit = await consumeRateLimit({ key: `maps:location-suggest:${hashRateLimitPart(requestAddress(request))}`, limit: 12, windowSeconds: 60 * 60 });
  } catch {
    return NextResponse.json({ error: "Location suggestions are temporarily unavailable." }, { status: 503 });
  }
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many location suggestions. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  const body = await request.json().catch(() => null) as { address?: unknown } | null;
  const address = typeof body?.address === "string" ? body.address.trim().slice(0, 240) : "";
  if (address.length < 8) return NextResponse.json({ error: "Enter a complete street address first." }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server-side map suggestions are not configured." }, { status: 503 });

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.addressComponents,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: `${address}, New York, USA`, languageCode: "en", regionCode: "US", maxResultCount: 1 }),
      cache: "no-store",
    });
    await recordApiUsageSafely({ provider: "google_maps", endpoint: "location-suggest", placesCalls: 1, status: response.ok ? "success" : "error", metadata: { purpose: "private-address-to-public-area" } });
    if (!response.ok) return NextResponse.json({ error: "The address could not be matched. Check the full address and try again." }, { status: 422 });
    const payload = await response.json() as { places?: Array<{ addressComponents?: AddressComponent[]; formattedAddress?: string }> };
    const place = payload.places?.[0];
    const components = place?.addressComponents || [];
    if (!place || !components.length) return NextResponse.json({ error: "The address could not be matched. Check the full address and try again." }, { status: 422 });

    const county = component(components, "administrative_area_level_2");
    const borough = component(components, "sublocality_level_1") || county;
    const area = component(components, "neighborhood") || component(components, "sublocality_level_2") || component(components, "locality");
    return NextResponse.json({ boroughId: boroughId(`${borough} ${county}`), borough, area, formattedAddress: place.formattedAddress || "" });
  } catch {
    return NextResponse.json({ error: "Location suggestions are temporarily unavailable." }, { status: 502 });
  }
}

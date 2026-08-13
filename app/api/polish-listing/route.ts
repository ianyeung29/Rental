import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { buildLocationContext, DEFAULT_LOCATION_LOOKUP_OPTIONS, normalizeLocationLookupOptions } from "../../lib/location-context";
import type { LocationContext, LocationContextUsage, LocationLookupOption } from "../../lib/location-context";
import { hasRestrictedHousingLanguage } from "../../lib/safety";
import { consumeRateLimit } from "../../lib/rate-limit";
import { recordApplicationErrorSafely, recordLocationQualityEventSafely } from "../../lib/monitoring";
import { estimateOpenAICost, recordApiUsageSafely } from "../../lib/usage";

type ListingInput = {
  titleEn?: unknown;
  titleZh?: unknown;
  areaEn?: unknown;
  areaZh?: unknown;
  privateAddress?: unknown;
  boroughEn?: unknown;
  boroughZh?: unknown;
  locale?: unknown;
  rentalType?: unknown;
  price?: unknown;
  currency?: unknown;
  squareFeet?: unknown;
  moveIn?: unknown;
  lease?: unknown;
  features?: unknown;
  descriptionEn?: unknown;
  descriptionZh?: unknown;
  locationLookupOptions?: unknown;
};

type NormalizedListing = {
  titleEn: string;
  titleZh: string;
  areaEn: string;
  areaZh: string;
  boroughEn: string;
  boroughZh: string;
  locale: "zh" | "en";
  rentalType: string;
  price: string;
  currency: string;
  squareFeet: string;
  moveIn: string;
  lease: string;
  features: string[];
  descriptionEn: string;
  descriptionZh: string;
  locationLookupOptions: LocationLookupOption[];
  locationContext: LocationContext | null;
};

const MAX_BODY_LENGTH = 14_000;
const MAX_FIELD_LENGTH = 2_500;
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_REASONING_EFFORT = "low";
const MAX_POLISHES_PER_HOUR = 20;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    titleEn: { type: "string" },
    titleZh: { type: "string" },
    descriptionEn: { type: "string" },
    descriptionZh: { type: "string" },
    notes: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
  },
  required: ["titleEn", "titleZh", "descriptionEn", "descriptionZh", "notes"],
} as const;

const SYSTEM_PROMPT = `You are a careful bilingual rental-listing editor for a housing marketplace.

Rewrite only the facts supplied by the poster. Do not invent rent, square footage, amenities, transit access, views, availability, verification, photos, exact addresses, contact details, or legal promises. Preserve numbers, dates, and approximate-location language. The marketplace uses USD by default, so do not add a currency code to user-facing listing copy. Keep the English and Simplified Chinese versions aligned. If one language is missing, translate conservatively from the supplied facts.

The optional locationContext contains provider-returned facts for the selected area. When routeOrigin is privateAddress, the server used the private address only to improve route accuracy; the exact address is not included in this input and must never appear in the output. Use nearby places only as area references. A destination with minutes is still an approximate route: describe drive destinations as approximate driving time, walk destinations as approximate walking time, and transit destinations as approximate public-transit time. A transit station with driveMinutes is an approximate drive to that station (for example, an LIRR station); do not describe it as walking distance. Transit lines on a destination are the lines returned for that route; lines on a station are lines serving that station, not a guarantee that every line reaches the destination. Do not turn these facts into a guaranteed commute, an exact-address disclosure, or a guarantee of service frequency. If locationContext is empty or has no facts, do not add nearby, destination, or transportation claims.

Remove or rewrite discriminatory housing preferences or screening language. The marketplace supports Chinese-language outreach, but listings must not restrict housing based on protected traits or imply that only a particular ethnicity, nationality, family status, disability status, religion, sex, or similar group may rent. Mention a short review note when you had to soften or remove a risky claim.

Use concise, factual, welcoming copy with no markdown. Return only the requested JSON object.`;

function text(value: unknown, max = MAX_FIELD_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => text(item, 80)).filter(Boolean).slice(0, 8);
}

function normalizeInput(input: ListingInput): NormalizedListing {
  return {
    titleEn: text(input.titleEn, 180),
    titleZh: text(input.titleZh, 180),
    areaEn: text(input.areaEn, 180),
    areaZh: text(input.areaZh, 180),
    boroughEn: text(input.boroughEn, 120),
    boroughZh: text(input.boroughZh, 120),
    locale: input.locale === "en" ? "en" : "zh",
    rentalType: text(input.rentalType, 40),
    price: text(input.price, 40),
    currency: text(input.currency, 12),
    squareFeet: typeof input.squareFeet === "number" || typeof input.squareFeet === "string" ? String(input.squareFeet).trim().slice(0, 20) : "",
    moveIn: text(input.moveIn, 80),
    lease: text(input.lease, 40),
    features: textList(input.features),
    descriptionEn: text(input.descriptionEn),
    descriptionZh: text(input.descriptionZh),
    locationLookupOptions: normalizeLocationLookupOptions(input.locationLookupOptions, DEFAULT_LOCATION_LOOKUP_OPTIONS),
    locationContext: null,
  };
}

function hasPotentiallyDiscriminatoryLanguage(input: NormalizedListing) {
  return hasRestrictedHousingLanguage([input.descriptionEn, input.descriptionZh]);
}

function appendIfMissing(base: string, addition: string) {
  return addition && base.includes(addition) ? "" : addition;
}

function transitLineLabel(line: { name: string; shortName?: string; vehicleType?: string }, locale: "zh" | "en") {
  const vehicleType = line.vehicleType?.toLocaleUpperCase();
  const vehicle = vehicleType === "BUS" || vehicleType === "INTERCITY_BUS" || vehicleType === "TROLLEYBUS" ? (locale === "zh" ? "公交" : "bus") : vehicleType === "SUBWAY" || vehicleType === "METRO_RAIL" ? (locale === "zh" ? "地铁" : "subway") : vehicleType === "TRAIN" || vehicleType === "RAIL" || vehicleType === "HEAVY_RAIL" || vehicleType === "COMMUTER_TRAIN" ? (locale === "zh" ? "铁路" : "rail") : "";
  const name = line.shortName || line.name;
  return vehicle ? `${vehicle} ${name}` : name;
}

function localPolish(input: NormalizedListing) {
  const typeEn = input.rentalType === "privateRoom" ? "Private room" : input.rentalType === "sublet" ? "Sublet" : "Entire home";
  const typeZh = input.rentalType === "privateRoom" ? "独立房间" : input.rentalType === "sublet" ? "转租房源" : "整套住房";
  const titleEn = input.titleEn || `${typeEn}${input.areaEn ? ` in ${input.areaEn}` : ""}`;
  const titleZh = input.titleZh || `${typeZh}${input.areaZh ? ` · ${input.areaZh}` : ""}`;
  const featureEn = input.features.length ? `Features listed by the poster: ${input.features.join(", ")}.` : "";
  const featureZh = input.features.length ? `发布者填写的特点：${input.features.join("、")}。` : "";
  const nearbyLine = input.locationContext?.nearby.map((place) => `${place.name} (${place.category})`).join(", ") || "";
  const transitLine = input.locationContext?.transit.map((item) => `${item.name} (${item.mode}${item.walkMinutes ? `, about a ${item.walkMinutes}-minute walk` : ""}${item.driveMinutes ? `, about a ${item.driveMinutes}-minute drive` : ""}${item.lines?.length ? `, lines serving the stop: ${item.lines.map((line) => transitLineLabel(line, "en")).join(", ")}` : ""})`).join(", ") || "";
  const transitLineZh = input.locationContext?.transit.map((item) => `${item.name}（${item.mode}${item.walkMinutes ? `，约 ${item.walkMinutes} 分钟步行` : ""}${item.driveMinutes ? `，约 ${item.driveMinutes} 分钟车程` : ""}${item.lines?.length ? `，经停线路：${item.lines.map((line) => transitLineLabel(line, "zh")).join("、")}` : ""}）`).join("、") || "";
  const destinationLine = input.locationContext?.destinations.map((item) => `${item.name} (${item.category}, ${item.minutes ? `about ${item.minutes} minutes` : "travel time unavailable"} by ${item.mode === "drive" ? "car" : item.mode === "transit" ? "public transit" : "walking"}${item.transitLines?.length ? ` via ${item.transitLines.map((line) => transitLineLabel(line, "en")).join(", ")}` : ""})`).join(", ") || "";
  const destinationLineZh = input.locationContext?.destinations.map((item) => `${item.name}（${item.category}，约 ${item.minutes || "暂缺"} 分钟${item.mode === "drive" ? "车程" : item.mode === "transit" ? "公共交通" : "步行"}${item.transitLines?.length ? `，线路：${item.transitLines.map((line) => transitLineLabel(line, "zh")).join("、")}` : ""}）`).join("、") || "";
  const contextLabelEn = input.locationContext?.routeOrigin === "privateAddress" ? "Approximate travel references from the listing location, to verify before publishing" : "Selected-area references, to verify before publishing";
  const contextLabelZh = input.locationContext?.routeOrigin === "privateAddress" ? "房源附近参考（发布前请核实）" : "所选区域参考（发布前请核实）";
  const contextEn = input.locationContext?.source === "google" && (nearbyLine || transitLine || destinationLine)
    ? `${contextLabelEn}: ${[nearbyLine ? `Nearby: ${nearbyLine}.` : "", destinationLine ? `Destinations: ${destinationLine}.` : "", transitLine ? `Transportation: ${transitLine}.` : ""].filter(Boolean).join(" ")}`
    : "";
  const contextZh = input.locationContext?.source === "google" && (nearbyLine || transitLine || destinationLineZh)
    ? `${contextLabelZh}：${[nearbyLine ? `附近：${nearbyLine}。` : "", destinationLineZh ? `生活圈和超市：${destinationLineZh}。` : "", transitLineZh ? `交通：${transitLineZh}。` : ""].filter(Boolean).join("")}`
    : "";
  const descriptionEn = [
    input.descriptionEn,
    input.areaEn ? appendIfMissing(input.descriptionEn, `Approximate area: ${input.areaEn}.`) : "",
    input.price ? appendIfMissing(input.descriptionEn, `Monthly rent: ${input.price}.`) : "",
    input.squareFeet ? appendIfMissing(input.descriptionEn, `Approximate size: ${input.squareFeet} sq ft.`) : "",
    input.moveIn ? appendIfMissing(input.descriptionEn, `Move-in: ${input.moveIn}.`) : "",
    input.lease ? appendIfMissing(input.descriptionEn, `Minimum lease: ${input.lease} months.`) : "",
    appendIfMissing(input.descriptionEn, featureEn),
    appendIfMissing(input.descriptionEn, contextEn),
  ].filter(Boolean).join(" ");
  const descriptionZh = [
    input.descriptionZh,
    input.areaZh ? appendIfMissing(input.descriptionZh, `大致区域：${input.areaZh}。`) : "",
    input.price ? appendIfMissing(input.descriptionZh, `月租：${input.price}。`) : "",
    input.squareFeet ? appendIfMissing(input.descriptionZh, `建筑面积：${input.squareFeet} 平方英尺。`) : "",
    input.moveIn ? appendIfMissing(input.descriptionZh, `入住时间：${input.moveIn}。`) : "",
    input.lease ? appendIfMissing(input.descriptionZh, `最短租期：${input.lease} 个月。`) : "",
    appendIfMissing(input.descriptionZh, featureZh),
    appendIfMissing(input.descriptionZh, contextZh),
  ].filter(Boolean).join(" ");
  const notes = ["Review the draft before publishing; this local preview does not use an AI model."];
  if (input.locationContext?.notes.length) notes.push(...input.locationContext.notes.slice(0, 1));
  if (hasPotentiallyDiscriminatoryLanguage(input)) notes.push("Review language about who may rent and remove protected-trait restrictions.");
  return { titleEn, titleZh, descriptionEn, descriptionZh, notes: notes.slice(0, 3) };
}

function outputText(response: unknown) {
  if (!response || typeof response !== "object") return "";
  const record = response as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  return record.output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const partRecord = part as { type?: unknown; text?: unknown };
      return partRecord.type === "output_text" && typeof partRecord.text === "string" ? [partRecord.text] : [];
    });
  }).join("\n");
}

function safeModelOutput(value: unknown, fallback: string, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before using listing polish." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before using listing polish." }, { status: 403 });
  let rateLimit;
  try {
    rateLimit = await consumeRateLimit({ key: `ai:polish-listing:${user.id}`, limit: MAX_POLISHES_PER_HOUR, windowSeconds: 60 * 60 });
  } catch {
    return NextResponse.json({ error: "Usage limits are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if (!rateLimit.allowed) return NextResponse.json({ error: "You have reached the listing polish limit for this hour." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  let input: NormalizedListing;
  let privateAddress = "";
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Listing draft is too large." }, { status: 413 });
    const parsedBody = JSON.parse(rawBody) as ListingInput;
    privateAddress = text(parsedBody.privateAddress, 240);
    input = normalizeInput(parsedBody);
  } catch {
    return NextResponse.json({ error: "Please send a valid listing draft." }, { status: 400 });
  }

  if (!input.areaEn && !input.areaZh) return NextResponse.json({ error: "Choose a public area before creating the listing copy." }, { status: 400 });
  if (!input.price) return NextResponse.json({ error: "Add the monthly rent before creating the listing copy." }, { status: 400 });

  let mapUsage: LocationContextUsage = { placesCalls: 0, routeCalls: 0, cacheHit: false };
  try {
    input.locationContext = await buildLocationContext({
      areaEn: input.areaEn,
      areaZh: input.areaZh,
      boroughEn: input.boroughEn,
      boroughZh: input.boroughZh,
      privateAddress,
      locale: input.locale,
      lookupOptions: input.locationLookupOptions,
      onUsage: (usage) => { mapUsage = usage; },
    });
  } catch (error) {
    await recordApplicationErrorSafely({ source: "google_maps", severity: "warning", route: "/api/polish-listing", method: "POST", message: "Location context lookup failed during listing polish.", errorName: error instanceof Error ? error.name : "UnknownError", stack: error instanceof Error ? error.stack : "", userId: user.id });
    input.locationContext = {
      source: "none",
      approximateArea: input.areaZh || input.areaEn,
      routeOrigin: "approximateArea",
      nearby: [],
      transit: [],
      destinations: [],
      lookupOptions: input.locationLookupOptions,
      notes: [input.locale === "zh" ? "地图服务暂时不可用；AI不会编造附近设施或交通时间。" : "Map context is temporarily unavailable; AI will not invent nearby places or travel times."],
      cached: false,
    };
  }

  if (mapUsage.placesCalls > 0 || mapUsage.routeCalls > 0 || mapUsage.cacheHit) {
    await recordApiUsageSafely({
      userId: user.id,
      provider: "google_maps",
      endpoint: "polish-listing/location-context",
      placesCalls: mapUsage.placesCalls,
      routeCalls: mapUsage.routeCalls,
      cacheHit: mapUsage.cacheHit,
      status: mapUsage.cacheHit ? "cached" : "success",
      metadata: { lookupOptions: input.locationLookupOptions },
    });
  }
  if (!mapUsage.cacheHit && input.locationContext?.diagnostics && (mapUsage.placesCalls > 0 || mapUsage.routeCalls > 0 || input.locationContext.diagnostics.placesQualityIssues > 0 || input.locationContext.diagnostics.routesQualityIssues > 0)) {
    await recordLocationQualityEventSafely({
      lookupKind: "listing-polish",
      placesCalls: input.locationContext.diagnostics.placesAttempted,
      routeCalls: input.locationContext.diagnostics.routesAttempted,
      placesQualityIssues: input.locationContext.diagnostics.placesQualityIssues,
      routesQualityIssues: input.locationContext.diagnostics.routesQualityIssues,
      rejectionReasons: input.locationContext.diagnostics.rejectionReasons,
      metadata: { lookupOptions: input.locationLookupOptions },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ...localPolish(input), locationContext: input.locationContext, source: "local" });
  }

  try {
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...(model.startsWith("gpt-5.6") ? { reasoning: { effort: reasoningEffort } } : {}),
        input: [
          { role: "developer", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input) },
        ],
        text: { format: { type: "json_schema", name: "polished_listing", strict: true, schema: OUTPUT_SCHEMA } },
      }),
      cache: "no-store",
    });

    const data = await response.json();
    const usage = data?.usage || {};
    await recordApiUsageSafely({
      userId: user.id,
      provider: "openai",
      endpoint: "polish-listing",
      model,
      requestId: response.headers.get("x-request-id") || (typeof data?.id === "string" ? data.id : ""),
      status: response.ok ? "success" : "error",
      inputTokens: Number(usage.input_tokens || 0),
      outputTokens: Number(usage.output_tokens || 0),
      totalTokens: Number(usage.total_tokens || 0),
      estimatedCostUsd: estimateOpenAICost(Number(usage.input_tokens || 0), Number(usage.output_tokens || 0)),
      metadata: { reasoningEffort, httpStatus: response.status },
    });
    if (!response.ok) {
      await recordApplicationErrorSafely({ source: "openai", route: "/api/polish-listing", method: "POST", message: "OpenAI listing polish request returned an error.", requestId: response.headers.get("x-request-id") || "", userId: user.id, metadata: { httpStatus: response.status } });
      return NextResponse.json({ error: "The AI service could not polish this draft right now." }, { status: 502 });
    }
    const rawOutput = outputText(data);
    const polished = JSON.parse(rawOutput) as { titleEn?: unknown; titleZh?: unknown; descriptionEn?: unknown; descriptionZh?: unknown; notes?: unknown };
    const notes = Array.isArray(polished.notes) ? polished.notes.filter((note): note is string => typeof note === "string").map((note) => text(note, 240)).filter(Boolean).slice(0, 3) : [];
    if (input.locationContext?.notes[0] && notes.length < 3) notes.push(input.locationContext.notes[0]);
    return NextResponse.json({
      titleEn: safeModelOutput(polished.titleEn, input.titleEn, 180),
      titleZh: safeModelOutput(polished.titleZh, input.titleZh, 180),
      descriptionEn: safeModelOutput(polished.descriptionEn, input.descriptionEn, MAX_FIELD_LENGTH),
      descriptionZh: safeModelOutput(polished.descriptionZh, input.descriptionZh, MAX_FIELD_LENGTH),
      notes,
      locationContext: input.locationContext,
      source: "openai",
    });
  } catch (error) {
    await recordApplicationErrorSafely({ source: "openai", route: "/api/polish-listing", method: "POST", message: "OpenAI listing polish response could not be processed.", errorName: error instanceof Error ? error.name : "UnknownError", stack: error instanceof Error ? error.stack : "", userId: user.id });
    return NextResponse.json({ error: "The AI service could not polish this draft right now." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { buildLocalCompareSummary, CompareListingFacts, CompareSummaryLocale } from "../../lib/compare-summary";
import { getCurrentUser } from "../../lib/auth";
import { consumeRateLimit } from "../../lib/rate-limit";
import { estimateOpenAICost, recordApiUsageSafely } from "../../lib/usage";

type CompareListingInput = {
  id?: unknown;
  title?: unknown;
  area?: unknown;
  price?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  squareFeet?: unknown;
  moveIn?: unknown;
  lease?: unknown;
  features?: unknown;
  poster?: unknown;
};

type CompareRequest = {
  locale?: unknown;
  listings?: unknown;
};

const MAX_BODY_LENGTH = 12_000;
const MAX_FIELD_LENGTH = 260;
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_REASONING_EFFORT = "low";
const MAX_SUMMARIES_PER_HOUR = 12;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    bestFor: { type: "string" },
    tradeoffs: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
  },
  required: ["headline", "summary", "bestFor", "tradeoffs"],
} as const;

const SYSTEM_PROMPT = `You are a careful comparison assistant for a bilingual rental marketplace.

Compare exactly the two supplied public listing fact sets. Explain the practical tradeoffs using only the supplied rent, approximate area, bedrooms, bathrooms, square footage, move-in timing, lease term, listed features, and poster signals. Do not invent square footage, transit access, building quality, availability, fees, neighborhood safety, legal status, verification, or contact details. Do not infer protected traits or recommend a listing based on them. Do not reveal or ask for an exact address. If a field is missing, say it is not listed. Keep the conclusion concise, balanced, and useful for a renter choosing what to inspect next. Return only the requested JSON object in the requested language.`;

function text(value: unknown, max = MAX_FIELD_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => text(item, 90)).filter(Boolean).slice(0, 8);
}

function normalizeListing(input: CompareListingInput, index: number): CompareListingFacts {
  const price = typeof input.price === "number" ? input.price : Number(input.price);
  return {
    id: text(input.id, 120) || `listing-${index + 1}`,
    title: text(input.title, 180) || `Listing ${index + 1}`,
    area: text(input.area, 180) || "Not listed",
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    bedrooms: text(input.bedrooms, 40) || "Not listed",
    bathrooms: text(input.bathrooms, 40) || "Not listed",
    squareFeet: typeof input.squareFeet === "number" && Number.isFinite(input.squareFeet) && input.squareFeet > 0 ? input.squareFeet : null,
    moveIn: text(input.moveIn, 80) || "Not listed",
    lease: text(input.lease, 80) || "Not listed",
    features: textList(input.features),
    poster: text(input.poster, 120) || "Not listed",
  };
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

function safeText(value: unknown, fallback: string, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before using an AI comparison." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before using an AI comparison." }, { status: 403 });
  let rateLimit;
  try {
    rateLimit = await consumeRateLimit({ key: `ai:compare-summary:${user.id}`, limit: MAX_SUMMARIES_PER_HOUR, windowSeconds: 60 * 60 });
  } catch {
    return NextResponse.json({ error: "Usage limits are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if (!rateLimit.allowed) return NextResponse.json({ error: "You have reached the comparison-summary limit for this hour." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  let locale: CompareSummaryLocale = "zh";
  let listings: CompareListingFacts[];
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Comparison data is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as CompareRequest;
    locale = body.locale === "en" ? "en" : "zh";
    if (!Array.isArray(body.listings) || body.listings.length !== 2) throw new Error("Two listings are required.");
    listings = body.listings.map((listing, index) => normalizeListing((listing && typeof listing === "object" ? listing : {}) as CompareListingInput, index));
  } catch {
    return NextResponse.json({ error: "Please send two valid public listing records." }, { status: 400 });
  }

  const local = buildLocalCompareSummary(listings, locale);
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ...local, source: "local" });

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
          { role: "user", content: JSON.stringify({ language: locale === "zh" ? "Simplified Chinese" : "English", listings }) },
        ],
        text: { format: { type: "json_schema", name: "compare_summary", strict: true, schema: OUTPUT_SCHEMA } },
      }),
      cache: "no-store",
    });

    const data = await response.json();
    const usage = data?.usage || {};
    await recordApiUsageSafely({
      userId: user.id,
      provider: "openai",
      endpoint: "compare-summary",
      model,
      requestId: response.headers.get("x-request-id") || (typeof data?.id === "string" ? data.id : ""),
      status: response.ok ? "success" : "error",
      inputTokens: Number(usage.input_tokens || 0),
      outputTokens: Number(usage.output_tokens || 0),
      totalTokens: Number(usage.total_tokens || 0),
      estimatedCostUsd: estimateOpenAICost(Number(usage.input_tokens || 0), Number(usage.output_tokens || 0)),
      metadata: { reasoningEffort, httpStatus: response.status },
    });
    if (!response.ok) return NextResponse.json({ error: "The AI service could not summarize these listings right now." }, { status: 502 });
    const rawOutput = outputText(data);
    const summary = JSON.parse(rawOutput) as { headline?: unknown; summary?: unknown; bestFor?: unknown; tradeoffs?: unknown };
    const tradeoffs = Array.isArray(summary.tradeoffs)
      ? summary.tradeoffs.filter((item): item is string => typeof item === "string").map((item) => text(item, 320)).filter(Boolean).slice(0, 3)
      : [];
    return NextResponse.json({
      headline: safeText(summary.headline, local.headline, 180),
      summary: safeText(summary.summary, local.summary, 900),
      bestFor: safeText(summary.bestFor, local.bestFor, 320),
      tradeoffs: tradeoffs.length > 0 ? tradeoffs : local.tradeoffs,
      source: "openai",
    });
  } catch {
    return NextResponse.json({ error: "The AI service could not summarize these listings right now." }, { status: 502 });
  }
}

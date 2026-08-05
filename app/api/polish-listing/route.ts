import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { hasRestrictedHousingLanguage } from "../../lib/safety";

type ListingInput = {
  titleEn?: unknown;
  titleZh?: unknown;
  areaEn?: unknown;
  areaZh?: unknown;
  rentalType?: unknown;
  price?: unknown;
  currency?: unknown;
  moveIn?: unknown;
  lease?: unknown;
  features?: unknown;
  descriptionEn?: unknown;
  descriptionZh?: unknown;
};

type NormalizedListing = {
  titleEn: string;
  titleZh: string;
  areaEn: string;
  areaZh: string;
  rentalType: string;
  price: string;
  currency: string;
  moveIn: string;
  lease: string;
  features: string[];
  descriptionEn: string;
  descriptionZh: string;
};

const MAX_BODY_LENGTH = 14_000;
const MAX_FIELD_LENGTH = 2_500;
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_REASONING_EFFORT = "low";
const MAX_POLISHES_PER_HOUR = 20;
const polishUsage = new Map<string, { count: number; resetAt: number }>();

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
    rentalType: text(input.rentalType, 40),
    price: text(input.price, 40),
    currency: text(input.currency, 12),
    moveIn: text(input.moveIn, 80),
    lease: text(input.lease, 40),
    features: textList(input.features),
    descriptionEn: text(input.descriptionEn),
    descriptionZh: text(input.descriptionZh),
  };
}

function hasPotentiallyDiscriminatoryLanguage(input: NormalizedListing) {
  return hasRestrictedHousingLanguage([input.descriptionEn, input.descriptionZh]);
}

function allowPolish(userId: string) {
  const now = Date.now();
  const existing = polishUsage.get(userId);
  if (!existing || existing.resetAt <= now) {
    polishUsage.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (existing.count >= MAX_POLISHES_PER_HOUR) return false;
  existing.count += 1;
  return true;
}

function appendIfMissing(base: string, addition: string) {
  return addition && base.includes(addition) ? "" : addition;
}

function localPolish(input: NormalizedListing) {
  const typeEn = input.rentalType === "privateRoom" ? "Private room" : input.rentalType === "sublet" ? "Sublet" : "Entire home";
  const typeZh = input.rentalType === "privateRoom" ? "独立房间" : input.rentalType === "sublet" ? "转租房源" : "整套住房";
  const titleEn = input.titleEn || `${typeEn}${input.areaEn ? ` in ${input.areaEn}` : ""}`;
  const titleZh = input.titleZh || `${typeZh}${input.areaZh ? ` · ${input.areaZh}` : ""}`;
  const featureEn = input.features.length ? `Features listed by the poster: ${input.features.join(", ")}.` : "";
  const featureZh = input.features.length ? `发布者填写的特点：${input.features.join("、")}。` : "";
  const descriptionEn = [
    input.descriptionEn,
    input.areaEn ? appendIfMissing(input.descriptionEn, `Approximate area: ${input.areaEn}.`) : "",
    input.price ? appendIfMissing(input.descriptionEn, `Monthly rent: ${input.price}.`) : "",
    input.moveIn ? appendIfMissing(input.descriptionEn, `Move-in: ${input.moveIn}.`) : "",
    input.lease ? appendIfMissing(input.descriptionEn, `Minimum lease: ${input.lease} months.`) : "",
    appendIfMissing(input.descriptionEn, featureEn),
  ].filter(Boolean).join(" ");
  const descriptionZh = [
    input.descriptionZh,
    input.areaZh ? appendIfMissing(input.descriptionZh, `大致区域：${input.areaZh}。`) : "",
    input.price ? appendIfMissing(input.descriptionZh, `月租：${input.price}。`) : "",
    input.moveIn ? appendIfMissing(input.descriptionZh, `入住时间：${input.moveIn}。`) : "",
    input.lease ? appendIfMissing(input.descriptionZh, `最短租期：${input.lease} 个月。`) : "",
    appendIfMissing(input.descriptionZh, featureZh),
  ].filter(Boolean).join(" ");
  const notes = ["Review the draft before publishing; this local preview does not use an AI model."];
  if (hasPotentiallyDiscriminatoryLanguage(input)) notes.push("Review language about who may rent and remove protected-trait restrictions.");
  return { titleEn, titleZh, descriptionEn, descriptionZh, notes };
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
  if (!allowPolish(user.id)) return NextResponse.json({ error: "You have reached the listing polish limit for this hour." }, { status: 429 });
  let input: NormalizedListing;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Listing draft is too large." }, { status: 413 });
    input = normalizeInput(JSON.parse(rawBody) as ListingInput);
  } catch {
    return NextResponse.json({ error: "Please send a valid listing draft." }, { status: 400 });
  }

  if (!input.titleEn && !input.titleZh && !input.descriptionEn && !input.descriptionZh) {
    return NextResponse.json({ error: "Add a title or description before polishing." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ...localPolish(input), source: "local" });
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

    if (!response.ok) return NextResponse.json({ error: "The AI service could not polish this draft right now." }, { status: 502 });
    const data = await response.json();
    const rawOutput = outputText(data);
    const polished = JSON.parse(rawOutput) as { titleEn?: unknown; titleZh?: unknown; descriptionEn?: unknown; descriptionZh?: unknown; notes?: unknown };
    const notes = Array.isArray(polished.notes) ? polished.notes.filter((note): note is string => typeof note === "string").map((note) => text(note, 240)).filter(Boolean).slice(0, 3) : [];
    return NextResponse.json({
      titleEn: safeModelOutput(polished.titleEn, input.titleEn, 180),
      titleZh: safeModelOutput(polished.titleZh, input.titleZh, 180),
      descriptionEn: safeModelOutput(polished.descriptionEn, input.descriptionEn, MAX_FIELD_LENGTH),
      descriptionZh: safeModelOutput(polished.descriptionZh, input.descriptionZh, MAX_FIELD_LENGTH),
      notes,
      source: "openai",
    });
  } catch {
    return NextResponse.json({ error: "The AI service could not polish this draft right now." }, { status: 502 });
  }
}

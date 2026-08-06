import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { consumeRateLimit } from "../../lib/rate-limit";
import { estimateOpenAICost, recordApiUsageSafely } from "../../lib/usage";
import { isExactOccupantCount } from "../../lib/renter-options";

type InquiryInput = {
  locale?: unknown;
  titleZh?: unknown;
  titleEn?: unknown;
  areaZh?: unknown;
  areaEn?: unknown;
  price?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  squareFeet?: unknown;
  moveIn?: unknown;
  leaseLength?: unknown;
  occupants?: unknown;
  pets?: unknown;
  tourPreference?: unknown;
  comments?: unknown;
  currentMessage?: unknown;
};

type NormalizedInquiry = {
  locale: "zh" | "en";
  titleZh: string;
  titleEn: string;
  areaZh: string;
  areaEn: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  tourPreference: string;
  comments: string[];
  currentMessage: string;
};

const MAX_BODY_LENGTH = 8_000;
const MAX_FIELD_LENGTH = 500;
const MAX_ASSISTS_PER_HOUR = 10;
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_REASONING_EFFORT = "low";

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    messageZh: { type: "string" },
    messageEn: { type: "string" },
    notes: { type: "array", items: { type: "string" }, maxItems: 2 },
  },
  required: ["messageZh", "messageEn", "notes"],
} as const;

const SYSTEM_PROMPT = `You are a careful bilingual rental inquiry assistant for a Chinese-first housing marketplace.

Write a short, polite message from a renter to a listing owner or agent. Use only the supplied public listing facts and renter answers. Do not invent amenities, fees, availability, transportation, neighborhood claims, exact addresses, employment, income, credit, immigration status, family status, or any protected trait. Do not ask for sensitive documents. Keep the Chinese and English versions aligned. Preserve the renter's questions and make the next action clear, such as asking about a tour or confirming availability. If the renter supplied a freeform message, improve its clarity without changing its meaning. Return only the requested JSON object with no markdown.`;

function text(value: unknown, max = MAX_FIELD_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => text(item, 180)).filter(Boolean).slice(0, 6);
}

function normalizeInput(value: InquiryInput): NormalizedInquiry {
  return {
    locale: value.locale === "en" ? "en" : "zh",
    titleZh: text(value.titleZh, 180),
    titleEn: text(value.titleEn, 180),
    areaZh: text(value.areaZh, 180),
    areaEn: text(value.areaEn, 180),
    price: text(value.price, 40),
    bedrooms: text(value.bedrooms, 30),
    bathrooms: text(value.bathrooms, 30),
    squareFeet: text(value.squareFeet, 30),
    moveIn: text(value.moveIn, 80),
    leaseLength: text(value.leaseLength, 40),
    occupants: text(value.occupants, 40),
    pets: text(value.pets, 80),
    tourPreference: text(value.tourPreference, 80),
    comments: textList(value.comments),
    currentMessage: text(value.currentMessage, 1_200),
  };
}

function localMessages(input: NormalizedInquiry) {
  const titleZh = input.titleZh || input.titleEn || "这套房源";
  const titleEn = input.titleEn || input.titleZh || "this listing";
  const detailsZh = [
    input.moveIn ? `预计入住：${input.moveIn}` : "",
    input.leaseLength ? `期望租期：${input.leaseLength} 个月` : "",
    input.occupants ? `居住人数：${input.occupants}` : "",
    input.pets ? `宠物情况：${input.pets}` : "",
    input.tourPreference ? `看房偏好：${input.tourPreference}` : "",
  ].filter(Boolean).join("；");
  const detailsEn = [
    input.moveIn ? `Move-in: ${input.moveIn}` : "",
    input.leaseLength ? `Lease preference: ${input.leaseLength} months` : "",
    input.occupants ? `Occupants: ${input.occupants}` : "",
    input.pets ? `Pets: ${input.pets}` : "",
    input.tourPreference ? `Tour preference: ${input.tourPreference}` : "",
  ].filter(Boolean).join("; ");
  const questionsZh = input.comments.length ? `我还想了解：${input.comments.join("、")}。` : "想了解房源目前是否仍可租，以及近期看房时间。";
  const questionsEn = input.comments.length ? `I would also like to know: ${input.comments.join(", ")}.` : "I would also like to confirm whether it is still available and ask about upcoming tour times.";
  const currentZh = input.locale === "zh" && input.currentMessage ? `${input.currentMessage} ` : "";
  const currentEn = input.locale === "en" && input.currentMessage ? `${input.currentMessage} ` : "";
  return {
    messageZh: `${currentZh}你好，我对「${titleZh}」感兴趣。${detailsZh ? `${detailsZh}。` : ""}${questionsZh}如果方便，请回复我可看的时间，谢谢！`,
    messageEn: `${currentEn}Hello, I’m interested in ${titleEn}. ${detailsEn ? `${detailsEn}. ` : ""}${questionsEn} If possible, please share a convenient tour time. Thank you!`,
    notes: ["这是基于你填写的信息生成的草稿，发送前请检查内容。"],
  };
}

function outputText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as { output_text?: unknown; output?: unknown };
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

function safeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1_600) : fallback;
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before using the inquiry assistant." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before using the inquiry assistant." }, { status: 403 });

  let rateLimit;
  try {
    rateLimit = await consumeRateLimit({ key: `ai:inquiry-assist:${user.id}`, limit: MAX_ASSISTS_PER_HOUR, windowSeconds: 60 * 60 });
  } catch {
    return NextResponse.json({ error: "Usage limits are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if (!rateLimit.allowed) return NextResponse.json({ error: "You have reached the inquiry-assistant limit for this hour." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  let input: NormalizedInquiry;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Inquiry details are too large." }, { status: 413 });
    input = normalizeInput(JSON.parse(rawBody) as InquiryInput);
  } catch {
    return NextResponse.json({ error: "Please send valid inquiry details." }, { status: 400 });
  }
  if (!isExactOccupantCount(input.occupants)) return NextResponse.json({ error: "Choose the exact number of occupants." }, { status: 400 });

  const local = localMessages(input);
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ...local, source: "local" });

  try {
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        ...(model.startsWith("gpt-5.6") ? { reasoning: { effort: reasoningEffort } } : {}),
        input: [
          { role: "developer", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input) },
        ],
        text: { format: { type: "json_schema", name: "inquiry_assist", strict: true, schema: OUTPUT_SCHEMA } },
      }),
      cache: "no-store",
    });
    const data = await response.json();
    const usage = data?.usage || {};
    await recordApiUsageSafely({
      userId: user.id,
      provider: "openai",
      endpoint: "inquiry-assist",
      model,
      requestId: response.headers.get("x-request-id") || (typeof data?.id === "string" ? data.id : ""),
      status: response.ok ? "success" : "error",
      inputTokens: Number(usage.input_tokens || 0),
      outputTokens: Number(usage.output_tokens || 0),
      totalTokens: Number(usage.total_tokens || 0),
      estimatedCostUsd: estimateOpenAICost(Number(usage.input_tokens || 0), Number(usage.output_tokens || 0)),
      metadata: { reasoningEffort, httpStatus: response.status },
    });
    if (!response.ok) return NextResponse.json({ error: "The inquiry assistant could not prepare a message right now." }, { status: 502 });
    const rawOutput = outputText(data);
    const assistant = JSON.parse(rawOutput) as { messageZh?: unknown; messageEn?: unknown; notes?: unknown };
    const notes = Array.isArray(assistant.notes) ? assistant.notes.filter((note): note is string => typeof note === "string").map((note) => text(note, 240)).filter(Boolean).slice(0, 2) : local.notes;
    return NextResponse.json({
      messageZh: safeMessage(assistant.messageZh, local.messageZh),
      messageEn: safeMessage(assistant.messageEn, local.messageEn),
      notes,
      source: "openai",
    });
  } catch {
    return NextResponse.json({ error: "The inquiry assistant could not prepare a message right now." }, { status: 502 });
  }
}

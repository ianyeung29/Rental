import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "./db";
import { evaluateUsageAlerts } from "./monitoring";

export const OPENAI_INPUT_COST_PER_MILLION = 0.2;
export const OPENAI_OUTPUT_COST_PER_MILLION = 1.2;
export const GOOGLE_PLACES_PRO_COST_PER_THOUSAND = 32;
export const GOOGLE_ROUTES_COST_PER_THOUSAND = 5;

export type ApiUsageRecord = {
  userId?: string | null;
  provider: "openai" | "google_maps";
  endpoint: string;
  model?: string;
  requestId?: string;
  status?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  placesCalls?: number;
  routeCalls?: number;
  cacheHit?: boolean;
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
};

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

export function estimateOpenAICost(inputTokens: number, outputTokens: number) {
  return (safeNumber(inputTokens) / 1_000_000) * OPENAI_INPUT_COST_PER_MILLION + (safeNumber(outputTokens) / 1_000_000) * OPENAI_OUTPUT_COST_PER_MILLION;
}

export function estimateGoogleMapsGrossCost(placesCalls: number, routeCalls: number) {
  return (safeNumber(placesCalls) / 1_000) * GOOGLE_PLACES_PRO_COST_PER_THOUSAND + (safeNumber(routeCalls) / 1_000) * GOOGLE_ROUTES_COST_PER_THOUSAND;
}

export async function recordApiUsage(record: ApiUsageRecord) {
  if (!sql) return;
  await ensureDatabaseSchema();
  const inputTokens = safeNumber(record.inputTokens);
  const outputTokens = safeNumber(record.outputTokens);
  const totalTokens = safeNumber(record.totalTokens) || inputTokens + outputTokens;
  const placesCalls = safeNumber(record.placesCalls);
  const routeCalls = safeNumber(record.routeCalls);
  const estimatedCostUsd = Number.isFinite(record.estimatedCostUsd) ? Math.max(0, Number(record.estimatedCostUsd)) : record.provider === "openai" ? estimateOpenAICost(inputTokens, outputTokens) : estimateGoogleMapsGrossCost(placesCalls, routeCalls);
  await sql.query(`
    INSERT INTO rental_api_usage (
      id, user_id, provider, endpoint, model, request_id, status,
      input_tokens, output_tokens, total_tokens, places_calls, route_calls,
      cache_hit, estimated_cost_usd, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
  `, [
    randomUUID(),
    record.userId || null,
    record.provider,
    record.endpoint.slice(0, 120),
    (record.model || "").slice(0, 120),
    (record.requestId || "").slice(0, 240),
    (record.status || "success").slice(0, 40),
    inputTokens,
    outputTokens,
    totalTokens,
    placesCalls,
    routeCalls,
    Boolean(record.cacheHit),
    estimatedCostUsd,
    JSON.stringify(record.metadata || {}),
  ]);
  await evaluateUsageAlerts();
}

export async function recordApiUsageSafely(record: ApiUsageRecord) {
  try {
    await recordApiUsage(record);
  } catch (error) {
    console.error(`[usage] ${record.provider} usage could not be recorded`, error);
  }
}

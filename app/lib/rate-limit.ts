import { createHash } from "node:crypto";
import { ensureDatabaseSchema, sql } from "./db";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
};

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hashRateLimitPart(value: string) {
  return createHash("sha256").update(value.trim().slice(0, 500)).digest("hex").slice(0, 32);
}

export function requestAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip") || "unknown").slice(0, 120);
}

function resultFromRow(row: Record<string, unknown>, limit: number, windowSeconds: number, allowed: boolean): RateLimitResult {
  const count = numeric(row.request_count);
  const startedAt = new Date(String(row.window_started_at || Date.now()));
  const resetAtMs = startedAt.getTime() + windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(resetAtMs).toISOString(),
    retryAfterSeconds,
  };
}

export async function consumeRateLimit(input: { key: string; limit: number; windowSeconds?: number }) {
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  const limit = Math.max(1, Math.floor(input.limit));
  const windowSeconds = Math.max(1, Math.floor(input.windowSeconds || 3600));
  const key = input.key.trim().slice(0, 240);
  if (!key) throw new Error("A rate-limit key is required.");
  await ensureDatabaseSchema();

  const rows = await sql.query(`
    INSERT INTO rental_rate_limits (scope_key, window_started_at, request_count, updated_at)
    VALUES ($1, NOW(), 1, NOW())
    ON CONFLICT (scope_key) DO UPDATE SET
      window_started_at = CASE
        WHEN rental_rate_limits.window_started_at <= NOW() - ($3 * INTERVAL '1 second') THEN NOW()
        ELSE rental_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN rental_rate_limits.window_started_at <= NOW() - ($3 * INTERVAL '1 second') THEN 1
        ELSE rental_rate_limits.request_count + 1
      END,
      updated_at = NOW()
    WHERE rental_rate_limits.window_started_at <= NOW() - ($3 * INTERVAL '1 second')
       OR rental_rate_limits.request_count < $2
    RETURNING request_count, window_started_at
  `, [key, limit, windowSeconds]);

  if (rows[0]) return resultFromRow(rows[0] as Record<string, unknown>, limit, windowSeconds, true);

  const current = await sql.query("SELECT request_count, window_started_at FROM rental_rate_limits WHERE scope_key = $1 LIMIT 1", [key]);
  if (!current[0]) return resultFromRow({ request_count: limit, window_started_at: new Date().toISOString() }, limit, windowSeconds, false);
  await sql.query("UPDATE rental_rate_limits SET blocked_count = blocked_count + 1, updated_at = NOW() WHERE scope_key = $1", [key]);
  return resultFromRow(current[0] as Record<string, unknown>, limit, windowSeconds, false);
}

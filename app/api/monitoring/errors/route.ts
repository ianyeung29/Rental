import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { recordApplicationErrorSafely } from "../../../lib/monitoring";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../../lib/rate-limit";

const MAX_BODY_LENGTH = 7_000;
const ALLOWED_SEVERITIES = new Set(["error", "warning", "critical"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let limit;
  try {
    limit = await consumeRateLimit({ key: `monitoring:client-error:${hashRateLimitPart(requestAddress(request))}`, limit: 8, windowSeconds: 15 * 60 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ ok: false }, { status: 413 });
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    userId = (await getCurrentUser())?.id || null;
  } catch {
    userId = null;
  }
  const severity = text(body.severity, 20);
  await recordApplicationErrorSafely({
    source: text(body.source, 80) || "client",
    severity: ALLOWED_SEVERITIES.has(severity) ? severity as "error" | "warning" | "critical" : "error",
    route: text(body.route, 180),
    method: text(body.method, 16) || "CLIENT",
    message: text(body.message, 1_200) || "Client error",
    errorName: text(body.errorName, 160),
    stack: text(body.stack, 4_000),
    requestId: text(body.requestId, 240),
    userId,
    metadata: { digest: text(body.digest, 240), userAgent: text(request.headers.get("user-agent"), 400) },
  });
  return NextResponse.json({ ok: true });
}

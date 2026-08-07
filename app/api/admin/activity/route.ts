import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { decryptIpAddress, purgeExpiredAuditLogs } from "../../../lib/audit";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { hashRateLimitPart } from "../../../lib/rate-limit";

const OUTCOMES = new Set(["success", "failure", "blocked"]);
const MAX_DAYS = 30;
const MAX_ROWS = 200;

async function adminContext() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to access activity logs." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before accessing activity logs." }, { status: 403 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "Activity log access is restricted." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function dateValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function metadataValue(value: unknown) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: Request) {
  const context = await adminContext();
  if (context.error) return context.error;

  const params = new URL(request.url).searchParams;
  const requestedDays = Number(params.get("days") || 30);
  const days = Number.isFinite(requestedDays) ? Math.min(MAX_DAYS, Math.max(1, Math.round(requestedDays))) : 30;
  const eventType = (params.get("eventType") || "").trim().slice(0, 100);
  const requestedOutcome = (params.get("outcome") || "").trim();
  const outcome = OUTCOMES.has(requestedOutcome) ? requestedOutcome : "";
  const search = (params.get("search") || "").trim().slice(0, 120);
  const requestedLimit = Number(params.get("limit") || MAX_ROWS);
  const limit = Number.isFinite(requestedLimit) ? Math.min(MAX_ROWS, Math.max(1, Math.round(requestedLimit))) : MAX_ROWS;

  const values: unknown[] = [days];
  const conditions = ["created_at >= NOW() - ($1 * INTERVAL '1 day')"];
  if (eventType) {
    values.push(eventType.endsWith(".") ? `${eventType}%` : eventType);
    conditions.push(eventType.endsWith(".") ? `event_type LIKE $${values.length}` : `event_type = $${values.length}`);
  }
  if (outcome) {
    values.push(outcome);
    conditions.push(`outcome = $${values.length}`);
  }
  if (search) {
    const like = `%${search}%`;
    values.push(like);
    const likeParam = values.length;
    values.push(hashRateLimitPart(search));
    const hashParam = values.length;
    conditions.push(`(
      user_email ILIKE $${likeParam}
      OR country_code ILIKE $${likeParam}
      OR browser ILIKE $${likeParam}
      OR operating_system ILIKE $${likeParam}
      OR device_type ILIKE $${likeParam}
      OR route ILIKE $${likeParam}
      OR ip_address_hash = $${hashParam}
    )`);
  }
  const where = conditions.join(" AND ");
  values.push(limit);
  const limitParam = values.length;

  try {
    await ensureDatabaseSchema();
    await purgeExpiredAuditLogs().catch(() => 0);
    const [rows, totalsRows] = await Promise.all([
      sql!.query(`
        SELECT id, event_type, outcome, user_id, user_email, is_authenticated,
               ip_address_encrypted, ip_address_hash, country_code, browser,
               operating_system, device_type, route, method, metadata, created_at
        FROM rental_audit_logs
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${limitParam}
      `, values),
      sql!.query(`
        SELECT COUNT(*)::int AS events,
               COUNT(*) FILTER (WHERE is_authenticated)::int AS authenticated,
               COUNT(*) FILTER (WHERE NOT is_authenticated)::int AS anonymous,
               COUNT(*) FILTER (WHERE outcome = 'failure')::int AS failures,
               COUNT(*) FILTER (WHERE outcome = 'blocked')::int AS blocked
        FROM rental_audit_logs
        WHERE ${where}
      `, values.slice(0, -1)),
    ]);
    const totals = totalsRows[0] as Record<string, unknown> | undefined;
    const events = rows.map((row) => {
      const value = row as Record<string, unknown>;
      const encryptedIp = String(value.ip_address_encrypted || "");
      const ipHash = String(value.ip_address_hash || "");
      return {
        id: String(value.id || ""),
        eventType: String(value.event_type || ""),
        outcome: String(value.outcome || "success"),
        userId: value.user_id ? String(value.user_id) : null,
        userEmail: String(value.user_email || ""),
        authenticated: Boolean(value.is_authenticated),
        ipAddress: decryptIpAddress(encryptedIp) || (ipHash ? "Encrypted / hash-only" : "Unknown"),
        countryCode: String(value.country_code || ""),
        browser: String(value.browser || "Unknown"),
        operatingSystem: String(value.operating_system || "Unknown"),
        deviceType: String(value.device_type || "Unknown"),
        route: String(value.route || ""),
        method: String(value.method || ""),
        metadata: metadataValue(value.metadata),
        createdAt: dateValue(value.created_at),
      };
    });
    return NextResponse.json({
      days,
      retentionDays: 30,
      generatedAt: new Date().toISOString(),
      events,
      totals: {
        events: Number(totals?.events || 0),
        authenticated: Number(totals?.authenticated || 0),
        anonymous: Number(totals?.anonymous || 0),
        failures: Number(totals?.failures || 0),
        blocked: Number(totals?.blocked || 0),
      },
    });
  } catch {
    return NextResponse.json({ error: "The activity log could not be loaded right now." }, { status: 502 });
  }
}

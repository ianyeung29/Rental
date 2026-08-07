import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "./db";
import { hashRateLimitPart, requestAddress } from "./rate-limit";

export type AuditOutcome = "success" | "failure" | "blocked";

export type AuditUser = {
  id: string;
  email: string;
};

export type AuditEventInput = {
  request?: Request;
  eventType: string;
  outcome?: AuditOutcome;
  user?: AuditUser | null;
  route?: string;
  metadata?: Record<string, unknown>;
};

type AuditRequestDetails = {
  ipAddress: string;
  ipHash: string;
  countryCode: string;
  browser: string;
  operatingSystem: string;
  deviceType: string;
  route: string;
  method: string;
};

const SENSITIVE_METADATA_KEY = /(password|token|secret|address|prompt|description|message|body|content|phone|credential|authorization|cookie)/i;

function encryptionKey() {
  const source = process.env.AUDIT_LOG_ENCRYPTION_KEY?.trim();
  return source ? createHash("sha256").update(source).digest() : null;
}

function encryptIpAddress(value: string) {
  const key = encryptionKey();
  if (!key || !value || value === "unknown") return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptIpAddress(value: unknown) {
  const encrypted = typeof value === "string" ? value : "";
  const key = encryptionKey();
  const parts = encrypted.split(".");
  if (!key || parts.length !== 3) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[0], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[1], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function firstHeader(request: Request | undefined, names: string[]) {
  for (const name of names) {
    const value = request?.headers.get(name)?.trim();
    if (value) return value.slice(0, 120);
  }
  return "";
}

function browserFromUserAgent(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (value.includes("edg/")) return "Edge";
  if (value.includes("opr/") || value.includes("opera")) return "Opera";
  if (value.includes("samsungbrowser")) return "Samsung Internet";
  if (value.includes("firefox") || value.includes("fxios")) return "Firefox";
  if (value.includes("crios") || value.includes("chrome")) return "Chrome";
  if (value.includes("safari") && !value.includes("chrome")) return "Safari";
  if (value.includes("electron")) return "Electron";
  return userAgent ? "Other" : "Unknown";
}

function operatingSystemFromUserAgent(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (value.includes("windows")) return "Windows";
  if (value.includes("android")) return "Android";
  if (value.includes("iphone") || value.includes("ipad") || value.includes("ipod")) return "iOS";
  if (value.includes("mac os") || value.includes("macintosh")) return "macOS";
  if (value.includes("linux")) return "Linux";
  return userAgent ? "Other" : "Unknown";
}

function deviceFromUserAgent(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (value.includes("ipad") || value.includes("tablet")) return "Tablet";
  if (value.includes("mobile") || value.includes("android") || value.includes("iphone") || value.includes("ipod")) return "Mobile";
  return userAgent ? "Desktop" : "Unknown";
}

function safeMetadata(metadata: Record<string, unknown> | undefined) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(metadata || {}).filter(([name]) => !SENSITIVE_METADATA_KEY.test(name)).slice(0, 24)) {
    const safeKey = key.slice(0, 80);
    const value = typeof rawValue === "string"
      ? rawValue.slice(0, 300)
      : typeof rawValue === "number" || typeof rawValue === "boolean" || rawValue === null
        ? rawValue
        : String(rawValue).slice(0, 300);
    const candidate = JSON.stringify({ ...safe, [safeKey]: value });
    if (candidate.length > 4_000) break;
    safe[safeKey] = value;
  }
  return JSON.stringify(safe);
}

export function auditRequestDetails(request?: Request, route?: string): AuditRequestDetails {
  const userAgent = firstHeader(request, ["user-agent"]);
  const ipAddress = request ? requestAddress(request) : "unknown";
  const requestUrl = request ? new URL(request.url) : null;
  return {
    ipAddress,
    ipHash: ipAddress === "unknown" ? "" : hashRateLimitPart(ipAddress),
    countryCode: firstHeader(request, ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"]).toUpperCase(),
    browser: browserFromUserAgent(userAgent),
    operatingSystem: operatingSystemFromUserAgent(userAgent),
    deviceType: deviceFromUserAgent(userAgent),
    route: (route || requestUrl?.pathname || "").slice(0, 160),
    method: (request?.method || "").slice(0, 12),
  };
}

export async function recordAuditEvent(input: AuditEventInput) {
  if (!sql) return;
  const details = auditRequestDetails(input.request, input.route);
  await ensureDatabaseSchema();
  await sql.query(`
    INSERT INTO rental_audit_logs (
      id, event_type, outcome, user_id, user_email, is_authenticated,
      ip_address_encrypted, ip_address_hash, country_code, browser,
      operating_system, device_type, route, method, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
  `, [
    `audit-${randomUUID()}`,
    input.eventType.trim().slice(0, 100),
    input.outcome || "success",
    input.user?.id || null,
    input.user?.email?.trim().toLowerCase().slice(0, 240) || "",
    Boolean(input.user?.id),
    encryptIpAddress(details.ipAddress),
    details.ipHash,
    details.countryCode,
    details.browser,
    details.operatingSystem,
    details.deviceType,
    details.route,
    details.method,
    safeMetadata(input.metadata),
  ]);
}

export async function recordAuditEventSafely(input: AuditEventInput) {
  try {
    await recordAuditEvent(input);
  } catch (error) {
    console.error(`[audit] ${input.eventType} could not be recorded`, error);
  }
}

export async function purgeExpiredAuditLogs() {
  if (!sql) return 0;
  await ensureDatabaseSchema();
  const rows = await sql.query("DELETE FROM rental_audit_logs WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id");
  return rows.length;
}

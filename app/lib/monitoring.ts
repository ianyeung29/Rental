import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "./db";
import { emailIsConfigured, sendUsageAlertEmail } from "./email";

export type UsageAlertSettings = {
  enabled: boolean;
  openaiMonthlyCostUsd: number;
  googlePlacesMonthlyCalls: number;
  googleRoutesMonthlyCalls: number;
  blockedRequestsThreshold: number;
  googlePlacesQualityIssuesThreshold: number;
  googleRoutesQualityIssuesThreshold: number;
};

export const DEFAULT_USAGE_ALERT_SETTINGS: UsageAlertSettings = {
  enabled: true,
  openaiMonthlyCostUsd: 10,
  googlePlacesMonthlyCalls: 4_000,
  googleRoutesMonthlyCalls: 8_000,
  blockedRequestsThreshold: 1,
  googlePlacesQualityIssuesThreshold: 3,
  googleRoutesQualityIssuesThreshold: 3,
};

export type UsageAlert = {
  key: string;
  provider: string;
  metric: string;
  value: number;
  threshold: number;
  active: boolean;
  message: string;
  lastTriggeredAt: string | null;
};

export type MonitoringSnapshot = {
  settings: UsageAlertSettings;
  emailConfigured: boolean;
  month: {
    openaiEstimatedCostUsd: number;
    googlePlacesCalls: number;
    googleRoutesCalls: number;
    blockedRequests: number;
    googlePlacesQualityIssues: number;
    googleRoutesQualityIssues: number;
  };
  alerts: UsageAlert[];
  errors: {
    last24Hours: number;
    critical: number;
    recent: Array<{
      id: string;
      source: string;
      severity: string;
      route: string;
      message: string;
      errorName: string;
      requestId: string;
      createdAt: string | null;
    }>;
  };
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function safeText(value: unknown, max: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function redact(value: unknown, max: number) {
  return safeText(value, max)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|secret|password|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]");
}

function settingsFromRow(row: Record<string, unknown> | undefined): UsageAlertSettings {
  return {
    enabled: row?.enabled === undefined ? DEFAULT_USAGE_ALERT_SETTINGS.enabled : Boolean(row.enabled),
    openaiMonthlyCostUsd: Math.max(0.01, numberValue(row?.openai_monthly_cost_usd, DEFAULT_USAGE_ALERT_SETTINGS.openaiMonthlyCostUsd)),
    googlePlacesMonthlyCalls: Math.max(1, Math.round(numberValue(row?.google_places_monthly_calls, DEFAULT_USAGE_ALERT_SETTINGS.googlePlacesMonthlyCalls))),
    googleRoutesMonthlyCalls: Math.max(1, Math.round(numberValue(row?.google_routes_monthly_calls, DEFAULT_USAGE_ALERT_SETTINGS.googleRoutesMonthlyCalls))),
    blockedRequestsThreshold: Math.max(1, Math.round(numberValue(row?.blocked_requests_threshold, DEFAULT_USAGE_ALERT_SETTINGS.blockedRequestsThreshold))),
    googlePlacesQualityIssuesThreshold: Math.max(1, Math.round(numberValue(row?.google_places_quality_issues_threshold, DEFAULT_USAGE_ALERT_SETTINGS.googlePlacesQualityIssuesThreshold))),
    googleRoutesQualityIssuesThreshold: Math.max(1, Math.round(numberValue(row?.google_routes_quality_issues_threshold, DEFAULT_USAGE_ALERT_SETTINGS.googleRoutesQualityIssuesThreshold))),
  };
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

async function adminAlertRecipients() {
  const configured = (process.env.ADMIN_ALERT_EMAIL || "")
    .split(/[;,]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
  if (configured.length) return configured;
  if (!sql) return [];
  const rows = await sql.query(`
    SELECT email
    FROM rental_users
    WHERE role = 'admin' AND email_verified_at IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 10
  `);
  return rows.map((row) => safeText((row as Record<string, unknown>).email, 320).toLowerCase()).filter(Boolean);
}

function buildAlerts(settings: UsageAlertSettings, month: MonitoringSnapshot["month"], lastTriggered: Map<string, string | null>) {
  const checks = [
    {
      key: "openai_monthly_cost",
      provider: "OpenAI",
      metric: "Monthly estimated cost",
      value: month.openaiEstimatedCostUsd,
      threshold: settings.openaiMonthlyCostUsd,
      message: `OpenAI monthly estimated cost is $${month.openaiEstimatedCostUsd.toFixed(2)}; threshold is $${settings.openaiMonthlyCostUsd.toFixed(2)}.`,
    },
    {
      key: "google_places_monthly_calls",
      provider: "Google Maps",
      metric: "Monthly Places calls",
      value: month.googlePlacesCalls,
      threshold: settings.googlePlacesMonthlyCalls,
      message: `Google Places monthly calls are ${Math.round(month.googlePlacesCalls).toLocaleString("en-US")}; threshold is ${settings.googlePlacesMonthlyCalls.toLocaleString("en-US")}.`,
    },
    {
      key: "google_routes_monthly_calls",
      provider: "Google Maps",
      metric: "Monthly Routes calls",
      value: month.googleRoutesCalls,
      threshold: settings.googleRoutesMonthlyCalls,
      message: `Google Routes monthly calls are ${Math.round(month.googleRoutesCalls).toLocaleString("en-US")}; threshold is ${settings.googleRoutesMonthlyCalls.toLocaleString("en-US")}.`,
    },
    {
      key: "blocked_requests_monthly",
      provider: "Application rate limits",
      metric: "Monthly blocked requests",
      value: month.blockedRequests,
      threshold: settings.blockedRequestsThreshold,
      message: `Application rate limits blocked ${Math.round(month.blockedRequests).toLocaleString("en-US")} requests this month; threshold is ${settings.blockedRequestsThreshold.toLocaleString("en-US")}.`,
    },
    {
      key: "google_places_quality_issues",
      provider: "Google Maps",
      metric: "Places missing / rejected results",
      value: month.googlePlacesQualityIssues,
      threshold: settings.googlePlacesQualityIssuesThreshold,
      message: `Google Places recorded ${Math.round(month.googlePlacesQualityIssues).toLocaleString("en-US")} missing or rejected results this month; threshold is ${settings.googlePlacesQualityIssuesThreshold.toLocaleString("en-US")}.`,
    },
    {
      key: "google_routes_quality_issues",
      provider: "Google Maps",
      metric: "Routes missing / rejected results",
      value: month.googleRoutesQualityIssues,
      threshold: settings.googleRoutesQualityIssuesThreshold,
      message: `Google Routes recorded ${Math.round(month.googleRoutesQualityIssues).toLocaleString("en-US")} missing or rejected results this month; threshold is ${settings.googleRoutesQualityIssuesThreshold.toLocaleString("en-US")}.`,
    },
  ];
  return checks.map((check) => ({ ...check, active: check.value >= check.threshold, lastTriggeredAt: lastTriggered.get(check.key) || null }));
}

export async function recordApplicationError(input: {
  source: string;
  severity?: "error" | "warning" | "critical";
  route?: string;
  method?: string;
  message: string;
  errorName?: string;
  stack?: string;
  requestId?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!sql) return;
  await ensureDatabaseSchema();
  await sql.query(`
    INSERT INTO rental_error_events (
      id, source, severity, route, method, message, error_name, stack,
      request_id, user_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
  `, [
    randomUUID(),
    redact(input.source, 80) || "application",
    input.severity || "error",
    redact(input.route, 180),
    redact(input.method, 16),
    redact(input.message, 1_200) || "Unknown application error",
    redact(input.errorName, 160),
    redact(input.stack, 4_000),
    redact(input.requestId, 240),
    input.userId || null,
    JSON.stringify(input.metadata || {}),
  ]);
}

export async function recordApplicationErrorSafely(input: Parameters<typeof recordApplicationError>[0]) {
  try {
    await recordApplicationError(input);
  } catch (error) {
    console.error("[monitoring] application error could not be recorded", error);
  }
}

export async function recordLocationQualityEvent(input: {
  lookupKind?: string;
  placesCalls: number;
  routeCalls: number;
  placesQualityIssues: number;
  routesQualityIssues: number;
  rejectionReasons?: string[];
  metadata?: Record<string, unknown>;
}) {
  if (!sql) return;
  await ensureDatabaseSchema();
  await sql.query(`
    INSERT INTO rental_location_quality_events (
      id, lookup_kind, places_calls, route_calls, places_quality_issues,
      routes_quality_issues, rejection_reasons, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
  `, [
    randomUUID(),
    safeText(input.lookupKind, 80) || "location-context",
    Math.max(0, Math.round(input.placesCalls)),
    Math.max(0, Math.round(input.routeCalls)),
    Math.max(0, Math.round(input.placesQualityIssues)),
    Math.max(0, Math.round(input.routesQualityIssues)),
    JSON.stringify((input.rejectionReasons || []).filter(Boolean).slice(0, 12)),
    JSON.stringify(input.metadata || {}),
  ]);
}

export async function recordLocationQualityEventSafely(input: Parameters<typeof recordLocationQualityEvent>[0]) {
  try {
    await recordLocationQualityEvent(input);
  } catch (error) {
    console.error("[monitoring] location quality event could not be recorded", error);
  }
}

export async function getUsageMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureDatabaseSchema();
  const [settingsRows, monthRows, blockedRows, qualityRows, errorTotalsRows, errorRows, alertRows, recipients] = await Promise.all([
    sql.query("SELECT enabled, openai_monthly_cost_usd, google_places_monthly_calls, google_routes_monthly_calls, blocked_requests_threshold, google_places_quality_issues_threshold, google_routes_quality_issues_threshold FROM rental_usage_alert_settings WHERE id = 'default' LIMIT 1"),
    sql.query(`
      SELECT
        COALESCE(SUM(CASE WHEN provider = 'openai' THEN estimated_cost_usd ELSE 0 END), 0)::numeric AS openai_cost,
        COALESCE(SUM(CASE WHEN provider = 'google_maps' THEN places_calls ELSE 0 END), 0)::bigint AS places_calls,
        COALESCE(SUM(CASE WHEN provider = 'google_maps' THEN route_calls ELSE 0 END), 0)::bigint AS route_calls
      FROM rental_api_usage
      WHERE created_at >= date_trunc('month', NOW())
    `),
    sql.query(`
      SELECT COALESCE(SUM(blocked_count), 0)::bigint AS blocked_requests
      FROM rental_rate_limits
      WHERE updated_at >= date_trunc('month', NOW())
    `),
    sql.query(`
      SELECT
        COALESCE(SUM(places_quality_issues), 0)::bigint AS places_quality_issues,
        COALESCE(SUM(routes_quality_issues), 0)::bigint AS routes_quality_issues
      FROM rental_location_quality_events
      WHERE created_at >= date_trunc('month', NOW())
    `),
    sql.query(`
      SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24_hours,
             COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical
      FROM rental_error_events
    `),
    sql.query(`
      SELECT id, source, severity, route, message, error_name, request_id, created_at
      FROM rental_error_events
      ORDER BY created_at DESC
      LIMIT 20
    `),
    sql.query(`
      SELECT alert_key, MAX(created_at) AS created_at
      FROM rental_usage_alert_events
      WHERE period_key = $1
      GROUP BY alert_key
    `, [monthKey()]),
    adminAlertRecipients(),
  ]);
  const settings = settingsFromRow(settingsRows[0] as Record<string, unknown> | undefined);
  const monthRow = monthRows[0] as Record<string, unknown> | undefined;
  const blockedRow = blockedRows[0] as Record<string, unknown> | undefined;
  const qualityRow = qualityRows[0] as Record<string, unknown> | undefined;
  const month = {
    openaiEstimatedCostUsd: numberValue(monthRow?.openai_cost),
    googlePlacesCalls: numberValue(monthRow?.places_calls),
    googleRoutesCalls: numberValue(monthRow?.route_calls),
    blockedRequests: numberValue(blockedRow?.blocked_requests),
    googlePlacesQualityIssues: numberValue(qualityRow?.places_quality_issues),
    googleRoutesQualityIssues: numberValue(qualityRow?.routes_quality_issues),
  };
  const lastTriggered = new Map(alertRows.map((row) => [String((row as Record<string, unknown>).alert_key || ""), dateValue((row as Record<string, unknown>).created_at)]));
  const errorTotals = errorTotalsRows[0] as Record<string, unknown> | undefined;
  return {
    settings,
    emailConfigured: emailIsConfigured() && recipients.length > 0,
    month,
    alerts: buildAlerts(settings, month, lastTriggered),
    errors: {
      last24Hours: numberValue(errorTotals?.last_24_hours),
      critical: numberValue(errorTotals?.critical),
      recent: errorRows.map((row) => {
        const value = row as Record<string, unknown>;
        return {
          id: String(value.id || ""),
          source: String(value.source || "application"),
          severity: String(value.severity || "error"),
          route: String(value.route || ""),
          message: String(value.message || "Unknown application error"),
          errorName: String(value.error_name || ""),
          requestId: String(value.request_id || ""),
          createdAt: dateValue(value.created_at),
        };
      }),
    },
  };
}

export async function updateUsageAlertSettings(input: UsageAlertSettings, updatedBy: string) {
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureDatabaseSchema();
  await sql.query(`
    INSERT INTO rental_usage_alert_settings (
      id, enabled, openai_monthly_cost_usd, google_places_monthly_calls,
      google_routes_monthly_calls, blocked_requests_threshold,
      google_places_quality_issues_threshold, google_routes_quality_issues_threshold,
      updated_by, updated_at
    ) VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      openai_monthly_cost_usd = EXCLUDED.openai_monthly_cost_usd,
      google_places_monthly_calls = EXCLUDED.google_places_monthly_calls,
      google_routes_monthly_calls = EXCLUDED.google_routes_monthly_calls,
      blocked_requests_threshold = EXCLUDED.blocked_requests_threshold,
      google_places_quality_issues_threshold = EXCLUDED.google_places_quality_issues_threshold,
      google_routes_quality_issues_threshold = EXCLUDED.google_routes_quality_issues_threshold,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `, [input.enabled, input.openaiMonthlyCostUsd, input.googlePlacesMonthlyCalls, input.googleRoutesMonthlyCalls, input.blockedRequestsThreshold, input.googlePlacesQualityIssuesThreshold, input.googleRoutesQualityIssuesThreshold, updatedBy]);
}

export async function evaluateUsageAlerts() {
  if (!sql) return;
  try {
    const snapshot = await getUsageMonitoringSnapshot();
    if (!snapshot.settings.enabled) return;
    const period = monthKey();
    const recipients = await adminAlertRecipients();
    for (const alert of snapshot.alerts.filter((item) => item.active)) {
      const inserted = await sql.query(`
        INSERT INTO rental_usage_alert_events (
          id, alert_key, period_key, provider, metric, value, threshold, status, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'recorded', $8)
        ON CONFLICT (alert_key, period_key) DO NOTHING
        RETURNING id
      `, [randomUUID(), alert.key, period, alert.provider, alert.metric, alert.value, alert.threshold, alert.message]);
      if (!inserted[0]) continue;
      let status = "recorded";
      let sentAt: string | null = null;
      if (emailIsConfigured() && recipients.length > 0) {
        try {
          await sendUsageAlertEmail({ recipients, provider: alert.provider, metric: alert.metric, message: alert.message, period });
          status = "sent";
          sentAt = new Date().toISOString();
        } catch (error) {
          status = "failed";
          console.error("[monitoring] usage alert email failed", error);
        }
      }
      await sql.query("UPDATE rental_usage_alert_events SET status = $1, sent_at = $2, updated_at = NOW() WHERE id = $3", [status, sentAt, inserted[0].id]);
    }
  } catch (error) {
    console.error("[monitoring] usage alert evaluation failed", error);
  }
}

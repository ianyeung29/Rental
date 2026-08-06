import { sql } from "./db";

export type NotificationPreferenceKey = "saved_search_alerts" | "inquiry_alerts" | "listing_expiration_alerts" | "agent_response_alerts";

export type NotificationPreferences = {
  emailEnabled: boolean;
  savedSearchAlerts: boolean;
  inquiryAlerts: boolean;
  listingExpirationAlerts: boolean;
  agentResponseAlerts: boolean;
  pushEnabled: boolean;
  updatedAt: string | null;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  savedSearchAlerts: true,
  inquiryAlerts: true,
  listingExpirationAlerts: true,
  agentResponseAlerts: true,
  pushEnabled: false,
  updatedAt: null,
};

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value ? value : null;
}

export function preferencesFromRow(row?: Record<string, unknown>): NotificationPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    emailEnabled: row.email_enabled !== false,
    savedSearchAlerts: row.saved_search_alerts !== false,
    inquiryAlerts: row.inquiry_alerts !== false,
    listingExpirationAlerts: row.listing_expiration_alerts !== false,
    agentResponseAlerts: row.agent_response_alerts !== false,
    pushEnabled: row.push_enabled === true,
    updatedAt: iso(row.updated_at),
  };
}

export async function emailAlertsAllowed(userId: string, category: NotificationPreferenceKey) {
  if (!sql || !userId) return false;
  const rows = await sql.query(`
    SELECT email_enabled, ${category}
    FROM rental_notification_preferences
    WHERE user_id = $1
    LIMIT 1
  `, [userId]);
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? row.email_enabled !== false && row[category] !== false : true;
}

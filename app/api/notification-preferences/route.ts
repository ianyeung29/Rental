import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { preferencesFromRow } from "../../lib/notification-preferences";

const BOOLEAN_KEYS = new Set(["emailEnabled", "savedSearchAlerts", "inquiryAlerts", "listingExpirationAlerts", "agentResponseAlerts"]);
const COLUMN_BY_KEY = {
  emailEnabled: "email_enabled",
  savedSearchAlerts: "saved_search_alerts",
  inquiryAlerts: "inquiry_alerts",
  listingExpirationAlerts: "listing_expiration_alerts",
  agentResponseAlerts: "agent_response_alerts",
} as const;

async function verifiedUser() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage notification preferences." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before managing notification preferences." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

export async function GET() {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query("SELECT email_enabled, saved_search_alerts, inquiry_alerts, listing_expiration_alerts, agent_response_alerts, updated_at FROM rental_notification_preferences WHERE user_id = $1 LIMIT 1", [result.user.id]);
    if (rows.length === 0) {
      const inserted = await sql!.query(`
        INSERT INTO rental_notification_preferences (user_id)
        VALUES ($1)
        RETURNING email_enabled, saved_search_alerts, inquiry_alerts, listing_expiration_alerts, agent_response_alerts, updated_at
      `, [result.user.id]);
      return NextResponse.json(preferencesFromRow(inserted[0] as Record<string, unknown>));
    }
    return NextResponse.json(preferencesFromRow(rows[0] as Record<string, unknown>));
  } catch {
    return NextResponse.json({ error: "Notification preferences could not be loaded right now." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updates = Object.entries(body).filter(([key, value]) => BOOLEAN_KEYS.has(key) && typeof value === "boolean") as Array<[keyof typeof COLUMN_BY_KEY, boolean]>;
  if (updates.length === 0) return NextResponse.json({ error: "Choose at least one notification preference." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const columns = updates.map(([key]) => `${COLUMN_BY_KEY[key]} = $${updates.findIndex(([candidate]) => candidate === key) + 2}`).join(", ");
    const values = updates.map(([, value]) => value);
    const rows = await sql!.query(`
      INSERT INTO rental_notification_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO UPDATE SET ${columns}, updated_at = NOW()
      RETURNING email_enabled, saved_search_alerts, inquiry_alerts, listing_expiration_alerts, agent_response_alerts, updated_at
    `, [result.user.id, ...values]);
    return NextResponse.json(preferencesFromRow(rows[0] as Record<string, unknown>));
  } catch {
    return NextResponse.json({ error: "Notification preferences could not be saved right now." }, { status: 502 });
  }
}

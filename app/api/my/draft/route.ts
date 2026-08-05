import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

const MAX_BODY_LENGTH = 28_000;
const DRAFT_FIELDS = [
  "titleEn", "titleZh", "areaEn", "areaZh", "areaGroupId", "areaLocationId", "privateAddress", "posterRole", "rentalType", "price", "currency",
  "bedrooms", "bathrooms", "moveInMode", "moveInDate", "lease", "features", "descriptionEn", "descriptionZh",
  "photos", "photoKeys", "contactName", "contactEmail", "tourPreference", "agentService", "agentFeePlan", "agentFeeAmount", "agentProfileId", "expiresOn",
] as const;

async function verifiedUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to sync your draft." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before syncing your draft." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function draftFromValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const draft: Record<string, unknown> = {};
  for (const field of DRAFT_FIELDS) {
    const fieldValue = source[field];
    if (field === "features" || field === "photos" || field === "photoKeys") {
      draft[field] = Array.isArray(fieldValue)
        ? fieldValue.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 2_000)).filter(Boolean).slice(0, 20)
        : [];
    } else if (fieldValue !== undefined) {
      draft[field] = text(fieldValue, field === "privateAddress" ? 500 : field === "descriptionZh" || field === "descriptionEn" ? 2_500 : 240);
    }
  }
  draft.currency = "USD";
  return draft;
}

function payloadFromRow(row: Record<string, unknown>) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
  return {
    draft: payload.draft && typeof payload.draft === "object" ? payload.draft : null,
    editingListingId: typeof payload.editingListingId === "string" ? payload.editingListingId : null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

export async function GET() {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    await ensureDatabaseSchema();
    const rows = await sql!.query("SELECT payload, updated_at FROM rental_listing_drafts WHERE user_id = $1 LIMIT 1", [result.user.id]);
    return NextResponse.json(rows[0] ? payloadFromRow(rows[0] as Record<string, unknown>) : null);
  } catch {
    return NextResponse.json({ error: "Your draft could not be loaded right now." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Draft is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const draft = draftFromValue(body.draft);
    if (!draft) return NextResponse.json({ error: "Send a valid draft." }, { status: 400 });
    const editingListingId = text(body.editingListingId, 160) || null;
    const payload = JSON.stringify({ draft, editingListingId });
    await ensureDatabaseSchema();
    const rows = await sql!.query(`
      INSERT INTO rental_listing_drafts (user_id, payload)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (user_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      RETURNING payload, updated_at
    `, [result.user.id, payload]);
    return NextResponse.json(rows[0] ? payloadFromRow(rows[0] as Record<string, unknown>) : { draft, editingListingId });
  } catch {
    return NextResponse.json({ error: "Your draft could not be saved right now." }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    await ensureDatabaseSchema();
    await sql!.query("DELETE FROM rental_listing_drafts WHERE user_id = $1", [result.user.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Your draft could not be cleared right now." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

const MAX_BODY_LENGTH = 4_000;
const MAX_LISTINGS = 100;

async function verifiedUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to sync saved listings." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before syncing saved listings." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function listingIdsFromBody(body: Record<string, unknown>) {
  const values = Array.isArray(body.listingIds) ? body.listingIds : [body.listingId];
  return [...new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().slice(0, 160))
    .filter(Boolean))].slice(0, MAX_LISTINGS);
}

export async function GET() {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    await ensureDatabaseSchema();
    const rows = await sql!.query(
      "SELECT listing_id FROM rental_saved_listings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [result.user.id, MAX_LISTINGS],
    );
    return NextResponse.json({ listingIds: rows.map((row) => String((row as Record<string, unknown>).listing_id)) });
  } catch {
    return NextResponse.json({ error: "Saved listings could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Saved listings payload is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const listingIds = listingIdsFromBody(body);
    if (listingIds.length === 0) return NextResponse.json({ listingIds: [] });
    await ensureDatabaseSchema();
    await sql!.query(`
      INSERT INTO rental_saved_listings (user_id, listing_id)
      SELECT $1, listing_id
      FROM unnest($2::text[]) AS listing_ids(listing_id)
      JOIN rental_listings l ON l.id = listing_ids.listing_id
      ON CONFLICT (user_id, listing_id) DO NOTHING
    `, [result.user.id, listingIds]);
    const rows = await sql!.query(
      "SELECT listing_id FROM rental_saved_listings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [result.user.id, MAX_LISTINGS],
    );
    return NextResponse.json({ listingIds: rows.map((row) => String((row as Record<string, unknown>).listing_id)) });
  } catch {
    return NextResponse.json({ error: "Saved listings could not be saved right now." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    const listingId = new URL(request.url).searchParams.get("listingId")?.trim().slice(0, 160) || "";
    if (!listingId) return NextResponse.json({ error: "Choose a listing to remove." }, { status: 400 });
    await ensureDatabaseSchema();
    await sql!.query("DELETE FROM rental_saved_listings WHERE user_id = $1 AND listing_id = $2", [result.user.id, listingId]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Saved listing could not be removed right now." }, { status: 502 });
  }
}

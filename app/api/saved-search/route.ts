import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

const MAX_BODY_LENGTH = 2_000;
const ALLOWED_RENTAL_TYPES = new Set(["all", "entire", "privateRoom", "sublet"]);
const ALLOWED_SORT_MODES = new Set(["fit", "price", "fresh", "moveIn", "verified"]);
const ALLOWED_MOVE_IN = new Set(["", "august", "september", "october"]);
const ALLOWED_BEDROOMS = new Set(["", "0", "1", "2", "3+"]);
const ALLOWED_BATHROOMS = new Set(["", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"]);
const ALLOWED_FEATURES = new Set([
  "furnished",
  "utilities",
  "parking",
  "pets",
  "laundry",
  "inUnitLaundry",
  "airConditioning",
  "dishwasher",
  "balcony",
  "elevator",
  "gym",
  "doorman",
  "storage",
  "naturalLight",
  "privateEntrance",
  "privateBathroom",
  "walkInCloset",
  "hardwoodFloors",
  "packageRoom",
  "roofDeck",
  "nearTransit",
  "shortTerm",
]);
const ALLOWED_ALERT_FREQUENCIES = new Set(["off", "daily"]);

function snapshotFromRow(row: Record<string, unknown>) {
  return {
    label: String(row.label || "我的搜索"),
    location: String(row.location || ""),
    minPrice: row.min_price === null || row.min_price === undefined ? "" : String(row.min_price),
    maxPrice: row.max_price === null || row.max_price === undefined ? "" : String(row.max_price),
    minSqft: row.min_sqft === null || row.min_sqft === undefined ? "" : String(row.min_sqft),
    maxSqft: row.max_sqft === null || row.max_sqft === undefined ? "" : String(row.max_sqft),
    bedrooms: String(row.bedrooms || ""),
    bathrooms: String(row.bathrooms || ""),
    rentalType: String(row.rental_type || "all"),
    moveIn: String(row.move_in || ""),
    activeFeatures: Array.isArray(row.features) ? row.features.filter((feature): feature is string => typeof feature === "string") : [],
    sortMode: String(row.sort_mode || "fit"),
    alertFrequency: String(row.alert_frequency || "off"),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

function normalizeSnapshot(body: Record<string, unknown>) {
  const location = typeof body.location === "string" ? body.location.trim().slice(0, 180) : "";
  const minPriceValue = typeof body.minPrice === "string" || typeof body.minPrice === "number" ? String(body.minPrice).trim() : "";
  const minPrice = minPriceValue && Number.isFinite(Number(minPriceValue)) && Number(minPriceValue) > 0 ? minPriceValue : "";
  const maxPriceValue = typeof body.maxPrice === "string" || typeof body.maxPrice === "number" ? String(body.maxPrice).trim() : "";
  const maxPrice = maxPriceValue && Number.isFinite(Number(maxPriceValue)) && Number(maxPriceValue) > 0 ? maxPriceValue : "";
  const minSqftValue = typeof body.minSqft === "string" || typeof body.minSqft === "number" ? String(body.minSqft).trim() : "";
  const minSqft = minSqftValue && Number.isInteger(Number(minSqftValue)) && Number(minSqftValue) > 0 ? minSqftValue : "";
  const maxSqftValue = typeof body.maxSqft === "string" || typeof body.maxSqft === "number" ? String(body.maxSqft).trim() : "";
  const maxSqft = maxSqftValue && Number.isInteger(Number(maxSqftValue)) && Number(maxSqftValue) > 0 ? maxSqftValue : "";
  const bedrooms = typeof body.bedrooms === "string" && ALLOWED_BEDROOMS.has(body.bedrooms) ? body.bedrooms : "";
  const bathrooms = typeof body.bathrooms === "string" && ALLOWED_BATHROOMS.has(body.bathrooms) ? body.bathrooms : "";
  const rentalType = typeof body.rentalType === "string" && ALLOWED_RENTAL_TYPES.has(body.rentalType) ? body.rentalType : "all";
  const moveIn = typeof body.moveIn === "string" && ALLOWED_MOVE_IN.has(body.moveIn) ? body.moveIn : "";
  const activeFeatures = Array.isArray(body.activeFeatures)
    ? body.activeFeatures.filter((feature): feature is string => typeof feature === "string" && ALLOWED_FEATURES.has(feature)).slice(0, 20)
    : [];
  const sortMode = typeof body.sortMode === "string" && ALLOWED_SORT_MODES.has(body.sortMode) ? body.sortMode : "fit";
  const alertFrequency = typeof body.alertFrequency === "string" && ALLOWED_ALERT_FREQUENCIES.has(body.alertFrequency) ? body.alertFrequency : "off";
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : "我的搜索";
  return { label, location, minPrice, maxPrice, minSqft, maxSqft, bedrooms, bathrooms, rentalType, moveIn, activeFeatures, sortMode, alertFrequency };
}

async function verifiedUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to sync saved searches." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before syncing saved searches." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

export async function GET() {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    await ensureDatabaseSchema();
    const rows = await sql!.query("SELECT label, location, min_price, max_price, min_sqft, max_sqft, bedrooms, bathrooms, rental_type, move_in, features, sort_mode, alert_frequency, updated_at FROM rental_saved_searches WHERE user_id = $1 LIMIT 1", [result.user.id]);
    return NextResponse.json(rows[0] ? snapshotFromRow(rows[0] as Record<string, unknown>) : null);
  } catch {
    return NextResponse.json({ error: "Saved search could not be loaded right now." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Saved search is too large." }, { status: 413 });
    const snapshot = normalizeSnapshot(JSON.parse(rawBody) as Record<string, unknown>);
    await ensureDatabaseSchema();
    const rows = await sql!.query(`
      INSERT INTO rental_saved_searches (user_id, label, location, min_price, max_price, min_sqft, max_sqft, bedrooms, bathrooms, rental_type, move_in, features, sort_mode, alert_frequency)
      VALUES ($1, $2, $3, NULLIF($4, '')::numeric, NULLIF($5, '')::numeric, NULLIF($6, '')::integer, NULLIF($7, '')::integer, $8, $9, $10, $11, $12::jsonb, $13, $14)
      ON CONFLICT (user_id) DO UPDATE SET
        label = EXCLUDED.label,
        location = EXCLUDED.location,
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        min_sqft = EXCLUDED.min_sqft,
        max_sqft = EXCLUDED.max_sqft,
        bedrooms = EXCLUDED.bedrooms,
        bathrooms = EXCLUDED.bathrooms,
        rental_type = EXCLUDED.rental_type,
        move_in = EXCLUDED.move_in,
        features = EXCLUDED.features,
        sort_mode = EXCLUDED.sort_mode,
        alert_frequency = EXCLUDED.alert_frequency,
        updated_at = NOW()
      RETURNING label, location, min_price, max_price, min_sqft, max_sqft, bedrooms, bathrooms, rental_type, move_in, features, sort_mode, alert_frequency, updated_at
    `, [result.user.id, snapshot.label, snapshot.location, snapshot.minPrice, snapshot.maxPrice, snapshot.minSqft, snapshot.maxSqft, snapshot.bedrooms, snapshot.bathrooms, snapshot.rentalType, snapshot.moveIn, JSON.stringify(snapshot.activeFeatures), snapshot.sortMode, snapshot.alertFrequency]);
    return NextResponse.json(rows[0] ? snapshotFromRow(rows[0] as Record<string, unknown>) : snapshot);
  } catch {
    return NextResponse.json({ error: "Saved search could not be saved right now." }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    const result = await verifiedUser();
    if (result.error) return result.error;
    await ensureDatabaseSchema();
    await sql!.query("DELETE FROM rental_saved_searches WHERE user_id = $1", [result.user.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Saved search could not be removed right now." }, { status: 502 });
  }
}

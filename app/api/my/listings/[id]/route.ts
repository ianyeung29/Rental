import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { publicUrlForKey } from "../../../../lib/r2";
import { listingSafetyError } from "../../../../lib/safety";

const MAX_BODY_LENGTH = 32_000;
const MAX_TEXT_LENGTH = 2_500;
const ALLOWED_RENTAL_TYPES = new Set(["entire", "privateRoom", "sublet"]);
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
]);
const FEATURE_LABELS: Record<string, [string, string]> = {
  furnished: ["家具齐全", "Furnished"],
  utilities: ["部分费用包含", "Utilities included"],
  parking: ["停车位可询", "Parking available"],
  pets: ["可养宠物", "Pets considered"],
  laundry: ["楼内洗衣房", "Laundry in building"],
  inUnitLaundry: ["室内洗衣机", "In-unit laundry"],
  airConditioning: ["空调", "Air conditioning"],
  dishwasher: ["洗碗机", "Dishwasher"],
  balcony: ["阳台 / 露台", "Balcony / terrace"],
  elevator: ["电梯", "Elevator"],
  gym: ["健身房", "Gym"],
  doorman: ["门卫 / 前台", "Doorman / front desk"],
  storage: ["储物空间", "Storage"],
};

type ListingBody = {
  status?: unknown;
  titleZh?: unknown;
  titleEn?: unknown;
  areaZh?: unknown;
  areaEn?: unknown;
  privateAddress?: unknown;
  posterRole?: unknown;
  rentalType?: unknown;
  price?: unknown;
  currency?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  moveIn?: unknown;
  lease?: unknown;
  features?: unknown;
  descriptionZh?: unknown;
  descriptionEn?: unknown;
  tourPreference?: unknown;
  media?: unknown;
};

type NormalizedMedia = { key: string; contentType: string; publicUrl: string; sortOrder: number };

function text(value: unknown, max = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && ALLOWED_FEATURES.has(item))
    .slice(0, 20);
}

function mediaList(value: unknown): NormalizedMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { key?: unknown; contentType?: unknown };
    const key = text(record.key, 240);
    const contentType = text(record.contentType, 80);
    if (!key.startsWith("listings/") || !/^image\/(jpeg|png|webp)$/.test(contentType)) return [];
    return [{ key, contentType, publicUrl: publicUrlForKey(key), sortOrder: index }];
  }).slice(0, 4);
}

function normalizeBody(body: ListingBody) {
  const features = stringList(body.features);
  const leaseMonths = Number(body.lease);
  return {
    titleZh: text(body.titleZh, 180),
    titleEn: text(body.titleEn, 180) || text(body.titleZh, 180),
    areaZh: text(body.areaZh, 180),
    areaEn: text(body.areaEn, 180) || text(body.areaZh, 180),
    privateAddress: text(body.privateAddress, 500),
    posterRole: body.posterRole === "agent" ? "agent" : "owner",
    rentalType: text(body.rentalType, 40),
    price: Number(body.price),
    bedrooms: text(body.bedrooms, 20) || "1",
    bathrooms: text(body.bathrooms, 20) || "1",
    moveIn: text(body.moveIn, 80) || "immediate",
    leaseMonths,
    lease: `${leaseMonths} months`,
    features,
    tagsZh: features.map((feature) => FEATURE_LABELS[feature][0]),
    tagsEn: features.map((feature) => FEATURE_LABELS[feature][1]),
    descriptionZh: text(body.descriptionZh),
    descriptionEn: text(body.descriptionEn) || text(body.descriptionZh),
    tourPreference: text(body.tourPreference, 40) || "flexible",
    media: mediaList(body.media),
  };
}

function validationError(input: ReturnType<typeof normalizeBody>) {
  if (!input.titleZh || !input.areaZh || !input.privateAddress) return "Complete the title, approximate area, and private address.";
  if (!ALLOWED_RENTAL_TYPES.has(input.rentalType) || !Number.isFinite(input.price) || input.price <= 0) return "Use a valid rental type and positive USD price.";
  if (!Number.isInteger(input.leaseMonths) || input.leaseMonths <= 0 || input.leaseMonths > 120) return "Use a lease term between 1 and 120 months.";
  if (input.moveIn !== "immediate" && !/^\d{4}-\d{2}-\d{2}$/.test(input.moveIn)) return "Choose immediate move-in or a valid move-in date.";
  if (input.media.length === 0) return "Keep at least one listing image.";
  return "";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to manage your listing." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before managing listings." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const { id } = await context.params;

  let body: ListingBody;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Listing payload is too large." }, { status: 413 });
    body = JSON.parse(rawBody) as ListingBody;
  } catch {
    return NextResponse.json({ error: "Please send a valid listing update." }, { status: 400 });
  }

  if (body.status === "published" || body.status === "unpublished") {
    try {
      await ensureDatabaseSchema();
      const result = await sql.query(
        "UPDATE rental_listings SET status = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING id, status",
        [body.status, id, user.id],
      );
      if (result.length === 0) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      return NextResponse.json({ id, status: body.status });
    } catch {
      return NextResponse.json({ error: "The listing status could not be updated." }, { status: 502 });
    }
  }

  let input: ReturnType<typeof normalizeBody>;
  try {
    input = normalizeBody(body);
  } catch {
    return NextResponse.json({ error: "R2 storage is not configured on the server yet." }, { status: 503 });
  }
  const validation = validationError(input);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  const safetyError = listingSafetyError([input.titleZh, input.titleEn, input.descriptionZh, input.descriptionEn]);
  if (safetyError) return NextResponse.json({ error: safetyError }, { status: 400 });

  try {
    await ensureDatabaseSchema();
    const ownedRows = await sql.query("SELECT id FROM rental_listings WHERE id = $1 AND owner_id = $2 LIMIT 1", [id, user.id]);
    if (ownedRows.length === 0) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    const result = await sql.transaction((tx) => [
      tx.query(`
        UPDATE rental_listings SET
          title_zh = $1, title_en = $2, area_zh = $3, area_en = $4, rental_type = $5,
          price = $6, currency = 'USD', bedrooms = $7, bathrooms = $8, move_in = $9,
          lease = $10, features = $11::jsonb, tags_zh = $12::jsonb, tags_en = $13::jsonb,
          description_zh = $14, description_en = $15, poster_role = $16, updated_at = NOW()
        WHERE id = $17 AND owner_id = $18
        RETURNING id, status
      `, [
        input.titleZh,
        input.titleEn,
        input.areaZh,
        input.areaEn,
        input.rentalType,
        input.price,
        input.bedrooms,
        input.bathrooms,
        input.moveIn,
        input.lease,
        JSON.stringify(input.features),
        JSON.stringify(input.tagsZh),
        JSON.stringify(input.tagsEn),
        input.descriptionZh,
        input.descriptionEn,
        input.posterRole,
        id,
        user.id,
      ]),
      tx.query(`
        UPDATE rental_listing_private_details
        SET private_address = $1, contact_name = $2, contact_email = $3, tour_preference = $4, updated_at = NOW()
        WHERE listing_id = $5
      `, [input.privateAddress, user.displayName, user.email, input.tourPreference, id]),
      tx.query("DELETE FROM rental_listing_media WHERE listing_id = $1", [id]),
      ...input.media.map((media) => tx.query(`
        INSERT INTO rental_listing_media (id, listing_id, object_key, public_url, content_type, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), id, media.key, media.publicUrl, media.contentType, media.sortOrder])),
    ]);
    const updated = result[0]?.[0] as { id?: unknown; status?: unknown } | undefined;
    if (!updated?.id) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    return NextResponse.json({ id, status: String(updated.status || "published") });
  } catch {
    return NextResponse.json({ error: "The listing could not be updated." }, { status: 502 });
  }
}

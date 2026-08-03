import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { publicUrlForKey } from "../../lib/r2";
import { getCurrentUser } from "../../lib/auth";
import { listingSafetyError } from "../../lib/safety";

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
  contactName?: unknown;
  contactEmail?: unknown;
  tourPreference?: unknown;
  media?: unknown;
};

type NormalizedMedia = { key: string; contentType: string; publicUrl: string; sortOrder: number };

function text(value: unknown, max = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, allowed?: Set<string>) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && (!allowed || allowed.has(item)))
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

function listingTypeLabels(type: string) {
  if (type === "privateRoom") return ["独立房间", "Private room"] as const;
  if (type === "sublet") return ["转租", "Sublet"] as const;
  return ["整套住房", "Entire home"] as const;
}

function toClientListing(row: Record<string, unknown>) {
  const media = Array.isArray(row.media) ? row.media : [];
  const photos = media.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const url = (item as { url?: unknown }).url;
    return typeof url === "string" && url ? [url] : [];
  });
  const features = stringList(row.features);
  const tagsZh = stringList(row.tags_zh);
  const tagsEn = stringList(row.tags_en);
  const [typeZh, typeEn] = listingTypeLabels(String(row.rental_type || "entire"));
  const role = row.poster_role === "agent" ? ["房产经纪", "Agent"] : ["房主", "Owner"];
  const isSample = row.is_sample === true;
  return {
    id: String(row.id),
    source: isSample ? "sample" as const : "remote" as const,
    titleZh: String(row.title_zh || ""),
    titleEn: String(row.title_en || ""),
    areaZh: String(row.area_zh || ""),
    areaEn: String(row.area_en || ""),
    type: String(row.rental_type || "entire"),
    typeZh,
    typeEn,
    price: Number(row.price || 0),
    currency: "USD" as const,
    bedrooms: String(row.bedrooms || ""),
    bathrooms: String(row.bathrooms || ""),
    moveIn: String(row.move_in || "immediate"),
    lease: String(row.lease || ""),
    image: photos[0] || "",
    photos,
    features,
    tagsZh,
    tagsEn,
    freshnessZh: isSample ? "示例房源 · 非真实库存" : "刚刚发布",
    freshnessEn: isSample ? "Synthetic sample · not real inventory" : "Published recently",
    posterZh: isSample ? "示例房源 · 仅用于体验" : `${role[0]} · 用户发布`,
    posterEn: isSample ? "Synthetic sample · for testing only" : `${role[1]} · user posted`,
    posterVerified: !isSample,
    privacyZh: "公开页面只显示大致区域",
    privacyEn: "Public page shows approximate area only",
    descriptionZh: String(row.description_zh || ""),
    descriptionEn: String(row.description_en || ""),
  };
}

function normalizeBody(body: ListingBody) {
  const titleZh = text(body.titleZh, 180);
  const titleEn = text(body.titleEn, 180) || titleZh;
  const areaZh = text(body.areaZh, 180);
  const areaEn = text(body.areaEn, 180) || areaZh;
  const privateAddress = text(body.privateAddress, 500);
  const posterRole = body.posterRole === "agent" ? "agent" : "owner";
  const rentalType = text(body.rentalType, 40);
  const price = Number(body.price);
  const currency = text(body.currency, 12);
  const bedrooms = text(body.bedrooms, 20) || "1";
  const bathrooms = text(body.bathrooms, 20) || "1";
  const moveIn = text(body.moveIn, 80) || "immediate";
  const leaseMonths = Number(body.lease);
  const features = stringList(body.features, ALLOWED_FEATURES);
  const descriptionZh = text(body.descriptionZh);
  const descriptionEn = text(body.descriptionEn) || descriptionZh;
  const contactName = text(body.contactName, 180);
  const contactEmail = text(body.contactEmail, 240).toLowerCase();
  const tourPreference = text(body.tourPreference, 40) || "flexible";
  const media = mediaList(body.media);
  return {
    titleZh,
    titleEn,
    areaZh,
    areaEn,
    privateAddress,
    posterRole,
    rentalType,
    price,
    currency,
    bedrooms,
    bathrooms,
    moveIn,
    leaseMonths,
    lease: `${leaseMonths} months`,
    features,
    tagsZh: features.map((feature) => FEATURE_LABELS[feature][0]),
    tagsEn: features.map((feature) => FEATURE_LABELS[feature][1]),
    descriptionZh,
    descriptionEn,
    contactName,
    contactEmail,
    tourPreference,
    media,
  };
}

function validateListing(input: ReturnType<typeof normalizeBody>) {
  if (!input.titleZh || !input.areaZh || !input.privateAddress || !input.contactName || !input.contactEmail.includes("@")) return "Complete the title, approximate area, private address, and contact email.";
  if (!ALLOWED_RENTAL_TYPES.has(input.rentalType) || input.currency !== "USD" || !Number.isFinite(input.price) || input.price <= 0) return "Use a valid rental type, USD rent, and positive price.";
  if (!Number.isInteger(input.leaseMonths) || input.leaseMonths <= 0 || input.leaseMonths > 120) return "Use a lease term between 1 and 120 months.";
  if (input.moveIn !== "immediate" && !/^\d{4}-\d{2}-\d{2}$/.test(input.moveIn)) return "Choose immediate move-in or a valid move-in date.";
  if (input.media.length === 0) return "Upload at least one image before publishing.";
  return "";
}

export async function GET() {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT
        l.id, l.title_zh, l.title_en, l.area_zh, l.area_en, l.rental_type,
        l.price, l.bedrooms, l.bathrooms, l.move_in, l.lease, l.features,
        l.tags_zh, l.tags_en, l.description_zh, l.description_en, l.poster_role, l.is_sample,
        COALESCE(
          jsonb_agg(jsonb_build_object('key', m.object_key, 'url', m.public_url) ORDER BY m.sort_order)
          FILTER (WHERE m.id IS NOT NULL),
          '[]'::jsonb
        ) AS media
      FROM rental_listings l
      LEFT JOIN rental_listing_media m ON m.listing_id = l.id
      WHERE l.status = 'published'
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);
    return NextResponse.json(rows.map((row) => toClientListing(row as Record<string, unknown>)));
  } catch {
    return NextResponse.json({ error: "Listings could not be loaded from the database." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before publishing a listing." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before publishing a listing." }, { status: 403 });
  let input: ReturnType<typeof normalizeBody>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Listing payload is too large." }, { status: 413 });
    input = normalizeBody(JSON.parse(rawBody) as ListingBody);
  } catch {
    return NextResponse.json({ error: "Please send a valid listing." }, { status: 400 });
  }
  input = { ...input, contactName: user.displayName, contactEmail: user.email };
  const validationError = validateListing(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const safetyError = listingSafetyError([input.titleZh, input.titleEn, input.descriptionZh, input.descriptionEn]);
  if (safetyError) return NextResponse.json({ error: safetyError }, { status: 400 });

  try {
    await ensureDatabaseSchema();
    const id = `listing-${randomUUID()}`;
    await sql.transaction((tx) => [
      tx.query(`
        INSERT INTO rental_listings (
          id, owner_id, title_zh, title_en, area_zh, area_en, rental_type, price, currency,
          bedrooms, bathrooms, move_in, lease, features, tags_zh, tags_en,
          description_zh, description_en, poster_role
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USD', $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18)
      `, [
        id,
        user.id,
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
      ]),
      tx.query(`
        INSERT INTO rental_listing_private_details (listing_id, private_address, contact_name, contact_email, tour_preference)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, input.privateAddress, user.displayName, user.email, input.tourPreference]),
      ...input.media.map((media) => tx.query(`
        INSERT INTO rental_listing_media (id, listing_id, object_key, public_url, content_type, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), id, media.key, media.publicUrl, media.contentType, media.sortOrder])),
    ]);

    const row = {
      id,
      title_zh: input.titleZh,
      title_en: input.titleEn,
      area_zh: input.areaZh,
      area_en: input.areaEn,
      rental_type: input.rentalType,
      price: input.price,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      move_in: input.moveIn,
      lease: input.lease,
      features: input.features,
      tags_zh: input.tagsZh,
      tags_en: input.tagsEn,
      description_zh: input.descriptionZh,
      description_en: input.descriptionEn,
      poster_role: input.posterRole,
      media: input.media.map((media) => ({ key: media.key, url: media.publicUrl })),
    };
    return NextResponse.json(toClientListing(row), { status: 201 });
  } catch {
    return NextResponse.json({ error: "The listing could not be saved to the database." }, { status: 502 });
  }
}

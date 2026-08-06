import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { publicUrlForKey } from "../../lib/r2";
import { getCurrentUser } from "../../lib/auth";
import { listingSafetyError } from "../../lib/safety";
import { emailIsConfigured, sendAgentRequestNotification } from "../../lib/email";
import { demoModeEnabled } from "../../lib/demo";
import { listingLimitFor } from "../../lib/account-types";

const MAX_BODY_LENGTH = 32_000;
const MAX_TEXT_LENGTH = 2_500;
const ALLOWED_RENTAL_TYPES = new Set(["entire", "privateRoom", "sublet"]);
const ALLOWED_BATHROOMS = new Set(["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"]);
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
const ALLOWED_AGENT_SERVICES = new Set(["selfManaged", "agentMatch"]);
const ALLOWED_AGENT_FEE_PLANS = new Set(["agentQuote", "firstMonthRent", "flatFee"]);
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
  naturalLight: ["采光好", "Great natural light"],
  privateEntrance: ["独立出入口", "Private entrance"],
  privateBathroom: ["独立卫生间", "Private bathroom"],
  walkInCloset: ["步入式衣帽间", "Walk-in closet"],
  hardwoodFloors: ["木地板", "Hardwood floors"],
  packageRoom: ["包裹室", "Package room"],
  roofDeck: ["屋顶露台", "Rooftop terrace"],
  nearTransit: ["近公共交通", "Near public transit"],
  shortTerm: ["短租可询", "Short-term lease possible"],
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
  squareFeet?: unknown;
  moveIn?: unknown;
  lease?: unknown;
  expiresOn?: unknown;
  features?: unknown;
  descriptionZh?: unknown;
  descriptionEn?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  tourPreference?: unknown;
  agentService?: unknown;
  agentFeePlan?: unknown;
  agentFeeAmount?: unknown;
  agentProfileId?: unknown;
  media?: unknown;
};

type NormalizedMedia = { key: string; contentType: string; publicUrl: string; sortOrder: number };

function text(value: unknown, max = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" && value ? value.slice(0, 10) : null;
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
  const isDemo = !isSample && !row.owner_id;
  return {
    id: String(row.id),
    source: isSample ? "sample" as const : isDemo ? "demo" as const : "remote" as const,
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
    squareFeet: row.square_feet == null ? null : Number(row.square_feet),
    moveIn: String(row.move_in || "immediate"),
    lease: String(row.lease || ""),
    image: photos[0] || "",
    photos,
    features,
    tagsZh,
    tagsEn,
    freshnessZh: isSample ? "示例房源 · 非真实库存" : isDemo ? "演示发布 · 仅供体验" : "刚刚发布",
    freshnessEn: isSample ? "Synthetic sample · not real inventory" : isDemo ? "Demo post · for testing only" : "Published recently",
    posterZh: isSample ? "示例房源 · 仅用于体验" : isDemo ? "演示房源 · 未登录发布" : `${role[0]} · 用户发布`,
    posterEn: isSample ? "Synthetic sample · for testing only" : isDemo ? "Demo listing · signed-out post" : `${role[1]} · user posted`,
    posterVerified: !isSample && !isDemo,
    privacyZh: "公开页面只显示大致区域",
    privacyEn: "Public page shows approximate area only",
    descriptionZh: String(row.description_zh || ""),
    descriptionEn: String(row.description_en || ""),
    expiresOn: dateOnly(row.expires_on),
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
  const squareFeetValue = body.squareFeet === "" || body.squareFeet === null || body.squareFeet === undefined ? null : Number(body.squareFeet);
  const squareFeet = typeof squareFeetValue === "number" && Number.isFinite(squareFeetValue) ? squareFeetValue : null;
  const moveIn = text(body.moveIn, 80) || "immediate";
  const leaseMonths = Number(body.lease);
  const expiresOn = text(body.expiresOn, 10);
  const features = stringList(body.features, ALLOWED_FEATURES);
  const descriptionZh = text(body.descriptionZh);
  const descriptionEn = text(body.descriptionEn) || descriptionZh;
  const contactName = text(body.contactName, 180);
  const contactEmail = text(body.contactEmail, 240).toLowerCase();
  const tourPreference = text(body.tourPreference, 40) || "flexible";
  const agentService = ALLOWED_AGENT_SERVICES.has(text(body.agentService, 40)) ? text(body.agentService, 40) : "selfManaged";
  const requestedAgentFeePlan = text(body.agentFeePlan, 40);
  const agentFeePlan = agentService === "agentMatch" && ALLOWED_AGENT_FEE_PLANS.has(requestedAgentFeePlan) ? requestedAgentFeePlan : "agentQuote";
  const agentFeeAmount = agentService === "agentMatch" && agentFeePlan === "flatFee" ? Number(body.agentFeeAmount) : null;
  const agentProfileId = agentService === "agentMatch" ? text(body.agentProfileId, 120) || null : null;
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
    squareFeet,
    moveIn,
    leaseMonths,
    lease: `${leaseMonths} months`,
    expiresOn,
    features,
    tagsZh: features.map((feature) => FEATURE_LABELS[feature][0]),
    tagsEn: features.map((feature) => FEATURE_LABELS[feature][1]),
    descriptionZh,
    descriptionEn,
    contactName,
    contactEmail,
    tourPreference,
    agentService,
    agentFeePlan,
    agentFeeAmount: Number.isFinite(agentFeeAmount) ? agentFeeAmount : null,
    agentProfileId,
    media,
  };
}

function validateListing(input: ReturnType<typeof normalizeBody>) {
  if (!input.titleZh || !input.areaZh || !input.privateAddress || !input.contactName || !input.contactEmail.includes("@")) return "Complete the title, approximate area, private address, and contact email.";
  if (!ALLOWED_RENTAL_TYPES.has(input.rentalType) || input.currency !== "USD" || !Number.isFinite(input.price) || input.price <= 0) return "Use a valid rental type and positive monthly rent.";
  if (!ALLOWED_BATHROOMS.has(input.bathrooms)) return "Choose an exact bathroom count.";
  if (!Number.isInteger(input.leaseMonths) || input.leaseMonths <= 0 || input.leaseMonths > 120) return "Use a lease term between 1 and 120 months.";
  if (input.squareFeet !== null && (!Number.isInteger(input.squareFeet) || input.squareFeet < 50 || input.squareFeet > 100000)) return "Use a square footage value between 50 and 100,000 square feet.";
  if (input.moveIn !== "immediate" && !/^\d{4}-\d{2}-\d{2}$/.test(input.moveIn)) return "Choose immediate move-in or a valid move-in date.";
  if (input.expiresOn && (!isDateOnly(input.expiresOn) || input.expiresOn < new Date().toISOString().slice(0, 10))) return "Choose today or a future listing expiration date.";
  if (input.agentService === "agentMatch" && input.agentFeePlan === "flatFee" && (!input.agentFeeAmount || input.agentFeeAmount <= 0)) return "Add a valid agent flat fee or choose another fee preference.";
  if (input.media.length === 0) return "Upload at least one image before publishing.";
  return "";
}

function agentFeeLabel(input: ReturnType<typeof normalizeBody>) {
  if (input.agentFeePlan === "firstMonthRent") return "成交后支付一个月租金";
  if (input.agentFeePlan === "flatFee") return `固定 $${Number(input.agentFeeAmount || 0).toLocaleString("en-US")}`;
  return "请经纪报价";
}

export async function GET(request: Request) {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    await ensureDatabaseSchema();
    const params = new URL(request.url).searchParams;
    const requestedLimit = Number(params.get("limit") || 100);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
    const requestedOffset = Number(params.get("offset") || 0);
    const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
    const sort = params.get("sort");
    const orderBy = sort === "price"
      ? "l.price ASC, l.created_at DESC"
      : sort === "moveIn"
        ? "CASE WHEN l.move_in = 'immediate' THEN 0 WHEN l.move_in ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN 1 ELSE 2 END, CASE WHEN l.move_in ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN l.move_in END ASC NULLS LAST, l.created_at DESC"
        : sort === "verified"
          ? "CASE WHEN l.is_sample THEN 1 ELSE 0 END, l.created_at DESC"
          : "l.created_at DESC";
    const rows = await sql.query(`
      SELECT
        l.id, l.owner_id, l.title_zh, l.title_en, l.area_zh, l.area_en, l.rental_type,
        l.price, l.bedrooms, l.bathrooms, l.square_feet, l.move_in, l.lease, l.features,
        l.tags_zh, l.tags_en, l.description_zh, l.description_en, l.poster_role, l.is_sample,
        COALESCE(
          jsonb_agg(jsonb_build_object('key', m.object_key, 'url', m.public_url) ORDER BY m.sort_order)
          FILTER (WHERE m.id IS NOT NULL),
          '[]'::jsonb
        ) AS media
      FROM rental_listings l
      LEFT JOIN rental_listing_media m ON m.listing_id = l.id
      WHERE l.status = 'published'
        AND l.moderation_status = 'approved'
        AND (l.expires_on IS NULL OR l.expires_on >= CURRENT_DATE)
      GROUP BY l.id
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
    `, [limit + 1, offset]);
    const hasMore = rows.length > limit;
    const listings = rows.slice(0, limit).map((row) => toClientListing(row as Record<string, unknown>));
    return NextResponse.json(listings, { headers: { "X-Has-More": String(hasMore) } });
  } catch {
    return NextResponse.json({ error: "Listings could not be loaded from the database." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const demoMode = demoModeEnabled();
  let user = null;
  if (!demoMode) {
    try {
      user = await getCurrentUser();
    } catch {
      return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
    }
    if (!user) return NextResponse.json({ error: "Sign in before publishing a listing." }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before publishing a listing." }, { status: 403 });
  }
  let input: ReturnType<typeof normalizeBody>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Listing payload is too large." }, { status: 413 });
    input = normalizeBody(JSON.parse(rawBody) as ListingBody);
  } catch {
    return NextResponse.json({ error: "Please send a valid listing." }, { status: 400 });
  }
  if (user) input = { ...input, contactName: user.displayName, contactEmail: user.email };
  if (user && input.posterRole === "agent" && !user.agentVerified) {
    return NextResponse.json({ error: "Complete agent license verification before publishing as an agent.", code: "AGENT_VERIFICATION_REQUIRED" }, { status: 403 });
  }
  const validationError = validateListing(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const safetyError = listingSafetyError([input.titleZh, input.titleEn, input.descriptionZh, input.descriptionEn]);
  if (safetyError) return NextResponse.json({ error: safetyError }, { status: 400 });

  try {
    await ensureDatabaseSchema();
    if (user) {
      const listingLimit = listingLimitFor(user.accountType, user.agentVerified);
      const quotaRows = await sql.query(`
        SELECT COUNT(*)::int AS count
        FROM rental_listings
        WHERE owner_id = $1
          AND status IN ('published', 'paused')
          AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
      `, [user.id]);
      const usedListings = Number((quotaRows[0] as Record<string, unknown> | undefined)?.count || 0);
      if (usedListings >= listingLimit) {
        return NextResponse.json({
          error: user.agentVerified
            ? `Verified agent accounts can publish up to ${listingLimit} active listings.`
            : `Regular accounts can publish up to ${listingLimit} active listings.`,
          code: "LISTING_LIMIT_REACHED",
          limit: listingLimit,
          used: usedListings,
          agentVerified: user.agentVerified,
        }, { status: 403 });
      }
    }
    if (input.agentProfileId) {
      const agentRows = await sql.query("SELECT id FROM rental_agent_profiles WHERE id = $1 AND is_active = TRUE LIMIT 1", [input.agentProfileId]);
      if (agentRows.length === 0) return NextResponse.json({ error: "Choose an active agent profile or submit a general matching request." }, { status: 400 });
    }
    const id = `listing-${randomUUID()}`;
    const ownerId = user?.id || null;
    const agentRequestId = input.agentService === "agentMatch" && ownerId ? `agent-request-${randomUUID()}` : null;
    await sql.transaction((tx) => [
      tx.query(`
        INSERT INTO rental_listings (
          id, owner_id, title_zh, title_en, area_zh, area_en, rental_type, price, currency,
        bedrooms, bathrooms, square_feet, move_in, lease, features, tags_zh, tags_en,
        description_zh, description_en, poster_role, expires_on, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USD', $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17, $18, $19, $20, NOW())
      `, [
        id,
        ownerId,
        input.titleZh,
        input.titleEn,
        input.areaZh,
        input.areaEn,
        input.rentalType,
        input.price,
        input.bedrooms,
        input.bathrooms,
        input.squareFeet,
        input.moveIn,
        input.lease,
        JSON.stringify(input.features),
        JSON.stringify(input.tagsZh),
        JSON.stringify(input.tagsEn),
        input.descriptionZh,
        input.descriptionEn,
        input.posterRole,
        input.expiresOn || null,
      ]),
      tx.query(`
        INSERT INTO rental_listing_private_details (listing_id, private_address, contact_name, contact_email, tour_preference, agent_service, agent_fee_plan, agent_fee_amount, agent_profile_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [id, input.privateAddress, input.contactName, input.contactEmail, input.tourPreference, input.agentService, input.agentFeePlan, input.agentFeeAmount, input.agentProfileId]),
      ...(agentRequestId ? [tx.query(`
        INSERT INTO rental_agent_requests (id, listing_id, owner_id, agent_profile_id, fee_plan, fee_amount, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      `, [agentRequestId, id, ownerId, input.agentProfileId, input.agentFeePlan, input.agentFeeAmount])] : []),
      ...input.media.map((media) => tx.query(`
        INSERT INTO rental_listing_media (id, listing_id, object_key, public_url, content_type, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), id, media.key, media.publicUrl, media.contentType, media.sortOrder])),
    ]);

    const row = {
      id,
      owner_id: ownerId,
      title_zh: input.titleZh,
      title_en: input.titleEn,
      area_zh: input.areaZh,
      area_en: input.areaEn,
      rental_type: input.rentalType,
      price: input.price,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      square_feet: input.squareFeet,
      move_in: input.moveIn,
      lease: input.lease,
      features: input.features,
      tags_zh: input.tagsZh,
      tags_en: input.tagsEn,
      description_zh: input.descriptionZh,
      description_en: input.descriptionEn,
      poster_role: input.posterRole,
      expires_on: input.expiresOn || null,
      media: input.media.map((media) => ({ key: media.key, url: media.publicUrl })),
    };
    let agentNotificationSent = false;
    if (agentRequestId && input.agentProfileId && emailIsConfigured()) {
      const agentRows = await sql.query(`
        SELECT ap.display_name_zh, ap.display_name_en, u.display_name AS recipient_name, u.email AS recipient_email
        FROM rental_agent_profiles ap
        JOIN rental_users u ON u.id = ap.user_id
        WHERE ap.id = $1 AND ap.is_active = TRUE
        LIMIT 1
      `, [input.agentProfileId]);
      const agent = agentRows[0] as Record<string, unknown> | undefined;
      const recipientEmail = String(agent?.recipient_email || "");
      if (agent && recipientEmail && !recipientEmail.endsWith(".invalid")) {
        try {
          await sendAgentRequestNotification({
            recipientEmail,
            recipientName: String(agent.recipient_name || agent.display_name_zh || "房产经纪"),
            listingTitle: input.titleZh,
            listingArea: input.areaZh,
            ownerName: input.contactName,
            ownerEmail: input.contactEmail,
            agentName: String(agent.display_name_zh || agent.display_name_en || "房产经纪"),
            feeLabel: agentFeeLabel(input),
          });
          agentNotificationSent = true;
        } catch {
          // The request is already stored; the notification can be retried after email configuration is fixed.
        }
      }
    }
    return NextResponse.json({ ...toClientListing(row), agentRequestStatus: agentRequestId ? "pending" : null, agentNotificationSent, demoMode }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The listing could not be saved to the database." }, { status: 502 });
  }
}

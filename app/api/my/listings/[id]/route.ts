import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { reviewListingSafety } from "../../../../lib/safety";
import { emailIsConfigured, sendAgentRequestNotification } from "../../../../lib/email";
import { listingLimitFor } from "../../../../lib/account-types";
import { normalizeListingMedia } from "../../../../lib/listing-media";
import { duplicateMediaCount } from "../../../../lib/listing-quality";

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
  squareFeet?: unknown;
  moveIn?: unknown;
  lease?: unknown;
  expiresOn?: unknown;
  features?: unknown;
  descriptionZh?: unknown;
  descriptionEn?: unknown;
  tourPreference?: unknown;
  agentService?: unknown;
  agentFeePlan?: unknown;
  agentFeeAmount?: unknown;
  agentProfileId?: unknown;
  media?: unknown;
};

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

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && ALLOWED_FEATURES.has(item))
    .slice(0, 20);
}

function normalizeBody(body: ListingBody) {
  const features = stringList(body.features);
  const leaseMonths = Number(body.lease);
  const expiresOn = text(body.expiresOn, 10);
  const agentService = ALLOWED_AGENT_SERVICES.has(text(body.agentService, 40)) ? text(body.agentService, 40) : "selfManaged";
  const requestedAgentFeePlan = text(body.agentFeePlan, 40);
  const agentFeePlan = agentService === "agentMatch" && ALLOWED_AGENT_FEE_PLANS.has(requestedAgentFeePlan) ? requestedAgentFeePlan : "agentQuote";
  const agentFeeAmount = agentService === "agentMatch" && agentFeePlan === "flatFee" ? Number(body.agentFeeAmount) : null;
  const agentProfileId = agentService === "agentMatch" ? text(body.agentProfileId, 120) || null : null;
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
    squareFeet: body.squareFeet === "" || body.squareFeet === null || body.squareFeet === undefined ? null : Number(body.squareFeet),
    moveIn: text(body.moveIn, 80) || "immediate",
    leaseMonths,
    lease: `${leaseMonths} months`,
    expiresOn,
    features,
    tagsZh: features.map((feature) => FEATURE_LABELS[feature][0]),
    tagsEn: features.map((feature) => FEATURE_LABELS[feature][1]),
    descriptionZh: text(body.descriptionZh),
    descriptionEn: text(body.descriptionEn) || text(body.descriptionZh),
    tourPreference: text(body.tourPreference, 40) || "flexible",
    agentService,
    agentFeePlan,
    agentFeeAmount: Number.isFinite(agentFeeAmount) ? agentFeeAmount : null,
    agentProfileId,
    media: normalizeListingMedia(body.media),
  };
}

function validationError(input: ReturnType<typeof normalizeBody>) {
  if (!input.titleZh || !input.areaZh || !input.privateAddress) return "Complete the title, approximate area, and private address.";
  if (!ALLOWED_RENTAL_TYPES.has(input.rentalType) || !Number.isFinite(input.price) || input.price <= 0) return "Use a valid rental type and positive monthly rent.";
  if (!ALLOWED_BATHROOMS.has(input.bathrooms)) return "Choose an exact bathroom count.";
  if (!Number.isInteger(input.leaseMonths) || input.leaseMonths <= 0 || input.leaseMonths > 120) return "Use a lease term between 1 and 120 months.";
  if (input.squareFeet !== null && (!Number.isInteger(input.squareFeet) || input.squareFeet < 50 || input.squareFeet > 100000)) return "Use a square footage value between 50 and 100,000 square feet.";
  if (input.moveIn !== "immediate" && !/^\d{4}-\d{2}-\d{2}$/.test(input.moveIn)) return "Choose immediate move-in or a valid move-in date.";
  if (input.expiresOn && (!isDateOnly(input.expiresOn) || input.expiresOn < new Date().toISOString().slice(0, 10))) return "Choose today or a future listing expiration date.";
  if (input.agentService === "agentMatch" && input.agentFeePlan === "flatFee" && (!input.agentFeeAmount || input.agentFeeAmount <= 0)) return "Add a valid agent flat fee or choose another fee preference.";
  if (input.media.length === 0) return "Keep at least one listing image.";
  if (duplicateMediaCount(input.media) > 0) return "Remove duplicate listing images before saving.";
  return "";
}

function agentFeeLabel(input: ReturnType<typeof normalizeBody>) {
  if (input.agentFeePlan === "firstMonthRent") return "成交后支付一个月租金";
  if (input.agentFeePlan === "flatFee") return `固定 $${Number(input.agentFeeAmount || 0).toLocaleString("en-US")}`;
  return "请经纪报价";
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

  if (body.status === "published" || body.status === "paused" || body.status === "unpublished") {
    try {
      await ensureDatabaseSchema();
      const status = body.status === "published" ? "published" : "paused";
      const hasExpiration = Object.prototype.hasOwnProperty.call(body, "expiresOn");
      const expiresOn = text(body.expiresOn, 10);
      if (expiresOn && (!isDateOnly(expiresOn) || expiresOn < new Date().toISOString().slice(0, 10))) {
        return NextResponse.json({ error: "Choose today or a future listing expiration date." }, { status: 400 });
      }
      const ownedRows = await sql.query(
        "SELECT status, expires_on FROM rental_listings WHERE id = $1 AND owner_id = $2 LIMIT 1",
        [id, user.id],
      );
      const ownedListing = ownedRows[0] as Record<string, unknown> | undefined;
      if (!ownedListing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      const currentExpiresOn = dateOnly(ownedListing.expires_on);
      const currentCountsTowardQuota = (ownedListing.status === "published" || ownedListing.status === "paused")
        && (!currentExpiresOn || currentExpiresOn >= new Date().toISOString().slice(0, 10));
      if (!currentCountsTowardQuota) {
        const listingLimit = listingLimitFor(user.accountType, user.agentVerified);
        const quotaRows = await sql.query(`
          SELECT COUNT(*)::int AS count
          FROM rental_listings
          WHERE owner_id = $1
            AND id <> $2
            AND status IN ('published', 'paused')
            AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
        `, [user.id, id]);
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
      const result = await sql.query(
        hasExpiration
          ? "UPDATE rental_listings SET status = $1, expires_on = $2, published_at = CASE WHEN $1 = 'published' THEN NOW() ELSE published_at END, paused_at = CASE WHEN $1 = 'paused' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $3 AND owner_id = $4 RETURNING id, status, expires_on"
          : "UPDATE rental_listings SET status = $1, published_at = CASE WHEN $1 = 'published' THEN NOW() ELSE published_at END, paused_at = CASE WHEN $1 = 'paused' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING id, status, expires_on",
        hasExpiration ? [status, expiresOn || null, id, user.id] : [status, id, user.id],
      );
      if (result.length === 0) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      if (status === "paused") await sql.query("UPDATE rental_agent_requests SET status = 'cancelled', updated_at = NOW() WHERE listing_id = $1 AND status = 'pending'", [id]);
      const updated = result[0] as Record<string, unknown>;
      return NextResponse.json({ id, status, expiresOn: dateOnly(updated.expires_on) });
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
  if (input.posterRole === "agent" && !user.agentVerified) {
    return NextResponse.json({ error: "Complete agent license verification before publishing as an agent.", code: "AGENT_VERIFICATION_REQUIRED" }, { status: 403 });
  }
  const validation = validationError(input);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  const safetyReview = reviewListingSafety({ titleZh: input.titleZh, titleEn: input.titleEn, descriptionZh: input.descriptionZh, descriptionEn: input.descriptionEn });
  if (safetyReview.blocking.length > 0) {
    return NextResponse.json({ error: safetyReview.blocking[0].detailEn, code: "SAFETY_REVIEW_REQUIRED", safety: safetyReview }, { status: 400 });
  }

  try {
    await ensureDatabaseSchema();
    if (input.agentProfileId) {
      const agentRows = await sql.query("SELECT id FROM rental_agent_profiles WHERE id = $1 AND is_active = TRUE LIMIT 1", [input.agentProfileId]);
      if (agentRows.length === 0) return NextResponse.json({ error: "Choose an active agent profile or submit a general matching request." }, { status: 400 });
    }
    const ownedRows = await sql.query("SELECT id FROM rental_listings WHERE id = $1 AND owner_id = $2 LIMIT 1", [id, user.id]);
    if (ownedRows.length === 0) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    const agentRequestId = `agent-request-${randomUUID()}`;
    const result = await sql.transaction((tx) => [
      tx.query(`
        UPDATE rental_listings SET
          title_zh = $1, title_en = $2, area_zh = $3, area_en = $4, rental_type = $5,
          price = $6, currency = 'USD', bedrooms = $7, bathrooms = $8, square_feet = $9, move_in = $10,
          lease = $11, features = $12::jsonb, tags_zh = $13::jsonb, tags_en = $14::jsonb,
          description_zh = $15, description_en = $16, poster_role = $17, expires_on = $18, updated_at = NOW()
        WHERE id = $19 AND owner_id = $20
        RETURNING id, status, expires_on
      `, [
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
        id,
        user.id,
      ]),
      tx.query(`
        UPDATE rental_listing_private_details
          SET private_address = $1, contact_name = $2, contact_email = $3, tour_preference = $4,
            agent_service = $5, agent_fee_plan = $6, agent_fee_amount = $7, agent_profile_id = $8, updated_at = NOW()
        WHERE listing_id = $9
      `, [input.privateAddress, user.displayName, user.email, input.tourPreference, input.agentService, input.agentFeePlan, input.agentService === "agentMatch" && input.agentFeePlan === "flatFee" ? input.agentFeeAmount : null, input.agentProfileId, id]),
      input.agentService === "agentMatch"
        ? tx.query(`
            INSERT INTO rental_agent_requests (id, listing_id, owner_id, agent_profile_id, fee_plan, fee_amount, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
            ON CONFLICT (listing_id) DO UPDATE SET
              agent_profile_id = EXCLUDED.agent_profile_id,
              fee_plan = EXCLUDED.fee_plan,
              fee_amount = EXCLUDED.fee_amount,
              status = 'pending',
              agent_note = '',
              responded_at = NULL,
              updated_at = NOW()
          `, [agentRequestId, id, user.id, input.agentProfileId, input.agentFeePlan, input.agentFeeAmount])
        : tx.query("UPDATE rental_agent_requests SET status = 'cancelled', updated_at = NOW() WHERE listing_id = $1", [id]),
      tx.query("DELETE FROM rental_listing_media WHERE listing_id = $1", [id]),
      ...input.media.map((media) => tx.query(`
        INSERT INTO rental_listing_media (
          id, listing_id, object_key, public_url, content_type,
          thumbnail_object_key, thumbnail_public_url, thumbnail_content_type,
          width, height, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [randomUUID(), id, media.key, media.publicUrl, media.contentType, media.thumbnailKey || null, media.thumbnailPublicUrl || null, media.thumbnailContentType || null, media.width || null, media.height || null, media.sortOrder])),
    ]);
    const updated = result[0]?.[0] as { id?: unknown; status?: unknown; expires_on?: unknown } | undefined;
    if (!updated?.id) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    let agentNotificationSent = false;
    if (input.agentService === "agentMatch" && input.agentProfileId && emailIsConfigured()) {
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
            ownerName: user.displayName,
            ownerEmail: user.email,
            agentName: String(agent.display_name_zh || agent.display_name_en || "房产经纪"),
            feeLabel: agentFeeLabel(input),
          });
          agentNotificationSent = true;
        } catch {
          // The request is already stored; the notification can be retried after email configuration is fixed.
        }
      }
    }
    return NextResponse.json({ id, status: String(updated.status || "published"), expiresOn: dateOnly(updated.expires_on), agentRequestStatus: input.agentService === "agentMatch" ? "pending" : "cancelled", agentNotificationSent });
  } catch {
    return NextResponse.json({ error: "The listing could not be updated." }, { status: 502 });
  }
}

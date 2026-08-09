import { NextResponse } from "next/server";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { listingMediaFromDatabase } from "../../../lib/listing-media";

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" && value ? value.slice(0, 10) : null;
}

function ownerListing(row: Record<string, unknown>) {
  const media = listingMediaFromDatabase(row.media);
  const photos = media.map((item) => item.url);
  const photoThumbnails = media.map((item) => item.thumbnailUrl || item.url);
  const photoKeys = media.map((item) => item.key);
  const type = String(row.rental_type || "entire");
  const typeLabels = type === "privateRoom" ? ["独立房间", "Private room"] : type === "sublet" ? ["转租", "Sublet"] : ["整套住房", "Entire home"];
  return {
    id: String(row.id),
    source: "remote" as const,
    titleZh: String(row.title_zh || ""),
    titleEn: String(row.title_en || ""),
    areaZh: String(row.area_zh || ""),
    areaEn: String(row.area_en || ""),
    type,
    posterRole: row.poster_role === "agent" ? "agent" as const : "owner" as const,
    typeZh: typeLabels[0],
    typeEn: typeLabels[1],
    price: Number(row.price || 0),
    currency: "USD" as const,
    bedrooms: String(row.bedrooms || ""),
    bathrooms: String(row.bathrooms || ""),
    squareFeet: row.square_feet == null ? null : Number(row.square_feet),
    moveIn: String(row.move_in || "immediate"),
    lease: String(row.lease || ""),
    image: photos[0] || "",
    photos,
    photoThumbnails,
    photoKeys,
    media,
    features: list(row.features),
    tagsZh: list(row.tags_zh),
    tagsEn: list(row.tags_en),
    freshnessZh: String(row.status || "published"),
    freshnessEn: String(row.status || "published"),
    posterZh: "我的房源",
    posterEn: "My listing",
    privacyZh: "公开页面只显示大致区域",
    privacyEn: "Public page shows approximate area only",
    moderationStatus: String(row.moderation_status || "approved"),
    moderationNote: String(row.moderation_note || ""),
    descriptionZh: String(row.description_zh || ""),
    descriptionEn: String(row.description_en || ""),
    privateAddress: String(row.private_address || ""),
    contactName: String(row.contact_name || ""),
    contactEmail: String(row.contact_email || ""),
    tourPreference: String(row.tour_preference || "flexible"),
    agentService: row.agent_service === "agentMatch" ? "agentMatch" as const : "selfManaged" as const,
    agentFeePlan: row.agent_fee_plan === "firstMonthRent" ? "firstMonthRent" as const : row.agent_fee_plan === "flatFee" ? "flatFee" as const : "agentQuote" as const,
    agentFeeAmount: row.agent_fee_amount == null ? null : Number(row.agent_fee_amount),
    agentProfileId: row.agent_profile_id ? String(row.agent_profile_id) : null,
    agentProfileNameZh: row.agent_profile_name_zh ? String(row.agent_profile_name_zh) : null,
    agentProfileNameEn: row.agent_profile_name_en ? String(row.agent_profile_name_en) : null,
    agentRequestId: row.agent_request_id ? String(row.agent_request_id) : null,
    agentRequestStatus: row.agent_request_status ? String(row.agent_request_status) : null,
    agentRequestNote: row.agent_request_note ? String(row.agent_request_note) : "",
    status: String(row.status || "published"),
    expiresOn: dateOnly(row.expires_on),
    publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : row.published_at ? String(row.published_at) : null,
    availabilityConfirmedAt: row.availability_confirmed_at instanceof Date ? row.availability_confirmed_at.toISOString() : row.availability_confirmed_at ? String(row.availability_confirmed_at) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
  };
}

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to view your dashboard." }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT
        l.id, l.title_zh, l.title_en, l.area_zh, l.area_en, l.rental_type, l.price,
        l.bedrooms, l.bathrooms, l.square_feet, l.move_in, l.lease, l.features, l.tags_zh, l.tags_en,
        l.description_zh, l.description_en, l.poster_role, l.status, l.moderation_status, l.moderation_note, l.expires_on, l.published_at, l.availability_confirmed_at, l.created_at,
        p.private_address, p.contact_name, p.contact_email, p.tour_preference,
        p.agent_service, p.agent_fee_plan, p.agent_fee_amount, p.agent_profile_id,
        a.display_name_zh AS agent_profile_name_zh, a.display_name_en AS agent_profile_name_en,
        ar.id AS agent_request_id, ar.status AS agent_request_status, ar.agent_note AS agent_request_note,
        COALESCE(
          jsonb_agg(jsonb_build_object(
            'key', m.object_key,
            'url', m.public_url,
            'thumbnailKey', m.thumbnail_object_key,
            'thumbnailUrl', m.thumbnail_public_url,
            'thumbnailContentType', m.thumbnail_content_type,
            'contentType', m.content_type,
            'width', m.width,
            'height', m.height
          ) ORDER BY m.sort_order)
          FILTER (WHERE m.id IS NOT NULL),
          '[]'::jsonb
        ) AS media
      FROM rental_listings l
      JOIN rental_listing_private_details p ON p.listing_id = l.id
      LEFT JOIN rental_listing_media m ON m.listing_id = l.id
      LEFT JOIN rental_agent_profiles a ON a.id = p.agent_profile_id
      LEFT JOIN rental_agent_requests ar ON ar.listing_id = l.id
      WHERE l.owner_id = $1
      GROUP BY l.id, p.listing_id, a.id, ar.id
      ORDER BY l.created_at DESC
    `, [user.id]);
    return NextResponse.json(rows.map((row) => ownerListing(row as Record<string, unknown>)));
  } catch {
    return NextResponse.json({ error: "Your listings could not be loaded right now." }, { status: 502 });
  }
}

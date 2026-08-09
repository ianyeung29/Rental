import { sql } from "./db";

export type AgentReviewRole = "owner" | "renter";

export type PublicAgentReview = {
  id: string;
  agentProfileId: string;
  rating: number;
  comment: string;
  reviewerRole: AgentReviewRole;
  createdAt: string;
};

export type AgentReviewInteraction = {
  listingId: string;
  listingTitleZh: string;
  listingTitleEn: string;
  listingAreaZh: string;
  listingAreaEn: string;
  reviewerRole: AgentReviewRole;
  alreadyReviewed: boolean;
};

function dateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : "";
}

export function publicReviewFromRow(row: Record<string, unknown>): PublicAgentReview {
  const role = String(row.reviewer_role || "renter");
  return {
    id: String(row.id || ""),
    agentProfileId: String(row.agent_profile_id || ""),
    rating: Math.min(5, Math.max(1, Number(row.rating || 0))),
    comment: String(row.comment || ""),
    reviewerRole: role === "owner" ? "owner" : "renter",
    createdAt: dateValue(row.created_at),
  };
}

export async function eligibleAgentReviewInteractions(agentProfileId: string, reviewerId: string, listingId?: string) {
  if (!sql || !agentProfileId || !reviewerId) return [] as AgentReviewInteraction[];
  const listingFilter = listingId ? "AND l.id = $3" : "";
  const values = listingId ? [agentProfileId, reviewerId, listingId] : [agentProfileId, reviewerId];
  const rows = await sql.query(`
    SELECT DISTINCT l.id AS listing_id, l.title_zh, l.title_en, l.area_zh, l.area_en, l.updated_at AS listing_updated_at,
           CASE WHEN l.owner_id = $2 THEN 'owner' ELSE 'renter' END AS reviewer_role,
           EXISTS (
             SELECT 1 FROM rental_agent_reviews existing_review
             WHERE existing_review.agent_profile_id = $1
               AND existing_review.reviewer_id = $2
               AND existing_review.listing_id = l.id
           ) AS already_reviewed
    FROM rental_listings l
    JOIN rental_agent_requests ar ON ar.listing_id = l.id
      AND ar.agent_profile_id = $1
      AND ar.status = 'accepted'
    WHERE (
      ar.owner_id = $2
      OR EXISTS (
        SELECT 1 FROM rental_inquiries inquiry
        WHERE inquiry.listing_id = l.id
          AND inquiry.requester_id = $2
          AND inquiry.status = 'closed'
      )
      OR EXISTS (
        SELECT 1 FROM rental_applications application
        WHERE application.listing_id = l.id
          AND application.requester_id = $2
          AND application.status IN ('approved', 'declined', 'withdrawn')
      )
    )
    ${listingFilter}
    ORDER BY l.updated_at DESC
  `, values);
  return rows.map((row) => {
    const value = row as Record<string, unknown>;
    const role = String(value.reviewer_role || "renter");
    return {
      listingId: String(value.listing_id || ""),
      listingTitleZh: String(value.title_zh || "房源"),
      listingTitleEn: String(value.title_en || "Listing"),
      listingAreaZh: String(value.area_zh || ""),
      listingAreaEn: String(value.area_en || ""),
      reviewerRole: role === "owner" ? "owner" : "renter",
      alreadyReviewed: value.already_reviewed === true || value.already_reviewed === "t" || value.already_reviewed === 1,
    } satisfies AgentReviewInteraction;
  });
}

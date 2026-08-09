import { NextResponse } from "next/server";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";
import { demoModeEnabled } from "../../lib/demo";
import { publicReviewFromRow, type PublicAgentReview } from "../../lib/agent-reviews";

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toAgentProfile(row: Record<string, unknown>, reviews: PublicAgentReview[]) {
  const average = Number(row.review_average || 0);
  return {
    id: String(row.id),
    displayNameZh: String(row.display_name_zh || ""),
    displayNameEn: String(row.display_name_en || ""),
    portraitUrl: String(row.portrait_url || ""),
    brokerage: String(row.brokerage || ""),
    licenseState: String(row.license_state || ""),
    serviceAreas: stringList(row.service_areas),
    languages: stringList(row.languages),
    feeSummaryZh: String(row.fee_summary_zh || ""),
    feeSummaryEn: String(row.fee_summary_en || ""),
    isVerified: row.is_verified === true,
    isSample: row.is_sample === true,
    reviewCount: Math.max(0, Number(row.review_count || 0)),
    reviewAverage: Number.isFinite(average) ? Math.round(average * 10) / 10 : 0,
    reviews,
    verificationScope: "agent_license" as const,
  };
}

export async function GET(request: Request) {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const purpose = new URL(request.url).searchParams.get("purpose") === "selection" ? "selection" : "directory";
  if (purpose === "selection" && !demoModeEnabled()) {
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
    }
    if (!user) return NextResponse.json({ error: "Sign in before viewing agent profiles." }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before viewing agent profiles." }, { status: 403 });
  }

  try {
    await ensureDatabaseSchema();
    const visibility = purpose === "selection" && demoModeEnabled()
      ? "p.is_active = TRUE AND (p.is_verified = TRUE OR p.is_sample = TRUE)"
      : "p.is_active = TRUE AND p.is_verified = TRUE AND p.is_sample = FALSE";
    const rows = await sql.query(`
      SELECT p.id, p.display_name_zh, p.display_name_en, p.portrait_url, p.brokerage, p.license_state,
             p.service_areas, p.languages, p.fee_summary_zh, p.fee_summary_en, p.is_verified, p.is_sample,
             COUNT(r.id)::int AS review_count,
             COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0)::float AS review_average
      FROM rental_agent_profiles p
      LEFT JOIN rental_agent_reviews r ON r.agent_profile_id = p.id AND r.status = 'published'
      WHERE ${visibility}
      GROUP BY p.id, p.display_name_zh, p.display_name_en, p.portrait_url, p.brokerage, p.license_state,
               p.service_areas, p.languages, p.fee_summary_zh, p.fee_summary_en, p.is_verified, p.is_sample
      ORDER BY p.display_name_zh ASC
    `);
    const profileIds = rows.map((row) => String((row as Record<string, unknown>).id || "")).filter(Boolean);
    const reviewRows = profileIds.length === 0 ? [] : await sql.query(`
      SELECT id, agent_profile_id, reviewer_role, rating, comment, created_at
      FROM (
        SELECT r.id, r.agent_profile_id, r.reviewer_role, r.rating, r.comment, r.created_at,
               ROW_NUMBER() OVER (PARTITION BY r.agent_profile_id ORDER BY r.created_at DESC) AS review_rank
        FROM rental_agent_reviews r
        WHERE r.status = 'published' AND r.agent_profile_id = ANY($1::text[])
      ) recent
      WHERE review_rank <= 3
      ORDER BY created_at DESC
    `, [profileIds]);
    const reviewsByAgent = new Map<string, PublicAgentReview[]>();
    for (const row of reviewRows) {
      const review = publicReviewFromRow(row as Record<string, unknown>);
      const current = reviewsByAgent.get(review.agentProfileId) || [];
      current.push(review);
      reviewsByAgent.set(review.agentProfileId, current);
    }
    return NextResponse.json(rows.map((row) => {
      const value = row as Record<string, unknown>;
      const id = String(value.id || "");
      return toAgentProfile(value, reviewsByAgent.get(id) || []);
    }));
  } catch {
    return NextResponse.json({ error: "Agent profiles could not be loaded right now." }, { status: 502 });
  }
}

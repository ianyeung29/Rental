import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { recordAuditEventSafely } from "../../lib/audit";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { eligibleAgentReviewInteractions, publicReviewFromRow } from "../../lib/agent-reviews";
import { consumeRateLimit } from "../../lib/rate-limit";

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const agentProfileId = text(new URL(request.url).searchParams.get("agentProfileId"), 120);
  if (!agentProfileId) return NextResponse.json({ error: "Choose an agent profile first." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const profiles = await sql.query(`
      SELECT id FROM rental_agent_profiles
      WHERE id = $1 AND is_active = TRUE AND is_verified = TRUE AND is_sample = FALSE
      LIMIT 1
    `, [agentProfileId]);
    if (!profiles[0]) return NextResponse.json({ error: "This verified agent profile is not available." }, { status: 404 });
    const reviewRows = await sql.query(`
      SELECT id, agent_profile_id, reviewer_role, rating, comment, created_at
      FROM rental_agent_reviews
      WHERE agent_profile_id = $1 AND status = 'published'
      ORDER BY created_at DESC
      LIMIT 40
    `, [agentProfileId]);
    const reviews = reviewRows.map((row) => publicReviewFromRow(row as Record<string, unknown>));
    const user = await getCurrentUser().catch(() => null);
    const signedIn = Boolean(user);
    const emailVerified = Boolean(user?.emailVerified);
    const interactions = user && user.emailVerified
      ? await eligibleAgentReviewInteractions(agentProfileId, user.id)
      : [];
    return NextResponse.json({
      reviews,
      signedIn,
      emailVerified,
      canReview: interactions.some((interaction) => !interaction.alreadyReviewed),
      interactions,
    });
  } catch {
    return NextResponse.json({ error: "Agent reviews could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before reviewing an agent." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before reviewing an agent." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as { agentProfileId?: unknown; listingId?: unknown; rating?: unknown; comment?: unknown };
  const agentProfileId = text(body.agentProfileId, 120);
  const listingId = text(body.listingId, 120);
  const rating = Number(body.rating);
  const comment = text(body.comment, 600);
  if (!agentProfileId || !listingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Choose a verified interaction and a rating from 1 to 5." }, { status: 400 });
  }

  try {
    await ensureDatabaseSchema();
    const profileRows = await sql.query(`
      SELECT id FROM rental_agent_profiles
      WHERE id = $1 AND is_active = TRUE AND is_verified = TRUE AND is_sample = FALSE
      LIMIT 1
    `, [agentProfileId]);
    if (!profileRows[0]) return NextResponse.json({ error: "This verified agent profile is not available." }, { status: 404 });
    const rateLimit = await consumeRateLimit({ key: `agent-review:${user.id}`, limit: 10, windowSeconds: 24 * 60 * 60 });
    if (!rateLimit.allowed) return NextResponse.json({ error: "You have reached the daily review limit. Please try again tomorrow." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const interactions = await eligibleAgentReviewInteractions(agentProfileId, user.id, listingId);
    const interaction = interactions[0];
    if (!interaction) return NextResponse.json({ error: "Reviews are available only after a verified agent interaction." }, { status: 403 });
    if (interaction.alreadyReviewed) return NextResponse.json({ error: "You have already reviewed this agent for this listing." }, { status: 409 });
    const reviewId = `agent-review-${randomUUID()}`;
    const rows = await sql.query(`
      INSERT INTO rental_agent_reviews (id, agent_profile_id, reviewer_id, listing_id, reviewer_role, rating, comment, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'published')
      RETURNING id, agent_profile_id, reviewer_role, rating, comment, created_at
    `, [reviewId, agentProfileId, user.id, listingId, interaction.reviewerRole, rating, comment]);
    const review = rows[0] ? publicReviewFromRow(rows[0] as Record<string, unknown>) : null;
    await recordAuditEventSafely({ request, eventType: "agent.review_create", user, metadata: { agentProfileId, listingId, rating, reviewerRole: interaction.reviewerRole } });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("duplicate key")) {
      return NextResponse.json({ error: "You have already reviewed this agent for this listing." }, { status: 409 });
    }
    return NextResponse.json({ error: "The agent review could not be saved right now." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

const REPORT_STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

async function adminContext() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to access moderation." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before accessing moderation." }, { status: 403 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "Moderation access is restricted." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function dateValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function reviewSignals(row: Record<string, unknown>) {
  const signals: string[] = [];
  const reason = String(row.reason || "");
  const reportCount = Number(row.report_count || 0);
  const photoCount = Number(row.photo_count || 0);
  const descriptionLength = `${String(row.description_zh || "")} ${String(row.description_en || "")}`.trim().length;
  if (reason === "scam") signals.push("Possible scam report");
  if (reason === "privacy") signals.push("Privacy or address concern");
  if (reason === "discriminatory") signals.push("Fair-housing language review");
  if (reportCount > 1) signals.push(`${reportCount} reports on this listing`);
  if (photoCount <= 1) signals.push("Only one photo");
  if (descriptionLength < 60) signals.push("Short description");
  return signals;
}

function reportFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    titleZh: String(row.title_zh || ""),
    titleEn: String(row.title_en || ""),
    areaZh: String(row.area_zh || ""),
    areaEn: String(row.area_en || ""),
    listingPrice: Number(row.price || 0),
    listingModerationStatus: String(row.moderation_status || "approved"),
    ownerName: String(row.owner_name || ""),
    ownerEmail: String(row.owner_email || ""),
    reporterId: String(row.reporter_id || ""),
    reporterName: String(row.reporter_name || ""),
    reporterEmail: String(row.reporter_email || ""),
    reason: String(row.reason || "other"),
    details: String(row.details || ""),
    status: String(row.status || "open"),
    reviewNote: String(row.review_note || ""),
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    reviewedAt: dateValue(row.reviewed_at),
    reportCount: Number(row.report_count || 0),
    photoCount: Number(row.photo_count || 0),
    reviewSignals: reviewSignals(row),
  };
}

export async function GET(request: Request) {
  const context = await adminContext();
  if (context.error) return context.error;
  try {
    await ensureDatabaseSchema();
    const requestedStatus = new URL(request.url).searchParams.get("status") || "";
    const statusFilter = REPORT_STATUSES.has(requestedStatus) ? requestedStatus : "";
    const rows = await sql!.query(`
      SELECT r.id, r.listing_id, r.reason, r.details, r.status, r.review_note,
             r.created_at, r.updated_at, r.reviewed_at, r.reporter_id,
             l.title_zh, l.title_en, l.area_zh, l.area_en, l.price,
             l.moderation_status, l.description_zh, l.description_en,
             owner.display_name AS owner_name, owner.email AS owner_email,
             reporter.display_name AS reporter_name, reporter.email AS reporter_email,
             (SELECT COUNT(*)::int FROM rental_listing_reports all_reports WHERE all_reports.listing_id = r.listing_id) AS report_count,
             (SELECT COUNT(*)::int FROM rental_listing_media listing_media WHERE listing_media.listing_id = r.listing_id) AS photo_count
      FROM rental_listing_reports r
      JOIN rental_listings l ON l.id = r.listing_id
      JOIN rental_users reporter ON reporter.id = r.reporter_id
      LEFT JOIN rental_users owner ON owner.id = l.owner_id
      WHERE ($1 = '' OR r.status = $1)
      ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, r.created_at DESC
      LIMIT 200
    `, [statusFilter]);
    const countsRows = await sql!.query(`
      SELECT status, COUNT(*)::int AS count
      FROM rental_listing_reports
      GROUP BY status
    `);
    const counts = { open: 0, reviewing: 0, resolved: 0, dismissed: 0 };
    countsRows.forEach((row) => {
      const status = String((row as Record<string, unknown>).status || "") as keyof typeof counts;
      if (status in counts) counts[status] = Number((row as Record<string, unknown>).count || 0);
    });
    return NextResponse.json({ reports: rows.map((row) => reportFromRow(row as Record<string, unknown>)), counts });
  } catch {
    return NextResponse.json({ error: "The moderation queue could not be loaded right now." }, { status: 502 });
  }
}

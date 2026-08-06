import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../../lib/db";
import { emailIsConfigured, sendModerationDecision } from "../../../../lib/email";

const REPORT_STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);
const MODERATION_STATUSES = new Set(["approved", "under_review", "hidden", "rejected"]);

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await adminContext();
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { status?: unknown; moderationStatus?: unknown; note?: unknown };
  const requestedStatus = typeof body.status === "string" && REPORT_STATUSES.has(body.status) ? body.status : "";
  const requestedModerationStatus = typeof body.moderationStatus === "string" && MODERATION_STATUSES.has(body.moderationStatus) ? body.moderationStatus : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1_000) : "";
  if (!requestedStatus && !requestedModerationStatus) return NextResponse.json({ error: "Choose a report status or moderation decision." }, { status: 400 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });

  try {
    await ensureDatabaseSchema();
    const reportRows = await sql.query(`
      SELECT r.id, r.listing_id, r.status, r.reporter_id,
             l.owner_id, l.title_zh, l.title_en, l.area_zh, l.area_en,
             l.moderation_status, owner.display_name AS owner_name, owner.email AS owner_email,
             reporter.display_name AS reporter_name, reporter.email AS reporter_email
      FROM rental_listing_reports r
      JOIN rental_listings l ON l.id = r.listing_id
      LEFT JOIN rental_users owner ON owner.id = l.owner_id
      JOIN rental_users reporter ON reporter.id = r.reporter_id
      WHERE r.id = $1
      LIMIT 1
    `, [id]);
    const report = reportRows[0] as Record<string, unknown> | undefined;
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    const currentReportStatus = String(report.status || "open");
    const currentModerationStatus = String(report.moderation_status || "approved");
    const nextModerationStatus = requestedModerationStatus || currentModerationStatus;
    const nextReportStatus = requestedStatus || (requestedModerationStatus ? (requestedModerationStatus === "under_review" ? "reviewing" : "resolved") : currentReportStatus);
    const action = requestedModerationStatus
      ? `listing_${requestedModerationStatus}`
      : `report_${nextReportStatus}`;

    await sql.transaction((tx) => [
      tx.query(
        "UPDATE rental_listing_reports SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4",
        [nextReportStatus, note, auth.user.id, id],
      ),
      ...(requestedModerationStatus ? [tx.query(
        "UPDATE rental_listings SET moderation_status = $1, moderation_note = $2, moderation_updated_at = NOW(), moderation_updated_by = $3, updated_at = NOW() WHERE id = $4",
        [nextModerationStatus, note, auth.user.id, String(report.listing_id)],
      )] : []),
      tx.query(
        "INSERT INTO rental_moderation_events (id, listing_id, report_id, actor_id, action, from_status, to_status, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [`moderation-${randomUUID()}`, String(report.listing_id), id, auth.user.id, action, currentModerationStatus, nextModerationStatus, note],
      ),
      ...(requestedModerationStatus && report.owner_id ? [tx.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'moderation', $3, $4, $5, $6, '/#account')
      `, [
        `notification-${randomUUID()}`,
        String(report.owner_id),
        nextModerationStatus === "approved" ? "房源已恢复公开" : nextModerationStatus === "hidden" ? "房源已暂时隐藏" : nextModerationStatus === "rejected" ? "房源未通过审核" : "房源正在审核中",
        nextModerationStatus === "approved" ? "Listing restored" : nextModerationStatus === "hidden" ? "Listing temporarily hidden" : nextModerationStatus === "rejected" ? "Listing not approved" : "Listing under review",
        nextModerationStatus === "approved" ? "管理员已恢复你的房源公开状态。" : nextModerationStatus === "hidden" ? "管理员暂时隐藏了你的房源，请查看审核说明。" : nextModerationStatus === "rejected" ? "管理员没有批准你的房源，请查看审核说明。" : "管理员正在审核你的房源。",
        nextModerationStatus === "approved" ? "An admin restored your listing to public view." : nextModerationStatus === "hidden" ? "An admin temporarily hid your listing. Review the moderation note." : nextModerationStatus === "rejected" ? "An admin did not approve your listing. Review the moderation note." : "An admin is reviewing your listing.",
      ])] : []),
      ...(nextReportStatus === "resolved" || nextReportStatus === "dismissed" ? [tx.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'moderation', '举报已有处理结果', 'Report reviewed', $3, $4, '/#rentals')
      `, [
        `notification-${randomUUID()}`,
        String(report.reporter_id),
        nextReportStatus === "resolved" ? "感谢你的举报。审核团队已经处理了相关房源。" : "感谢你的举报。审核团队查看了相关房源，但目前没有采取进一步措施。",
        nextReportStatus === "resolved" ? "Thank you for reporting this listing. Our team has reviewed it and taken action." : "Thank you for reporting this listing. Our team reviewed it and did not take further action at this time.",
      ])] : []),
    ]);

    let emailSent = false;
    if (requestedModerationStatus && emailIsConfigured() && report.owner_email) {
      try {
        await sendModerationDecision({
          email: String(report.owner_email),
          displayName: String(report.owner_name || "房源发布者"),
          listingTitle: String(report.title_zh || report.title_en || "房源"),
          area: String(report.area_zh || report.area_en || ""),
          status: nextModerationStatus as "approved" | "under_review" | "hidden" | "rejected",
          note,
        });
        emailSent = true;
      } catch {
        // Moderation decisions remain saved when email delivery is unavailable.
      }
    }
    return NextResponse.json({ id, status: nextReportStatus, moderationStatus: nextModerationStatus, emailSent });
  } catch {
    return NextResponse.json({ error: "The moderation decision could not be saved." }, { status: 502 });
  }
}

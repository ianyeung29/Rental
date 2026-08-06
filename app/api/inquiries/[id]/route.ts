import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { emailIsConfigured, sendInquiryStatusUpdate } from "../../../lib/email";
import { emailAlertsAllowed } from "../../../lib/notification-preferences";

const ALLOWED_STATUSES = new Set(["sent", "contacted", "tourScheduled", "closed"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "";
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to update an inquiry." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before updating inquiries." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { status?: unknown; read?: unknown; tourScheduledAt?: unknown; tourTimeZone?: unknown; tourNote?: unknown };
  const status = typeof body.status === "string" && ALLOWED_STATUSES.has(body.status) ? body.status : "";
  const hasTourSchedule = Object.prototype.hasOwnProperty.call(body, "tourScheduledAt") || Object.prototype.hasOwnProperty.call(body, "tourTimeZone") || Object.prototype.hasOwnProperty.call(body, "tourNote");
  const tourScheduledAtInput = text(body.tourScheduledAt, 80);
  const tourTimeZone = validTimeZone(text(body.tourTimeZone, 80) || "UTC") || "UTC";
  const tourNote = text(body.tourNote, 500);
  const scheduledDate = tourScheduledAtInput ? new Date(tourScheduledAtInput) : null;
  const scheduledAt = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.toISOString() : null;
  if (!status && body.read !== true && !hasTourSchedule) return NextResponse.json({ error: "Choose a valid inquiry update." }, { status: 400 });
  if (status === "tourScheduled" || hasTourSchedule) {
    if (!scheduledAt || scheduledDate!.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future date and time for the tour." }, { status: 400 });
  }
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT i.id, i.listing_id, i.requester_id, l.owner_id, l.title_zh, l.title_en,
             u.display_name AS requester_name, u.email AS requester_email
      FROM rental_inquiries i
      JOIN rental_listings l ON l.id = i.listing_id
      JOIN rental_users u ON u.id = i.requester_id
      WHERE i.id = $1
      LIMIT 1
    `, [id]);
    const inquiry = rows[0] as Record<string, unknown> | undefined;
    if (!inquiry) return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    const isOwner = String(inquiry.owner_id || "") === user.id;
    const isRequester = String(inquiry.requester_id || "") === user.id;
    if (!isOwner && !isRequester) return NextResponse.json({ error: "You do not have access to this inquiry." }, { status: 403 });
    if (status && !isOwner && status !== "closed") return NextResponse.json({ error: "Only the listing owner can move an inquiry through the response workflow." }, { status: 403 });
    if (hasTourSchedule && !isOwner) return NextResponse.json({ error: "Only the listing owner can schedule a tour." }, { status: 403 });
    const readColumn = isOwner ? "owner_read_at" : "requester_read_at";
    let effectiveStatus = status;
    if (status === "tourScheduled" || hasTourSchedule) {
      effectiveStatus = "tourScheduled";
      await sql.query(`
        UPDATE rental_inquiries
        SET status = $1,
            tour_scheduled_at = $2,
            tour_timezone = $3,
            tour_note = $4,
            tour_reminder_sent_at = NULL,
            ${readColumn} = COALESCE(${readColumn}, NOW()),
            updated_at = NOW()
        WHERE id = $5
      `, [effectiveStatus, scheduledAt, tourTimeZone, tourNote, id]);
    } else if (status) {
      await sql.query(`UPDATE rental_inquiries SET status = $1, ${readColumn} = COALESCE(${readColumn}, NOW()), updated_at = NOW() WHERE id = $2`, [status, id]);
      const recipientId = isOwner ? String(inquiry.requester_id || "") : String(inquiry.owner_id || "");
      if (recipientId) {
        const titleZh = status === "closed" ? "咨询已完成" : "房源咨询有新进展";
        const titleEn = status === "closed" ? "Inquiry closed" : "Inquiry updated";
        await sql.query(`
          INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
          VALUES ($1, $2, 'inquiry', $3, $4, $5, $6, $7)
        `, [`notification-${randomUUID()}`, recipientId, titleZh, titleEn, `「${String(inquiry.title_zh || inquiry.title_en || "房源")}」的咨询状态已更新。`, `The inquiry for “${String(inquiry.title_en || inquiry.title_zh || "your listing")}” was updated.`, "/#messages"]);
      }
    } else {
      await sql.query(`UPDATE rental_inquiries SET ${readColumn} = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    }

    if (effectiveStatus === "tourScheduled") {
      const recipientId = String(inquiry.requester_id || "");
      if (recipientId) {
        await sql.query(`
          INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
          VALUES ($1, $2, 'inquiry', $3, $4, $5, $6, $7)
        `, [`notification-${randomUUID()}`, recipientId, "看房时间已安排", "Tour scheduled", `「${String(inquiry.title_zh || inquiry.title_en || "房源")}」已安排看房时间，请查看消息详情。`, `A tour was scheduled for “${String(inquiry.title_en || inquiry.title_zh || "your inquiry")}”. Open messages for the details.`, "/#messages"]);
      }
      if (isOwner && emailIsConfigured() && await emailAlertsAllowed(String(inquiry.requester_id || ""), "inquiry_alerts") && inquiry.requester_email && scheduledAt) {
        try {
          await sendInquiryStatusUpdate({
            recipientEmail: String(inquiry.requester_email),
            recipientName: String(inquiry.requester_name || "租客"),
            listingTitle: String(inquiry.title_zh || inquiry.title_en || "房源"),
            status: "tourScheduled",
            scheduledAt,
            timeZone: tourTimeZone,
            tourNote,
          });
        } catch {
          // Keep the schedule saved even if the optional email notification fails.
        }
      }
    }
    const responseBody: { id: string; status?: string; tourScheduledAt?: string | null; tourTimeZone?: string; tourNote?: string; readAt: string } = { id, status: effectiveStatus || undefined, readAt: new Date().toISOString() };
    if (effectiveStatus === "tourScheduled") {
      responseBody.tourScheduledAt = scheduledAt;
      responseBody.tourTimeZone = tourTimeZone;
      responseBody.tourNote = tourNote;
    }
    return NextResponse.json(responseBody);
  } catch {
    return NextResponse.json({ error: "The inquiry could not be updated right now." }, { status: 502 });
  }
}

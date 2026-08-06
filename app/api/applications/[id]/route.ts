import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { emailIsConfigured, sendApplicationStatusUpdate } from "../../../lib/email";
import { emailAlertsAllowed } from "../../../lib/notification-preferences";

const OWNER_STATUSES = new Set(["reviewing", "approved", "declined"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function statusLabel(status: string) {
  if (status === "reviewing") return "reviewing";
  if (status === "approved") return "approved";
  if (status === "declined") return "declined";
  if (status === "withdrawn") return "withdrawn";
  return "submitted";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to update a rental application." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before updating applications." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { status?: unknown; note?: unknown; read?: unknown };
  const requestedStatus = text(body.status, 30);
  const note = text(body.note, 1_000);
  if (!requestedStatus && body.read !== true) return NextResponse.json({ error: "Choose a valid application update." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT a.id, a.listing_id, a.requester_id, a.status, a.preferred_name,
             a.owner_note, a.requester_note, l.owner_id, l.title_zh, l.title_en,
             requester.display_name AS requester_name, requester.email AS requester_email,
             owner.display_name AS owner_name, owner.email AS owner_email
      FROM rental_applications a
      JOIN rental_listings l ON l.id = a.listing_id
      JOIN rental_users requester ON requester.id = a.requester_id
      LEFT JOIN rental_users owner ON owner.id = l.owner_id
      WHERE a.id = $1
      LIMIT 1
    `, [id]);
    const application = rows[0] as Record<string, unknown> | undefined;
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const isOwner = String(application.owner_id || "") === user.id;
    const isRequester = String(application.requester_id || "") === user.id;
    if (!isOwner && !isRequester) return NextResponse.json({ error: "You do not have access to this application." }, { status: 403 });
    if (requestedStatus && ((isOwner && !OWNER_STATUSES.has(requestedStatus)) || (isRequester && requestedStatus !== "withdrawn") || (!isOwner && !isRequester))) {
      return NextResponse.json({ error: isOwner ? "Choose reviewing, approved, or declined." : "A renter can only withdraw an application." }, { status: 403 });
    }
    const readColumn = isOwner ? "owner_read_at" : "requester_read_at";
    const noteColumn = isOwner ? "owner_note" : "requester_note";
    if (requestedStatus) {
      await sql.query(`UPDATE rental_applications SET status = $1, ${noteColumn} = $2, ${readColumn} = NOW(), updated_at = NOW() WHERE id = $3`, [requestedStatus, note, id]);
    } else {
      await sql.query(`UPDATE rental_applications SET ${readColumn} = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    }
    const recipientId = isOwner ? String(application.requester_id || "") : String(application.owner_id || "");
    const listingTitleZh = String(application.title_zh || application.title_en || "房源");
    const listingTitleEn = String(application.title_en || application.title_zh || "your listing");
    const effectiveStatus = requestedStatus || String(application.status || "submitted");
    if (requestedStatus && recipientId) {
      const titleZh = effectiveStatus === "approved" ? "租赁申请已通过" : effectiveStatus === "declined" ? "租赁申请未通过" : effectiveStatus === "withdrawn" ? "租客撤回了申请" : "租赁申请正在审核";
      const titleEn = effectiveStatus === "approved" ? "Rental application approved" : effectiveStatus === "declined" ? "Rental application declined" : effectiveStatus === "withdrawn" ? "Renter withdrew an application" : "Rental application is under review";
      await sql.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'application', $3, $4, $5, $6, '/#messages')
      `, [`notification-${randomUUID()}`, recipientId, titleZh, titleEn, `「${listingTitleZh}」的租赁申请状态已更新。`, `The application for “${listingTitleEn}” was updated.`]);
    }
    if (requestedStatus && emailIsConfigured() && await emailAlertsAllowed(recipientId, "agent_response_alerts")) {
      const recipientEmail = isOwner ? String(application.requester_email || "") : String(application.owner_email || "");
      if (recipientEmail && !recipientEmail.endsWith(".invalid")) {
        try {
          await sendApplicationStatusUpdate({
            recipientEmail,
            recipientName: isOwner ? String(application.requester_name || application.preferred_name || "Renter") : String(application.owner_name || "Listing owner"),
            listingTitle: isOwner ? listingTitleZh : listingTitleEn,
            status: statusLabel(effectiveStatus) as "submitted" | "reviewing" | "approved" | "declined" | "withdrawn",
            note,
            recipientRole: isOwner ? "renter" : "owner",
          });
        } catch {
          // Keep the status change saved if optional email delivery fails.
        }
      }
    }
    return NextResponse.json({ id, status: effectiveStatus, note, readAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "The application could not be updated right now." }, { status: 502 });
  }
}

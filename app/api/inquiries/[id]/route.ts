import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

const ALLOWED_STATUSES = new Set(["sent", "contacted", "tourScheduled", "closed"]);

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
  const body = await request.json().catch(() => ({})) as { status?: unknown; read?: unknown };
  const status = typeof body.status === "string" && ALLOWED_STATUSES.has(body.status) ? body.status : "";
  if (!status && body.read !== true) return NextResponse.json({ error: "Choose a valid inquiry update." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT i.id, i.listing_id, i.requester_id, l.owner_id, l.title_zh, l.title_en,
             u.email AS requester_email
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
    const readColumn = isOwner ? "owner_read_at" : "requester_read_at";
    if (status) {
      await sql.query(`UPDATE rental_inquiries SET status = $1, ${readColumn} = COALESCE(${readColumn}, NOW()), updated_at = NOW() WHERE id = $2`, [status, id]);
      const recipientId = isOwner ? String(inquiry.requester_id || "") : String(inquiry.owner_id || "");
      if (recipientId) {
        const titleZh = status === "tourScheduled" ? "看房时间已安排" : status === "closed" ? "咨询已完成" : "房源咨询有新进展";
        const titleEn = status === "tourScheduled" ? "Tour scheduled" : status === "closed" ? "Inquiry closed" : "Inquiry updated";
        await sql.query(`
          INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
          VALUES ($1, $2, 'inquiry', $3, $4, $5, $6, $7)
        `, [`notification-${crypto.randomUUID()}`, recipientId, titleZh, titleEn, `「${String(inquiry.title_zh || inquiry.title_en || "房源")}」的咨询状态已更新。`, `The inquiry for “${String(inquiry.title_en || inquiry.title_zh || "your listing")}” was updated.`, "/#messages"]);
      }
    } else {
      await sql.query(`UPDATE rental_inquiries SET ${readColumn} = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    }
    return NextResponse.json({ id, status: status || undefined, readAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "The inquiry could not be updated right now." }, { status: 502 });
  }
}

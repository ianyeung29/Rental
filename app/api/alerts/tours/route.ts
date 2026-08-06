import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { emailIsConfigured, sendTourReminder } from "../../../lib/email";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : request.headers.get("x-cron-secret")?.trim() || "";
  if (!configuredSecret || suppliedSecret !== configuredSecret) return NextResponse.json({ error: "Tour reminders are not authorized." }, { status: 503 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT i.id, i.tour_scheduled_at, i.tour_timezone, i.tour_note,
             l.title_zh, l.title_en,
             requester.id AS requester_id, requester.display_name AS requester_name, requester.email AS requester_email,
             owner.id AS owner_id, owner.display_name AS owner_name, owner.email AS owner_email
      FROM rental_inquiries i
      JOIN rental_listings l ON l.id = i.listing_id
      JOIN rental_users requester ON requester.id = i.requester_id
      LEFT JOIN rental_users owner ON owner.id = l.owner_id
      WHERE i.status = 'tourScheduled'
        AND i.tour_scheduled_at > NOW()
        AND i.tour_scheduled_at <= NOW() + INTERVAL '26 hours'
        AND i.tour_reminder_sent_at IS NULL
      ORDER BY i.tour_scheduled_at ASC
      LIMIT 500
    `);
    let processed = 0;
    let sent = 0;
    let emailFailed = 0;
    for (const row of rows as Record<string, unknown>[]) {
      const listingTitleZh = String(row.title_zh || row.title_en || "房源");
      const listingTitleEn = String(row.title_en || row.title_zh || "your listing");
      const scheduledAt = String(row.tour_scheduled_at || "");
      const timeZone = String(row.tour_timezone || "UTC");
      const note = String(row.tour_note || "");
      const recipients = [
        { id: String(row.requester_id || ""), name: String(row.requester_name || "租客"), email: String(row.requester_email || ""), title: listingTitleZh },
        { id: String(row.owner_id || ""), name: String(row.owner_name || "房源发布者"), email: String(row.owner_email || ""), title: listingTitleEn },
      ].filter((recipient, index, list) => recipient.id && list.findIndex((item) => item.id === recipient.id) === index);
      for (const recipient of recipients) {
        await sql.query(`
          INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
          VALUES ($1, $2, 'tourReminder', '看房提醒', 'Tour reminder', $3, $4, '/#messages')
        `, [`notification-${randomUUID()}`, recipient.id, `明天将查看「${listingTitleZh}」，请确认时间安排。`, `Your tour for “${listingTitleEn}” is scheduled for tomorrow. Please confirm the time.`]);
        if (emailIsConfigured() && recipient.email && !recipient.email.endsWith(".invalid")) {
          try {
            await sendTourReminder({ recipientEmail: recipient.email, recipientName: recipient.name, listingTitle: recipient.title, scheduledAt, timeZone, note });
            sent += 1;
          } catch {
            emailFailed += 1;
          }
        }
      }
      await sql.query("UPDATE rental_inquiries SET tour_reminder_sent_at = NOW(), updated_at = NOW() WHERE id = $1", [String(row.id)]);
      processed += 1;
    }
    return NextResponse.json({ ok: true, processed, sent, emailFailed, configuredEmail: emailIsConfigured() });
  } catch {
    return NextResponse.json({ error: "Tour reminders could not be processed right now." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { recordAuditEventSafely } from "../../lib/audit";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { emailIsConfigured, sendInquiryConfirmation, sendInquiryNotification } from "../../lib/email";
import { emailAlertsAllowed } from "../../lib/notification-preferences";
import { sendPushToUser } from "../../lib/push";
import { isExactOccupantCount } from "../../lib/renter-options";

const MAX_BODY_LENGTH = 4_000;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateTime(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function inquiryFromRow(row: Record<string, unknown>, received: boolean) {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    listingTitle: String(row.title_zh || row.title_en || "房源咨询"),
    sentAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
    moveIn: String(row.move_in || ""),
    leaseLength: String(row.lease_length || ""),
    occupants: String(row.occupants || ""),
    pets: String(row.pets || ""),
    tourPreference: String(row.tour_preference || ""),
    tourScheduledAt: dateTime(row.tour_scheduled_at),
    tourTimeZone: String(row.tour_timezone || "UTC"),
    tourNote: String(row.tour_note || ""),
    addressRevealStatus: String(row.address_reveal_status || "hidden"),
    addressRevealedAt: dateTime(row.address_revealed_at),
    message: String(row.message || ""),
    status: String(row.status || "sent"),
    readAt: (received ? row.owner_read_at : row.requester_read_at) instanceof Date
      ? (received ? row.owner_read_at as Date : row.requester_read_at as Date).toISOString()
      : (received ? row.owner_read_at : row.requester_read_at) ? String(received ? row.owner_read_at : row.requester_read_at) : null,
    ...(received ? { requesterName: String(row.requester_name || ""), requesterEmail: String(row.requester_email || "") } : {}),
    ...(!received && row.revealed_address ? { revealedAddress: String(row.revealed_address) } : {}),
  };
}

export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to view inquiries." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before viewing inquiries." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const received = new URL(request.url).searchParams.get("scope") === "received";
  try {
    await ensureDatabaseSchema();
    const rows = received
      ? await sql.query(`
          SELECT i.id, i.listing_id, i.move_in, i.lease_length, i.occupants, i.pets,
                 i.tour_preference, i.tour_scheduled_at, i.tour_timezone, i.tour_note, i.address_reveal_status, i.address_revealed_at, i.message, i.status, i.owner_read_at, i.requester_read_at, i.created_at,
                 l.title_zh, l.title_en, u.display_name AS requester_name, u.email AS requester_email
          FROM rental_inquiries i
          JOIN rental_listings l ON l.id = i.listing_id
          JOIN rental_users u ON u.id = i.requester_id
          WHERE l.owner_id = $1
          ORDER BY i.created_at DESC
        `, [user.id])
      : await sql.query(`
          SELECT i.id, i.listing_id, i.move_in, i.lease_length, i.occupants, i.pets,
                 i.tour_preference, i.tour_scheduled_at, i.tour_timezone, i.tour_note, i.address_reveal_status, i.address_revealed_at,
                 CASE WHEN i.address_reveal_status = 'revealed' THEN pd.private_address ELSE '' END AS revealed_address,
                 i.message, i.status, i.owner_read_at, i.requester_read_at, i.created_at, l.title_zh, l.title_en
          FROM rental_inquiries i
          JOIN rental_listings l ON l.id = i.listing_id
          LEFT JOIN rental_listing_private_details pd ON pd.listing_id = i.listing_id
          WHERE i.requester_id = $1
          ORDER BY i.created_at DESC
        `, [user.id]);
    return NextResponse.json(rows.map((row) => inquiryFromRow(row as Record<string, unknown>, received)));
  } catch {
    return NextResponse.json({ error: "Inquiries could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before sending an inquiry." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before sending an inquiry." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Inquiry is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const listingId = text(body.listingId, 120);
    const moveIn = text(body.moveIn, 80);
    const leaseLength = text(body.leaseLength, 40);
    const occupants = text(body.occupants, 20);
    const pets = text(body.pets, 40);
    const tourPreference = text(body.tourPreference, 40);
    const message = text(body.message, 1_000);
    if (!listingId || !moveIn || !leaseLength || !occupants || !pets || !tourPreference) return NextResponse.json({ error: "Complete the inquiry details first." }, { status: 400 });
    if (!isExactOccupantCount(occupants)) return NextResponse.json({ error: "Choose the exact number of occupants." }, { status: 400 });
    await ensureDatabaseSchema();
    const listingRows = await sql.query(`
      SELECT l.id, l.owner_id, l.title_zh, l.title_en, pd.contact_name, pd.contact_email
      FROM rental_listings l
      LEFT JOIN rental_listing_private_details pd ON pd.listing_id = l.id
      WHERE l.id = $1 AND l.status = 'published' AND l.moderation_status = 'approved' AND (l.expires_on IS NULL OR l.expires_on >= CURRENT_DATE)
      LIMIT 1
    `, [listingId]);
    const listing = listingRows[0] as Record<string, unknown> | undefined;
    if (!listing) return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
    if (String(listing.owner_id || "") === user.id) return NextResponse.json({ error: "You cannot inquire about your own listing." }, { status: 400 });
    const id = `inquiry-${randomUUID()}`;
    await sql.query(`
      INSERT INTO rental_inquiries (id, listing_id, requester_id, move_in, lease_length, occupants, pets, tour_preference, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, listingId, user.id, moveIn, leaseLength, occupants, pets, tourPreference, message]);
    await recordAuditEventSafely({ request, eventType: "inquiry.create", user, metadata: { inquiryId: id, listingId, tourPreference } });
    if (listing.owner_id && String(listing.owner_id) !== user.id) {
      await sql.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'inquiry', '收到新的房源咨询', 'New listing inquiry', $3, $4, '/#messages')
      `, [`notification-${randomUUID()}`, String(listing.owner_id), `有人咨询了「${String(listing.title_zh || listing.title_en || "你的房源")}」。`, `Someone sent an inquiry about “${String(listing.title_en || listing.title_zh || "your listing")}".`]);
      await sendPushToUser(String(listing.owner_id), {
        title: "安居 / Anjurentals",
        body: `有人咨询了「${String(listing.title_zh || listing.title_en || "你的房源")}」。 / New inquiry about your listing.`,
        url: "/#messages",
        tag: `inquiry-${id}`,
      }).catch(() => undefined);
    }
    const emailInput = {
      recipientEmail: String(listing.contact_email || ""),
      recipientName: String(listing.contact_name || "房源发布者"),
      listingTitle: String(listing.title_zh || listing.title_en || "房源咨询"),
      requesterName: user.displayName,
      requesterEmail: user.email,
      moveIn,
      leaseLength,
      occupants,
       pets,
       tourPreference,
       tourScheduledAt: null,
       tourTimeZone: "UTC",
       tourNote: "",
       message,
    };
    let notificationSent = false;
    let confirmationSent = false;
    if (emailIsConfigured()) {
      if (listing.owner_id && await emailAlertsAllowed(String(listing.owner_id), "inquiry_alerts") && emailInput.recipientEmail && !emailInput.recipientEmail.endsWith(".invalid")) {
        try {
          await sendInquiryNotification(emailInput);
          notificationSent = true;
        } catch {
          // The inquiry is already stored; email delivery can be retried after configuration is fixed.
        }
      }
      if (await emailAlertsAllowed(user.id, "inquiry_alerts")) try {
        await sendInquiryConfirmation({ ...emailInput, recipientEmail: user.email, recipientName: user.displayName });
        confirmationSent = true;
      } catch {
        // The inquiry is already stored; email delivery can be retried after configuration is fixed.
      }
    }
    return NextResponse.json({
      id,
      listingId,
      listingTitle: String(listing.title_zh || listing.title_en || "房源咨询"),
      sentAt: new Date().toISOString(),
      moveIn,
      leaseLength,
      occupants,
      pets,
      tourPreference,
      tourScheduledAt: null,
      tourTimeZone: "UTC",
      tourNote: "",
      addressRevealStatus: "hidden",
      addressRevealedAt: null,
      message,
      status: "sent",
      notificationSent,
      confirmationSent,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The inquiry could not be sent right now." }, { status: 502 });
  }
}

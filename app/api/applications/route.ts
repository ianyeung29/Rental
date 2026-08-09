import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { emailIsConfigured, sendApplicationNotification, sendApplicationStatusUpdate } from "../../lib/email";
import { emailAlertsAllowed } from "../../lib/notification-preferences";
import { sendPushToUser } from "../../lib/push";
import { isExactOccupantCount } from "../../lib/renter-options";
import { applicationFieldsForSharing, normalizeRenterProfileSharing, type RenterProfileShareOptions } from "../../lib/renter-application";

const MAX_BODY_LENGTH = 8_000;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateTime(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : "";
}

function applicationEvents(value: unknown, fallback: { id: string; status: string; createdAt: string }) {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  const events = Array.isArray(raw) ? raw.filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === "object") : [];
  if (events.length === 0 && fallback.createdAt) return [{ id: `legacy-${fallback.id}`, status: fallback.status, note: "", actorRole: "renter", createdAt: fallback.createdAt }];
  return events.map((event) => ({
    id: String(event.id || `event-${fallback.id}`),
    status: String(event.status || fallback.status),
    note: String(event.note || ""),
    actorRole: event.actorRole === "owner" ? "owner" : "renter",
    createdAt: dateTime(event.createdAt),
  }));
}

function applicationFromRow(row: Record<string, unknown>, received: boolean) {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    listingTitle: String(row.title_zh || row.title_en || "Rental listing"),
    listingTitleEn: String(row.title_en || row.title_zh || "Rental listing"),
    listingArea: String(row.area_zh || row.area_en || ""),
    listingAreaEn: String(row.area_en || row.area_zh || ""),
    preferredName: String(row.preferred_name || ""),
    phone: String(row.phone || ""),
    currentCity: String(row.current_city || ""),
    moveIn: String(row.move_in || ""),
    leaseLength: String(row.lease_length || ""),
    occupants: String(row.occupants || ""),
    pets: String(row.pets || ""),
    employmentStatus: String(row.employment_status || ""),
    incomeRange: String(row.income_range || ""),
    message: String(row.message || ""),
    status: String(row.status || "submitted"),
    ownerNote: String(row.owner_note || ""),
    requesterNote: String(row.requester_note || ""),
    submittedAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
    ownerReadAt: dateTime(row.owner_read_at),
    requesterReadAt: dateTime(row.requester_read_at),
    unread: received ? !row.owner_read_at : !row.requester_read_at,
    events: applicationEvents(row.events, { id: String(row.id), status: String(row.status || "submitted"), createdAt: dateTime(row.created_at) }),
    ...(received
      ? { applicantName: String(row.requester_name || row.preferred_name || ""), applicantEmail: String(row.requester_email || "") }
      : { ownerName: String(row.owner_name || ""), ownerEmail: String(row.owner_email || "") }),
  };
}

async function currentApplicant() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in before using rental applications." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before using rental applications." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user, db: sql };
}

const APPLICATION_SELECT = `
  SELECT a.id, a.listing_id, a.requester_id, a.preferred_name, a.phone, a.move_in,
         a.current_city, a.lease_length, a.occupants, a.pets, a.employment_status, a.income_range,
         a.message, a.status, a.owner_note, a.requester_note, a.owner_read_at, a.requester_read_at,
         a.created_at, a.updated_at,
         l.title_zh, l.title_en, l.area_zh, l.area_en,
         owner.display_name AS owner_name, owner.email AS owner_email,
         requester.display_name AS requester_name, requester.email AS requester_email,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', e.id,
             'status', e.status,
             'note', e.note,
             'actorRole', e.actor_role,
             'createdAt', e.created_at
           ) ORDER BY e.created_at ASC)
           FROM rental_application_events e
           WHERE e.application_id = a.id
         ), '[]'::json) AS events
  FROM rental_applications a
  JOIN rental_listings l ON l.id = a.listing_id
  LEFT JOIN rental_users owner ON owner.id = l.owner_id
  JOIN rental_users requester ON requester.id = a.requester_id
`;

export async function GET(request: Request) {
  const context = await currentApplicant();
  if (context.error) return context.error;
  const scope = new URL(request.url).searchParams.get("scope");
  try {
    await ensureDatabaseSchema();
    const submittedRows = scope === "received" ? [] : await context.db.query(`${APPLICATION_SELECT} WHERE a.requester_id = $1 ORDER BY a.updated_at DESC`, [context.user.id]);
    const receivedRows = scope === "submitted" ? [] : await context.db.query(`${APPLICATION_SELECT} WHERE l.owner_id = $1 ORDER BY a.updated_at DESC`, [context.user.id]);
    if (scope === "received") return NextResponse.json({ received: receivedRows.map((row) => applicationFromRow(row as Record<string, unknown>, true)) });
    if (scope === "submitted") return NextResponse.json({ submitted: submittedRows.map((row) => applicationFromRow(row as Record<string, unknown>, false)) });
    return NextResponse.json({
      submitted: submittedRows.map((row) => applicationFromRow(row as Record<string, unknown>, false)),
      received: receivedRows.map((row) => applicationFromRow(row as Record<string, unknown>, true)),
    });
  } catch {
    return NextResponse.json({ error: "Applications could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const context = await currentApplicant();
  if (context.error) return context.error;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Application details are too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const listingId = text(body.listingId, 120);
    const inquiryId = text(body.inquiryId, 120);
    const preferredName = text(body.preferredName, 100);
    const phone = text(body.phone, 40);
    const moveIn = text(body.moveIn, 80);
    const leaseLength = text(body.leaseLength, 40);
    const occupants = text(body.occupants, 20);
    const pets = text(body.pets, 40);
    const employmentStatus = text(body.employmentStatus, 40);
    const incomeRange = text(body.incomeRange, 40);
    const message = text(body.message, 1_000);
    const currentCity = text(body.currentCity, 100);
    const sharing: RenterProfileShareOptions = normalizeRenterProfileSharing(body);
    const sharedFields = applicationFieldsForSharing({ currentCity, employmentStatus, incomeRange }, sharing);
    if (!listingId || !preferredName || !phone || !moveIn || !leaseLength || !occupants || !pets) return NextResponse.json({ error: "Complete the required application details first." }, { status: 400 });
    if (!isExactOccupantCount(occupants)) return NextResponse.json({ error: "Choose the exact number of occupants." }, { status: 400 });
    await ensureDatabaseSchema();
    const listingRows = await context.db.query(`
      SELECT l.id, l.owner_id, l.title_zh, l.title_en, l.area_zh, l.area_en,
             owner.display_name AS owner_name, owner.email AS owner_email,
             pd.contact_name, pd.contact_email
      FROM rental_listings l
      LEFT JOIN rental_users owner ON owner.id = l.owner_id
      LEFT JOIN rental_listing_private_details pd ON pd.listing_id = l.id
      WHERE l.id = $1 AND l.status = 'published' AND l.moderation_status = 'approved'
        AND (l.expires_on IS NULL OR l.expires_on >= CURRENT_DATE)
      LIMIT 1
    `, [listingId]);
    const listing = listingRows[0] as Record<string, unknown> | undefined;
    if (!listing) return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
    if (String(listing.owner_id || "") === context.user.id) return NextResponse.json({ error: "You cannot apply to your own listing." }, { status: 400 });
    if (inquiryId) {
      const inquiryRows = await context.db.query("SELECT id FROM rental_inquiries WHERE id = $1 AND listing_id = $2 AND requester_id = $3 LIMIT 1", [inquiryId, listingId, context.user.id]);
      if (!inquiryRows[0]) return NextResponse.json({ error: "The linked inquiry could not be verified." }, { status: 400 });
    }
    await context.db.query(`
      INSERT INTO rental_renter_profiles (
        user_id, preferred_name, phone, current_city, employment_status, income_range,
        household_size, pets, move_in, lease_length,
        share_current_city, share_employment, share_income, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (user_id) DO UPDATE SET
        preferred_name = EXCLUDED.preferred_name,
        phone = EXCLUDED.phone,
        current_city = EXCLUDED.current_city,
        employment_status = EXCLUDED.employment_status,
        income_range = EXCLUDED.income_range,
        household_size = EXCLUDED.household_size,
        pets = EXCLUDED.pets,
        move_in = EXCLUDED.move_in,
        lease_length = EXCLUDED.lease_length,
        share_current_city = EXCLUDED.share_current_city,
        share_employment = EXCLUDED.share_employment,
        share_income = EXCLUDED.share_income,
        updated_at = NOW()
    `, [context.user.id, preferredName, phone, currentCity, employmentStatus, incomeRange, occupants, pets, moveIn, leaseLength, sharing.shareCurrentCity, sharing.shareEmployment, sharing.shareIncome, ""]);
    const applicationId = `application-${randomUUID()}`;
    const rows = await context.db.query(`
      INSERT INTO rental_applications (
        id, listing_id, requester_id, inquiry_id, preferred_name, phone, move_in,
        current_city, lease_length, occupants, pets, employment_status, income_range, message,
        status, owner_note, requester_note, owner_read_at, requester_read_at
      ) VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'submitted', '', '', NULL, NOW())
      ON CONFLICT (listing_id, requester_id) DO UPDATE SET
        inquiry_id = COALESCE(EXCLUDED.inquiry_id, rental_applications.inquiry_id),
        preferred_name = EXCLUDED.preferred_name,
        phone = EXCLUDED.phone,
        current_city = EXCLUDED.current_city,
        move_in = EXCLUDED.move_in,
        lease_length = EXCLUDED.lease_length,
        occupants = EXCLUDED.occupants,
        pets = EXCLUDED.pets,
        employment_status = EXCLUDED.employment_status,
        income_range = EXCLUDED.income_range,
        message = EXCLUDED.message,
        status = 'submitted',
        owner_note = '',
        requester_note = '',
        owner_read_at = NULL,
        requester_read_at = NOW(),
        updated_at = NOW()
      RETURNING id
    `, [applicationId, listingId, context.user.id, inquiryId, preferredName, phone, sharedFields.currentCity, moveIn, leaseLength, occupants, pets, sharedFields.employmentStatus, sharedFields.incomeRange, message]);
    const savedId = String(rows[0]?.id || applicationId);
    await context.db.query(`
      INSERT INTO rental_application_events (id, application_id, actor_id, actor_role, status, note)
      VALUES ($1, $2, $3, 'renter', 'submitted', '')
    `, [`application-event-${randomUUID()}`, savedId, context.user.id]);
    if (listing.owner_id && String(listing.owner_id) !== context.user.id) {
      await context.db.query(`
        INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
        VALUES ($1, $2, 'application', '收到新的租赁申请', 'New rental application', $3, $4, '/#messages')
      `, [`notification-${randomUUID()}`, String(listing.owner_id), `有人申请了「${String(listing.title_zh || listing.title_en || "你的房源")}」。`, `Someone applied to “${String(listing.title_en || listing.title_zh || "your listing")}".`]);
      await sendPushToUser(String(listing.owner_id), {
        title: "安居 / Anjurentals",
        body: `有人申请了「${String(listing.title_zh || listing.title_en || "你的房源")}」。 / New rental application received.`,
        url: "/#messages",
        tag: `application-${savedId}`,
      }).catch(() => undefined);
    }
    const savedRows = await context.db.query(`${APPLICATION_SELECT} WHERE a.id = $1 LIMIT 1`, [savedId]);
    const application = savedRows[0] ? applicationFromRow(savedRows[0] as Record<string, unknown>, false) : { id: savedId, listingId, listingTitle: String(listing.title_zh || listing.title_en || "Rental listing"), status: "submitted" };
    let notificationSent = false;
    let confirmationSent = false;
    if (emailIsConfigured()) {
      const ownerEmail = String(listing.contact_email || listing.owner_email || "");
      if (await emailAlertsAllowed(String(listing.owner_id || ""), "inquiry_alerts") && ownerEmail && !ownerEmail.endsWith(".invalid")) {
        try {
          await sendApplicationNotification({
            recipientEmail: ownerEmail,
            recipientName: String(listing.contact_name || listing.owner_name || "Listing owner"),
            listingTitle: String(listing.title_zh || listing.title_en || "Rental listing"),
            listingArea: String(listing.area_zh || listing.area_en || ""),
            applicantName: preferredName,
            applicantEmail: context.user.email,
            phone,
            currentCity: sharedFields.currentCity,
            moveIn,
            leaseLength,
            occupants,
            pets,
            employmentStatus: sharedFields.employmentStatus,
            incomeRange: sharedFields.incomeRange,
            message,
          });
          notificationSent = true;
        } catch {
          // Keep the application saved; the owner can still see it in the dashboard.
        }
      }
      if (await emailAlertsAllowed(context.user.id, "inquiry_alerts")) try {
        await sendApplicationStatusUpdate({
          recipientEmail: context.user.email,
          recipientName: preferredName,
          listingTitle: String(listing.title_zh || listing.title_en || "Rental listing"),
          status: "submitted",
          note: "",
          recipientRole: "renter",
        });
        confirmationSent = true;
      } catch {
        // Keep the application saved if optional email delivery fails.
      }
    }
    return NextResponse.json({ application, notificationSent, confirmationSent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The rental application could not be submitted right now." }, { status: 502 });
  }
}

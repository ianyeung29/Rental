import { NextResponse } from "next/server";
import { ensureDatabaseSchema, sql } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { emailIsConfigured, sendAgentRequestResponse } from "../../../lib/email";
import { emailAlertsAllowed } from "../../../lib/notification-preferences";

const MAX_BODY_LENGTH = 2_000;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function feeLabel(row: Record<string, unknown>) {
  if (String(row.fee_plan || "") === "firstMonthRent") return "成交后支付一个月租金";
  if (String(row.fee_plan || "") === "flatFee") return `固定 $${Number(row.fee_amount || 0).toLocaleString("en-US")}`;
  return "请经纪报价";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before responding to an agent request." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before responding to an agent request." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "The agent response is too large." }, { status: 413 });
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Please send a valid agent response." }, { status: 400 });
  }

  const status = body.status === "accepted" || body.status === "declined" ? body.status : "";
  if (!status) return NextResponse.json({ error: "Choose accept or decline." }, { status: 400 });
  const agentNote = text(body.agentNote, 1_000);

  try {
    await ensureDatabaseSchema();
    const requestRows = await sql.query(`
      SELECT ar.id, ar.listing_id, ar.owner_id, ar.fee_plan, ar.fee_amount, ar.status,
             l.title_zh, l.title_en, l.area_zh, l.area_en,
             owner.display_name AS owner_name, owner.email AS owner_email,
             ap.display_name_zh AS agent_profile_name_zh, ap.display_name_en AS agent_profile_name_en
      FROM rental_agent_requests ar
      JOIN rental_listings l ON l.id = ar.listing_id
      JOIN rental_users owner ON owner.id = ar.owner_id
      JOIN rental_agent_profiles ap ON ap.id = ar.agent_profile_id
      WHERE ar.id = $1 AND ap.user_id = $2 AND ap.is_active = TRUE AND ar.status = 'pending'
      LIMIT 1
    `, [id, user.id]);
    const agentRequest = requestRows[0] as Record<string, unknown> | undefined;
    if (!agentRequest) return NextResponse.json({ error: "This request is no longer available for response." }, { status: 404 });

    const updatedRows = await sql.query(`
      UPDATE rental_agent_requests
      SET status = $1, agent_note = $2, responded_at = NOW(), updated_at = NOW()
      WHERE id = $3 AND status = 'pending'
      RETURNING id, status, agent_note, responded_at, updated_at
    `, [status, agentNote, id]);
    if (updatedRows.length === 0) return NextResponse.json({ error: "This request was already updated." }, { status: 409 });

    let notificationSent = false;
    const ownerEmail = String(agentRequest.owner_email || "");
    if (emailIsConfigured() && await emailAlertsAllowed(String(agentRequest.owner_id || ""), "agent_response_alerts") && ownerEmail && !ownerEmail.endsWith(".invalid")) {
      try {
        await sendAgentRequestResponse({
          recipientEmail: ownerEmail,
          recipientName: String(agentRequest.owner_name || "房主"),
          listingTitle: String(agentRequest.title_zh || agentRequest.title_en || "房源"),
          listingArea: String(agentRequest.area_zh || agentRequest.area_en || ""),
          ownerName: String(agentRequest.owner_name || "房主"),
          ownerEmail: user.email,
          agentName: String(agentRequest.agent_profile_name_zh || agentRequest.agent_profile_name_en || user.displayName),
          feeLabel: feeLabel(agentRequest),
          status,
          agentNote,
        });
        notificationSent = true;
      } catch {
        // The response is already stored; email can be retried after configuration is fixed.
      }
    }
    return NextResponse.json({
      id,
      listingId: String(agentRequest.listing_id),
      status,
      agentNote,
      respondedAt: new Date().toISOString(),
      notificationSent,
    });
  } catch {
    return NextResponse.json({ error: "The agent request could not be updated right now." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";

function requestFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    listingTitleZh: String(row.title_zh || ""),
    listingTitleEn: String(row.title_en || ""),
    listingAreaZh: String(row.area_zh || ""),
    listingAreaEn: String(row.area_en || ""),
    ownerName: String(row.owner_name || ""),
    ownerEmail: String(row.owner_email || ""),
    agentProfileId: row.agent_profile_id ? String(row.agent_profile_id) : null,
    agentProfileNameZh: row.agent_profile_name_zh ? String(row.agent_profile_name_zh) : null,
    agentProfileNameEn: row.agent_profile_name_en ? String(row.agent_profile_name_en) : null,
    feePlan: String(row.fee_plan || "agentQuote"),
    feeAmount: row.fee_amount == null ? null : Number(row.fee_amount),
    status: String(row.status || "pending"),
    ownerNote: String(row.owner_note || ""),
    agentNote: String(row.agent_note || ""),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to view agent requests." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before viewing agent requests." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });

  const incoming = new URL(request.url).searchParams.get("scope") === "incoming";
  try {
    await ensureDatabaseSchema();
    if (incoming) {
      const profileRows = await sql.query("SELECT id FROM rental_agent_profiles WHERE user_id = $1 AND is_active = TRUE LIMIT 1", [user.id]);
      if (profileRows.length === 0) return NextResponse.json({ canManage: false, requests: [] });
      const rows = await sql.query(`
        SELECT ar.id, ar.listing_id, ar.agent_profile_id, ar.fee_plan, ar.fee_amount, ar.status,
               ar.owner_note, ar.agent_note, ar.created_at, ar.updated_at,
               l.title_zh, l.title_en, l.area_zh, l.area_en,
               owner.display_name AS owner_name, owner.email AS owner_email,
               ap.display_name_zh AS agent_profile_name_zh, ap.display_name_en AS agent_profile_name_en
        FROM rental_agent_requests ar
        JOIN rental_listings l ON l.id = ar.listing_id
        JOIN rental_users owner ON owner.id = ar.owner_id
        JOIN rental_agent_profiles ap ON ap.id = ar.agent_profile_id
        WHERE ap.user_id = $1 AND ap.is_active = TRUE
        ORDER BY CASE WHEN ar.status = 'pending' THEN 0 ELSE 1 END, ar.updated_at DESC
      `, [user.id]);
      return NextResponse.json({ canManage: true, requests: rows.map((row) => requestFromRow(row as Record<string, unknown>)) });
    }

    const rows = await sql.query(`
      SELECT ar.id, ar.listing_id, ar.agent_profile_id, ar.fee_plan, ar.fee_amount, ar.status,
             ar.owner_note, ar.agent_note, ar.created_at, ar.updated_at,
             l.title_zh, l.title_en, l.area_zh, l.area_en,
             owner.display_name AS owner_name, owner.email AS owner_email,
             ap.display_name_zh AS agent_profile_name_zh, ap.display_name_en AS agent_profile_name_en
      FROM rental_agent_requests ar
      JOIN rental_listings l ON l.id = ar.listing_id
      JOIN rental_users owner ON owner.id = ar.owner_id
      LEFT JOIN rental_agent_profiles ap ON ap.id = ar.agent_profile_id
      WHERE ar.owner_id = $1
      ORDER BY ar.updated_at DESC
    `, [user.id]);
    return NextResponse.json(rows.map((row) => requestFromRow(row as Record<string, unknown>)));
  } catch {
    return NextResponse.json({ error: "Agent requests could not be loaded right now." }, { status: 502 });
  }
}

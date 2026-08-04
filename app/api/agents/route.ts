import { NextResponse } from "next/server";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toAgentProfile(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    displayNameZh: String(row.display_name_zh || ""),
    displayNameEn: String(row.display_name_en || ""),
    brokerage: String(row.brokerage || ""),
    licenseState: String(row.license_state || ""),
    licenseNumber: String(row.license_number || ""),
    serviceAreas: stringList(row.service_areas),
    languages: stringList(row.languages),
    feeSummaryZh: String(row.fee_summary_zh || ""),
    feeSummaryEn: String(row.fee_summary_en || ""),
    isVerified: row.is_verified === true,
    isSample: row.is_sample === true,
  };
}

export async function GET() {
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in before viewing agent profiles." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before viewing agent profiles." }, { status: 403 });

  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT id, display_name_zh, display_name_en, brokerage, license_state, license_number,
             service_areas, languages, fee_summary_zh, fee_summary_en, is_verified, is_sample
      FROM rental_agent_profiles
      WHERE is_active = TRUE
      ORDER BY is_verified DESC, display_name_zh ASC
    `);
    return NextResponse.json(rows.map((row) => toAgentProfile(row as Record<string, unknown>)));
  } catch {
    return NextResponse.json({ error: "Agent profiles could not be loaded right now." }, { status: 502 });
  }
}

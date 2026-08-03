import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to access moderation." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before accessing moderation." }, { status: 403 });
  if (user.role !== "admin") return NextResponse.json({ error: "Moderation access is restricted." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(`
      SELECT r.id, r.listing_id, r.reason, r.details, r.status, r.created_at, r.updated_at,
             l.title_zh, l.title_en, u.display_name AS reporter_name, u.email AS reporter_email
      FROM rental_listing_reports r
      JOIN rental_listings l ON l.id = r.listing_id
      JOIN rental_users u ON u.id = r.reporter_id
      ORDER BY r.created_at DESC
      LIMIT 100
    `);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "The moderation queue could not be loaded right now." }, { status: 502 });
  }
}

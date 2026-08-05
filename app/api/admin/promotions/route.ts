import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

const STATUSES = new Set(["requested", "active", "completed", "declined"]);

async function adminContext() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to access promotion requests." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before accessing promotion requests." }, { status: 403 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "Promotion access is restricted." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

export async function GET() {
  const context = await adminContext();
  if (context.error) return context.error;
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query(`
      SELECT p.id, p.listing_id, p.package, p.status, p.price_cents, p.note, p.created_at, p.updated_at,
             l.title_zh, l.title_en, l.area_zh, l.area_en, u.display_name AS requester_name, u.email AS requester_email
      FROM rental_listing_promotions p
      JOIN rental_listings l ON l.id = p.listing_id
      JOIN rental_users u ON u.id = p.requester_id
      ORDER BY CASE WHEN p.status = 'requested' THEN 0 ELSE 1 END, p.created_at DESC
      LIMIT 200
    `);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Promotion requests could not be loaded right now." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const context = await adminContext();
  if (context.error) return context.error;
  const body = await request.json().catch(() => ({})) as { id?: unknown; status?: unknown };
  const id = typeof body.id === "string" ? body.id.trim().slice(0, 120) : "";
  const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : "";
  if (!id || !status) return NextResponse.json({ error: "Choose a valid promotion status." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query("UPDATE rental_listing_promotions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, requester_id, listing_id", [status, id]);
    const promotion = rows[0] as Record<string, unknown> | undefined;
    if (!promotion) return NextResponse.json({ error: "Promotion request not found." }, { status: 404 });
    await sql!.query(`
      INSERT INTO rental_notifications (id, user_id, type, title_zh, title_en, body_zh, body_en, link)
      VALUES ($1, $2, 'promotion', $3, $4, $5, $6, '/#top')
    `, [`notification-${crypto.randomUUID()}`, String(promotion.requester_id), status === "active" ? "推广申请已通过" : status === "declined" ? "推广申请未通过" : "推广状态已更新", status === "active" ? "Promotion request approved" : status === "declined" ? "Promotion request declined" : "Promotion status updated", `你的房源推广申请状态已更新为：${status}。`, `Your listing promotion request is now ${status}.`]);
    return NextResponse.json({ id, status });
  } catch {
    return NextResponse.json({ error: "Promotion status could not be updated right now." }, { status: 502 });
  }
}

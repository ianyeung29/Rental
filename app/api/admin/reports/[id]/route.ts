import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../../lib/db";

const STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { status?: unknown };
  const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : "";
  if (!status) return NextResponse.json({ error: "Choose a valid report status." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql.query(
      "UPDATE rental_listing_reports SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status",
      [status, id],
    );
    if (rows.length === 0) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    return NextResponse.json({ id, status });
  } catch {
    return NextResponse.json({ error: "The report status could not be updated." }, { status: 502 });
  }
}

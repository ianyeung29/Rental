import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../../lib/db";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to delete reply templates." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before deleting reply templates." }, { status: 403 });
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 });
  const { id } = await context.params;
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query("DELETE FROM rental_reply_templates WHERE id = $1 AND user_id = $2 RETURNING id", [id.slice(0, 120), user.id]);
    if (rows.length === 0) return NextResponse.json({ error: "Reply template not found." }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "The reply template could not be deleted right now." }, { status: 502 });
  }
}

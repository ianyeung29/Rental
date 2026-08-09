import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";
import { normalizeReplyTemplateInput } from "../../lib/owner-operations";

async function verifiedUser() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage reply templates." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before managing reply templates." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user };
}

function fromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    titleZh: String(row.title_zh || ""),
    titleEn: String(row.title_en || ""),
    bodyZh: String(row.body_zh || ""),
    bodyEn: String(row.body_en || ""),
    isDefault: false,
  };
}

export async function GET() {
  const result = await verifiedUser();
  if (result.error) return result.error;
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query("SELECT id, title_zh, title_en, body_zh, body_en FROM rental_reply_templates WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 30", [result.user.id]);
    return NextResponse.json(rows.map((row) => fromRow(row as Record<string, unknown>)));
  } catch {
    return NextResponse.json({ error: "Reply templates could not be loaded right now." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const result = await verifiedUser();
  if (result.error) return result.error;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const input = normalizeReplyTemplateInput(body);
  if (!input.titleZh || !input.bodyZh) return NextResponse.json({ error: "Add a template name and reply text." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const rows = await sql!.query(`
      INSERT INTO rental_reply_templates (id, user_id, title_zh, title_en, body_zh, body_en)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title_zh, title_en, body_zh, body_en
    `, [`reply-${randomUUID()}`, result.user.id, input.titleZh, input.titleEn, input.bodyZh, input.bodyEn]);
    return NextResponse.json({ template: fromRow(rows[0] as Record<string, unknown>) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The reply template could not be saved right now." }, { status: 502 });
  }
}

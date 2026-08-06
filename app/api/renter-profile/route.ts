import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";
import { ensureDatabaseSchema, sql } from "../../lib/db";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function profileFromRow(row: Record<string, unknown> | undefined, fallback: { displayName: string; phone: string }) {
  return {
    preferredName: text(row?.preferred_name, 100) || fallback.displayName,
    phone: text(row?.phone, 40) || fallback.phone,
    currentCity: text(row?.current_city, 100),
    employmentStatus: text(row?.employment_status, 40),
    incomeRange: text(row?.income_range, 40),
    householdSize: text(row?.household_size, 20) || "1",
    pets: text(row?.pets, 40) || "no",
    moveIn: text(row?.move_in, 80),
    leaseLength: text(row?.lease_length, 40),
    note: text(row?.note, 1_000),
    updatedAt: row?.updated_at instanceof Date ? row.updated_at.toISOString() : String(row?.updated_at || ""),
  };
}

async function currentRenter() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: NextResponse.json({ error: "Account authentication is unavailable right now." }, { status: 502 }) };
  }
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage your renter profile." }, { status: 401 }) };
  if (!user.emailVerified) return { error: NextResponse.json({ error: "Verify your email before saving renter details." }, { status: 403 }) };
  if (!sql) return { error: NextResponse.json({ error: "DATABASE_URL is not configured on the server yet." }, { status: 503 }) };
  return { user, db: sql };
}

export async function GET() {
  const context = await currentRenter();
  if (context.error) return context.error;
  try {
    await ensureDatabaseSchema();
    const rows = await context.db.query(`
      SELECT preferred_name, phone, current_city, employment_status, income_range,
             household_size, pets, move_in, lease_length, note, updated_at
      FROM rental_renter_profiles
      WHERE user_id = $1
      LIMIT 1
    `, [context.user.id]);
    return NextResponse.json({ profile: profileFromRow(rows[0] as Record<string, unknown> | undefined, context.user) });
  } catch {
    return NextResponse.json({ error: "Your renter profile could not be loaded right now." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const context = await currentRenter();
  if (context.error) return context.error;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const profile = {
    preferredName: text(body.preferredName, 100) || context.user.displayName,
    phone: text(body.phone, 40) || context.user.phone,
    currentCity: text(body.currentCity, 100),
    employmentStatus: text(body.employmentStatus, 40),
    incomeRange: text(body.incomeRange, 40),
    householdSize: text(body.householdSize, 20) || "1",
    pets: text(body.pets, 40) || "no",
    moveIn: text(body.moveIn, 80),
    leaseLength: text(body.leaseLength, 40),
    note: text(body.note, 1_000),
  };
  if (profile.preferredName.length < 1 || profile.phone.length < 3) return NextResponse.json({ error: "Add a name and phone number before saving your renter profile." }, { status: 400 });
  try {
    await ensureDatabaseSchema();
    const rows = await context.db.query(`
      INSERT INTO rental_renter_profiles (
        user_id, preferred_name, phone, current_city, employment_status, income_range,
        household_size, pets, move_in, lease_length, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        note = EXCLUDED.note,
        updated_at = NOW()
      RETURNING preferred_name, phone, current_city, employment_status, income_range,
                household_size, pets, move_in, lease_length, note, updated_at
    `, [context.user.id, profile.preferredName, profile.phone, profile.currentCity, profile.employmentStatus, profile.incomeRange, profile.householdSize, profile.pets, profile.moveIn, profile.leaseLength, profile.note]);
    return NextResponse.json({ profile: profileFromRow(rows[0] as Record<string, unknown>, context.user) });
  } catch {
    return NextResponse.json({ error: "Your renter profile could not be saved right now." }, { status: 502 });
  }
}

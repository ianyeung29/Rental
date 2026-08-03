import { NextResponse } from "next/server";
import { AuthError, getCurrentUser } from "../../../lib/auth";

export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentUser() });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account status is unavailable right now." }, { status });
  }
}

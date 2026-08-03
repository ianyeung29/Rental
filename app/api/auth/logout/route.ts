import { NextResponse } from "next/server";
import { clearSessionCookie, destroyCurrentSession } from "../../../lib/auth";

export async function POST() {
  try {
    await destroyCurrentSession();
  } finally {
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  }
}

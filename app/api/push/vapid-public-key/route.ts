import { NextResponse } from "next/server";
import { pushIsConfigured, vapidPublicKey } from "../../../lib/push";

export async function GET() {
  const publicKey = vapidPublicKey();
  if (!pushIsConfigured() || !publicKey) return NextResponse.json({ error: "Browser notifications are not configured yet." }, { status: 503 });
  return NextResponse.json({ publicKey });
}

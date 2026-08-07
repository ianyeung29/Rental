import { NextResponse } from "next/server";
import { purgeExpiredAuditLogs } from "../../../lib/audit";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : request.headers.get("x-cron-secret")?.trim() || "";
  if (!configuredSecret || suppliedSecret !== configuredSecret) return NextResponse.json({ error: "Audit retention is not authorized." }, { status: 503 });
  try {
    const deleted = await purgeExpiredAuditLogs();
    return NextResponse.json({ ok: true, deleted, retentionDays: 30 });
  } catch {
    return NextResponse.json({ error: "Audit retention could not run right now." }, { status: 502 });
  }
}

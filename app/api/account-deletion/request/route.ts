import { NextResponse } from "next/server";
import { AccountDeletionError, requestAccountDeletion } from "../../../lib/account-deletion";
import { recordAuditEventSafely } from "../../../lib/audit";
import { consumeRateLimit, hashRateLimitPart, requestAddress } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  let body: { email?: unknown; website?: unknown; locale?: unknown } = {};
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Enter the email address used for your Anjurentals account." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const website = typeof body.website === "string" ? body.website.trim() : "";
  const locale = body.locale === "en" ? "en" : "zh";
  if (website) return NextResponse.json({ accepted: true });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid account email address." }, { status: 400 });

  try {
    const ipLimit = await consumeRateLimit({ key: `account-delete:request:ip:${hashRateLimitPart(requestAddress(request))}`, limit: 5, windowSeconds: 60 * 60 });
    const emailLimit = await consumeRateLimit({ key: `account-delete:request:email:${hashRateLimitPart(email)}`, limit: 3, windowSeconds: 60 * 60 });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return NextResponse.json({ error: "Please wait before requesting another deletion email." }, { status: 429, headers: { "Retry-After": String(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)) } });
    }
    await requestAccountDeletion(email, locale);
    await recordAuditEventSafely({ request, eventType: "account.deletion_request", metadata: { emailHash: hashRateLimitPart(email) } });
    return NextResponse.json({ accepted: true });
  } catch (error) {
    await recordAuditEventSafely({ request, eventType: "account.deletion_request", outcome: "failure", metadata: { emailHash: hashRateLimitPart(email) } });
    const status = error instanceof AccountDeletionError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account deletion is unavailable right now." }, { status });
  }
}

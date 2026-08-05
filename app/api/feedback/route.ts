import { NextResponse } from "next/server";
import { EmailError, sendSiteFeedbackEmail } from "../../lib/email";

const TYPES = new Set(["experience", "bug", "search", "listing", "other"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 5_000) return NextResponse.json({ error: "反馈内容过长，请缩短后再试。 / Please shorten your feedback." }, { status: 413 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const name = text(body.name, 80);
    const email = text(body.email, 240);
    const type = text(body.type, 40);
    const message = text(body.message, 3_000);
    const pageUrl = text(body.pageUrl, 500);
    const website = text(body.website, 100);

    // The honeypot keeps casual automated submissions quiet without exposing a different response.
    if (website) return NextResponse.json({ ok: true });
    if (!message || (email && !validEmail(email))) return NextResponse.json({ error: "请填写反馈内容；如填写邮箱，请使用有效邮箱。 / Add feedback and a valid email if provided." }, { status: 400 });
    if (!TYPES.has(type)) return NextResponse.json({ error: "请选择反馈类型。 / Choose a feedback type." }, { status: 400 });

    await sendSiteFeedbackEmail({ name, email, type, message, pageUrl });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "提交格式无效，请重试。 / Please try again." }, { status: 400 });
    if (error instanceof EmailError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "暂时无法发送，请稍后重试。 / Please try again later." }, { status: 502 });
  }
}

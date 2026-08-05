import { NextResponse } from "next/server";
import { EmailError, sendSiteContactEmail } from "../../lib/email";

const TOPICS = new Set(["renter", "owner-agent", "safety-privacy", "partnership", "general"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 5_000) return NextResponse.json({ error: "留言内容过长，请缩短后再试。 / Please shorten your message." }, { status: 413 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const name = text(body.name, 80);
    const email = text(body.email, 240);
    const topic = text(body.topic, 40);
    const message = text(body.message, 3_000);
    if (!name || !email || !message || !validEmail(email)) return NextResponse.json({ error: "请填写姓名、有效邮箱和留言。 / Add your name, a valid email, and a message." }, { status: 400 });
    if (!TOPICS.has(topic)) return NextResponse.json({ error: "请选择问题类型。 / Choose a topic." }, { status: 400 });

    await sendSiteContactEmail({ name, email, topic, message });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "提交格式无效，请重试。 / Please try again." }, { status: 400 });
    if (error instanceof EmailError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "暂时无法发送，请稍后重试。 / Please try again later." }, { status: 502 });
  }
}

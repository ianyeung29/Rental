import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_TYPES, createImageUpload, MAX_IMAGE_BYTES } from "../../../lib/r2";
import { getCurrentUser } from "../../../lib/auth";
import { demoModeEnabled } from "../../../lib/demo";

const MAX_BODY_LENGTH = 2_000;

export async function POST(request: Request) {
  try {
    const demoMode = demoModeEnabled();
    const user = demoMode ? null : await getCurrentUser();
    if (!user && !demoMode) return NextResponse.json({ error: "Sign in before uploading listing images." }, { status: 401 });
    if (user && !user.emailVerified) return NextResponse.json({ error: "Verify your email before uploading listing images." }, { status: 403 });
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Upload request is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as { filename?: unknown; contentType?: unknown; size?: unknown };
    const filename = typeof body.filename === "string" ? body.filename.trim().slice(0, 180) : "listing-image.jpg";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : Number(body.size);
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are supported." }, { status: 400 });
    if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Each image must be 8 MB or smaller." }, { status: 400 });
    return NextResponse.json(await createImageUpload({ filename, contentType, size }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not fully configured")) return NextResponse.json({ error: "R2 storage is not configured on the server yet." }, { status: 503 });
    return NextResponse.json({ error: "The image upload service is unavailable right now." }, { status: 502 });
  }
}

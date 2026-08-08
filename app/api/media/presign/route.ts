import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_TYPES, createImageUpload, createListingImageUploads, MAX_IMAGE_BYTES } from "../../../lib/r2";
import { getCurrentUser } from "../../../lib/auth";
import { demoModeEnabled } from "../../../lib/demo";
import { recordApplicationErrorSafely } from "../../../lib/monitoring";

const MAX_BODY_LENGTH = 2_000;

export async function POST(request: Request) {
  try {
    const demoMode = demoModeEnabled();
    const user = demoMode ? null : await getCurrentUser();
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Upload request is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as {
      filename?: unknown;
      contentType?: unknown;
      size?: unknown;
      purpose?: unknown;
      variants?: unknown;
    };
    const purpose = body.purpose === "agentPortrait" ? "agentPortrait" : "listingImage";
    if (purpose === "agentPortrait") {
      if (!user) return NextResponse.json({ error: "Sign in before uploading an agent portrait." }, { status: 401 });
      if (user.accountType !== "agent") return NextResponse.json({ error: "Only agent accounts can upload an agent portrait." }, { status: 403 });
      if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before uploading an agent portrait." }, { status: 403 });
    } else {
      if (!user && !demoMode) return NextResponse.json({ error: "Sign in before uploading listing images." }, { status: 401 });
      if (user && !user.emailVerified) return NextResponse.json({ error: "Verify your email before uploading listing images." }, { status: 403 });
    }
    const filename = typeof body.filename === "string" ? body.filename.trim().slice(0, 180) : "listing-image.jpg";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : Number(body.size);
    if (purpose === "listingImage" && Array.isArray(body.variants)) {
      const variants: Array<{ variant: "display" | "thumbnail"; contentType: string; size: number }> = body.variants.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { variant?: unknown; contentType?: unknown; size?: unknown };
        const variant = record.variant === "display" || record.variant === "thumbnail" ? record.variant : null;
        const itemContentType = typeof record.contentType === "string" ? record.contentType : "";
        const itemSize = typeof record.size === "number" ? record.size : Number(record.size);
        return variant ? [{ variant, contentType: itemContentType, size: itemSize }] : [];
      });
      if (variants.length !== 2 || new Set(variants.map((item) => item.variant)).size !== 2) {
        return NextResponse.json({ error: "A listing image needs one display file and one thumbnail file." }, { status: 400 });
      }
      if (variants.some((item) => !ALLOWED_IMAGE_TYPES.has(item.contentType) || !Number.isFinite(item.size) || item.size <= 0 || item.size > MAX_IMAGE_BYTES)) {
        return NextResponse.json({ error: "Each optimized image must be 8 MB or smaller." }, { status: 400 });
      }
      return NextResponse.json(await createListingImageUploads({ filename, variants }));
    }
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are supported." }, { status: 400 });
    if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Each image must be 8 MB or smaller." }, { status: 400 });
    return NextResponse.json(await createImageUpload({ filename, contentType, size, keyPrefix: purpose === "agentPortrait" && user ? `agents/${user.id}` : "listings" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    await recordApplicationErrorSafely({ source: "r2", route: "/api/media/presign", method: "POST", message: message || "R2 image upload presign failed.", errorName: error instanceof Error ? error.name : "UnknownError", stack: error instanceof Error ? error.stack : "" });
    if (message.includes("not fully configured")) return NextResponse.json({ error: "R2 storage is not configured on the server yet." }, { status: 503 });
    return NextResponse.json({ error: "The image upload service is unavailable right now." }, { status: 502 });
  }
}

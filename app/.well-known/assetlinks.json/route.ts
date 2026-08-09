import { NextResponse } from "next/server";

export function GET() {
  const fingerprint = process.env.ANDROID_APP_SHA256_CERT_FINGERPRINT?.trim();
  const payload = fingerprint ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.anjurentals.app",
      sha256_cert_fingerprints: [fingerprint],
    },
  }] : [];
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
}

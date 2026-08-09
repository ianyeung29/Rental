import { NextResponse } from "next/server";

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const payload = teamId ? {
    applinks: {
      details: [{
        appID: `${teamId}.com.anjurentals.app`,
        paths: ["/listing/*"],
      }],
    },
  } : { applinks: { details: [] } };
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
}

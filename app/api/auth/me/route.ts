import { NextResponse } from "next/server";
import { AuthError, getCurrentUser, updateCurrentUserProfile } from "../../../lib/auth";

export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentUser() });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account status is unavailable right now." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
    const body = await request.json() as { displayName?: unknown; phone?: unknown };
    const displayName = typeof body.displayName === "string" ? body.displayName : currentUser.displayName;
    const phone = typeof body.phone === "string" ? body.phone : currentUser.phone;
    const user = await updateCurrentUserProfile(currentUser.id, { displayName, phone });
    return NextResponse.json({ user });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile could not be updated right now." }, { status });
  }
}

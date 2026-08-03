import { NextResponse } from "next/server";
import { AuthError, getCurrentUser, resendVerificationEmail } from "../../../lib/auth";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in before requesting a verification email." }, { status: 401 });
    const result = await resendVerificationEmail(user.id);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The verification email could not be sent." }, { status });
  }
}

import { NextResponse } from "next/server";
import { AuthError, registerUser, setSessionCookie } from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown; displayName?: unknown };
    const result = await registerUser({
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      displayName: typeof body.displayName === "string" ? body.displayName : "",
    });
    const response = NextResponse.json({ user: result.user, verificationSent: result.verificationSent }, { status: 201 });
    setSessionCookie(response, result.token);
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account creation is unavailable right now." }, { status });
  }
}

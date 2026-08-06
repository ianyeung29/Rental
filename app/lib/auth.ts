import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ensureDatabaseSchema, sql } from "./db";
import { emailIsConfigured, sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { AccountType, AgentVerificationStatus, isVerifiedAgent, normalizeAccountType, normalizeAgentVerificationStatus } from "./account-types";

const SESSION_COOKIE = "rental_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const scryptAsync = promisify(scrypt);

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  role: string;
  accountType: AccountType;
  agentVerificationStatus: AgentVerificationStatus;
  agentVerified: boolean;
  emailVerified: boolean;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function database() {
  if (!sql) throw new AuthError("Database authentication is not configured on the server yet.", 503);
  return sql;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 240);
}

function userFromRow(row: Record<string, unknown>): AuthUser {
  const accountType = normalizeAccountType(row.account_type);
  const agentVerificationStatus = normalizeAgentVerificationStatus(row.agent_verification_status);
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    phone: String(row.phone || ""),
    role: String(row.role || "user"),
    accountType,
    agentVerificationStatus,
    agentVerified: isVerifiedAgent(accountType, agentVerificationStatus),
    emailVerified: Boolean(row.email_verified_at),
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, saltHex, keyHex] = storedHash.split(":");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function createSession(userId: string) {
  const db = database();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.query(
    "INSERT INTO rental_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), userId, tokenHash(token), expiresAt.toISOString()],
  );
  return token;
}

async function createVerificationToken(userId: string) {
  const db = database();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query("DELETE FROM rental_email_verifications WHERE user_id = $1 AND used_at IS NULL", [userId]);
  await db.query(
    "INSERT INTO rental_email_verifications (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), userId, tokenHash(token), expiresAt.toISOString()],
  );
  return token;
}

async function createPasswordResetToken(userId: string) {
  const db = database();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000);
  await db.query("DELETE FROM rental_password_resets WHERE user_id = $1 AND used_at IS NULL", [userId]);
  await db.query(
    "INSERT INTO rental_password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), userId, tokenHash(token), expiresAt.toISOString()],
  );
  return token;
}

async function sendVerificationIfConfigured(email: string, displayName: string, token: string) {
  if (!emailIsConfigured()) return { sent: false, error: "Resend is not configured: set RESEND_API_KEY and RESEND_FROM_EMAIL on the server." };
  try {
    await sendVerificationEmail({ email, displayName, token });
    return { sent: true };
  } catch (error) {
    console.error("[auth] verification email failed", error);
    return { sent: false, error: error instanceof Error ? error.message : "Resend could not send the verification email." };
  }
}

export function setSessionCookie(response: Response, token: string) {
  const mutableResponse = response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } };
  mutableResponse.cookies?.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: Response) {
  const mutableResponse = response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } };
  mutableResponse.cookies?.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function registerUser(input: { email: string; password: string; displayName: string; accountType: AccountType }) {
  await ensureDatabaseSchema();
  const db = database();
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim().slice(0, 80);
  const accountType = normalizeAccountType(input.accountType);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AuthError("Enter a valid email address.");
  if (input.password.length < 8 || input.password.length > 128) throw new AuthError("Use a password between 8 and 128 characters.");
  if (!displayName) throw new AuthError("Enter your name.");
  const existing = await db.query("SELECT id FROM rental_users WHERE email = $1 LIMIT 1", [email]);
  if (existing.length > 0) throw new AuthError("An account with this email already exists.", 409);
  const userId = `user-${randomUUID()}`;
  await db.query(
    "INSERT INTO rental_users (id, email, display_name, password_hash, account_type) VALUES ($1, $2, $3, $4, $5)",
    [userId, email, displayName, await hashPassword(input.password), accountType],
  );
  const verificationToken = await createVerificationToken(userId);
  const verification = await sendVerificationIfConfigured(email, displayName, verificationToken);
  const token = await createSession(userId);
  return {
    token,
    verificationSent: verification.sent,
    verificationError: verification.error,
    user: { id: userId, email, displayName, phone: "", role: "user", accountType, agentVerificationStatus: "unsubmitted", agentVerified: false, emailVerified: false } satisfies AuthUser,
  };
}

export async function loginUser(input: { email: string; password: string }) {
  await ensureDatabaseSchema();
  const db = database();
  const email = normalizeEmail(input.email);
  if (!email || !input.password) throw new AuthError("Enter your email and password.");
  const rows = await db.query("SELECT id, email, display_name, phone, password_hash, role, account_type, agent_verification_status, email_verified_at FROM rental_users WHERE email = $1 LIMIT 1", [email]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row || typeof row.password_hash !== "string" || !(await verifyPassword(input.password, row.password_hash))) throw new AuthError("The email or password is not correct.", 401);
  const token = await createSession(String(row.id));
  return { token, user: userFromRow(row) };
}

export async function loginWithGoogle(input: { subject: string; email: string; displayName: string }, requestedAccountType: AccountType = "user") {
  await ensureDatabaseSchema();
  const db = database();
  const email = normalizeEmail(input.email);
  if (!email || !input.subject) throw new AuthError("Google did not return a complete identity.", 400);
  const bySubject = await db.query("SELECT id, email, display_name, phone, role, account_type, agent_verification_status, email_verified_at, google_subject FROM rental_users WHERE google_subject = $1 LIMIT 1", [input.subject]);
  let row = bySubject[0] as Record<string, unknown> | undefined;
  if (row && normalizeEmail(String(row.email)) !== email) throw new AuthError("This Google identity is linked to a different account.", 409);
  if (!row) {
    const byEmail = await db.query("SELECT id, email, display_name, phone, role, account_type, agent_verification_status, email_verified_at, google_subject FROM rental_users WHERE email = $1 LIMIT 1", [email]);
    row = byEmail[0] as Record<string, unknown> | undefined;
  }
  if (row) {
    if (row.google_subject && String(row.google_subject) !== input.subject) throw new AuthError("This email is linked to another Google identity.", 409);
    await db.query("UPDATE rental_users SET google_subject = $1, email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $2", [input.subject, String(row.id)]);
    const refreshed = await db.query("SELECT id, email, display_name, phone, role, account_type, agent_verification_status, email_verified_at FROM rental_users WHERE id = $1 LIMIT 1", [String(row.id)]);
    row = refreshed[0] as Record<string, unknown> | undefined;
  } else {
    const userId = `user-${randomUUID()}`;
    await db.query(
      "INSERT INTO rental_users (id, email, display_name, password_hash, account_type, email_verified_at, google_subject) VALUES ($1, $2, $3, $4, $5, NOW(), $6)",
      [userId, email, input.displayName.trim().slice(0, 80) || "Google user", `google:${randomUUID()}`, normalizeAccountType(requestedAccountType), input.subject],
    );
    const created = await db.query("SELECT id, email, display_name, phone, role, account_type, agent_verification_status, email_verified_at FROM rental_users WHERE id = $1 LIMIT 1", [userId]);
    row = created[0] as Record<string, unknown> | undefined;
  }
  if (!row) throw new AuthError("Google account setup could not be completed.", 502);
  return { token: await createSession(String(row.id)), user: userFromRow(row) };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureDatabaseSchema();
  const db = database();
  const rows = await db.query(`
    SELECT u.id, u.email, u.display_name, u.phone, u.role, u.account_type, u.agent_verification_status, u.email_verified_at
    FROM rental_sessions s
    JOIN rental_users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
    LIMIT 1
  `, [tokenHash(token)]);
  return rows[0] ? userFromRow(rows[0] as Record<string, unknown>) : null;
}

export async function updateCurrentUserProfile(userId: string, input: { displayName: string; phone: string }) {
  await ensureDatabaseSchema();
  const db = database();
  const displayName = input.displayName.trim().slice(0, 80);
  const phone = input.phone.trim().slice(0, 32);
  if (!displayName) throw new AuthError("Enter your name.");
  const rows = await db.query(`
    UPDATE rental_users
    SET display_name = $1, phone = $2, updated_at = NOW()
    WHERE id = $3
    RETURNING id, email, display_name, phone, role, account_type, agent_verification_status, email_verified_at
  `, [displayName, phone, userId]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AuthError("Account not found.", 404);
  return userFromRow(row);
}

export async function verifyEmailToken(token: string) {
  await ensureDatabaseSchema();
  const db = database();
  const rows = await db.query(`
    SELECT v.id, v.user_id
    FROM rental_email_verifications v
    WHERE v.token_hash = $1 AND v.used_at IS NULL AND v.expires_at > NOW()
    LIMIT 1
  `, [tokenHash(token)]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AuthError("This verification link is invalid or expired.", 400);
  await db.query("UPDATE rental_users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1", [String(row.user_id)]);
  await db.query("UPDATE rental_email_verifications SET used_at = NOW() WHERE id = $1", [String(row.id)]);
}

export async function resendVerificationEmail(userId: string) {
  await ensureDatabaseSchema();
  const db = database();
  const rows = await db.query("SELECT id, email, display_name, email_verified_at FROM rental_users WHERE id = $1 LIMIT 1", [userId]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AuthError("Account not found.", 404);
  if (row.email_verified_at) return { sent: false, alreadyVerified: true };
  const token = await createVerificationToken(userId);
  const verification = await sendVerificationIfConfigured(String(row.email), String(row.display_name), token);
  if (!verification.sent) throw new AuthError(verification.error || "Resend could not send the verification email.", 502);
  return { sent: true, alreadyVerified: false };
}

export async function requestPasswordReset(emailValue: string) {
  await ensureDatabaseSchema();
  const db = database();
  const email = normalizeEmail(emailValue);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { accepted: true };
  const rows = await db.query("SELECT id, email, display_name FROM rental_users WHERE email = $1 LIMIT 1", [email]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return { accepted: true };
  const token = await createPasswordResetToken(String(row.id));
  if (!emailIsConfigured()) {
    console.error("[auth] password reset email skipped because Resend is not configured");
    return { accepted: true };
  }
  try {
    await sendPasswordResetEmail({ email: String(row.email), displayName: String(row.display_name || ""), token });
  } catch (error) {
    console.error("[auth] password reset email failed", error);
  }
  return { accepted: true };
}

export async function resetPasswordWithToken(tokenValue: string, password: string) {
  await ensureDatabaseSchema();
  const db = database();
  const token = tokenValue.trim();
  if (!token) throw new AuthError("This password reset link is invalid or expired.", 400);
  if (password.length < 8 || password.length > 128) throw new AuthError("Use a password between 8 and 128 characters.");
  const rows = await db.query(`
    UPDATE rental_password_resets
    SET used_at = NOW()
    WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
    RETURNING user_id
  `, [tokenHash(token)]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AuthError("This password reset link is invalid or expired.", 400);
  const userId = String(row.user_id);
  await db.query("UPDATE rental_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [await hashPassword(password), userId]);
  await db.query("DELETE FROM rental_sessions WHERE user_id = $1", [userId]);
}

export async function destroyCurrentSession() {
  if (!sql) return;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await sql.query("DELETE FROM rental_sessions WHERE token_hash = $1", [tokenHash(token)]);
}

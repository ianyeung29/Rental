import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sql } from "./db";
import { emailIsConfigured, sendAccountDeletionConfirmationEmail } from "./email";
import { deleteObjectKeys, deleteObjectPrefix } from "./r2";

const DELETION_CONFIRMATION_TTL_MS = 60 * 60 * 1000;

export class AccountDeletionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function database() {
  if (!sql) throw new AccountDeletionError("Account deletion is unavailable because the database is not configured.", 503);
  return sql;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 240);
}

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function timestamp(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : "";
}

function stringValues(value: unknown, values: Set<string>) {
  if (typeof value === "string") {
    values.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => stringValues(item, values));
    return;
  }
  if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach((item) => stringValues(item, values));
}

async function mediaKeysForUser(userId: string) {
  const db = database();
  const [userRows, agentRows, mediaRows] = await Promise.all([
    db.query("SELECT avatar_key FROM rental_users WHERE id = $1 LIMIT 1", [userId]),
    db.query("SELECT portrait_key FROM rental_agent_profiles WHERE user_id = $1 LIMIT 1", [userId]),
    db.query(`
      SELECT m.object_key, m.thumbnail_object_key
      FROM rental_listing_media m
      JOIN rental_listings l ON l.id = m.listing_id
      WHERE l.owner_id = $1
    `, [userId]),
  ]);

  const keys = new Set<string>();
  const avatarKey = String((userRows[0] as Record<string, unknown> | undefined)?.avatar_key || "");
  const portraitKey = String((agentRows[0] as Record<string, unknown> | undefined)?.portrait_key || "");
  if (avatarKey.startsWith(`profiles/${userId}/`)) keys.add(avatarKey);
  if (portraitKey.startsWith(`agents/${userId}/`)) keys.add(portraitKey);
  for (const row of mediaRows as Array<Record<string, unknown>>) {
    const rowKeys = new Set<string>();
    stringValues({ objectKey: row.object_key, thumbnailObjectKey: row.thumbnail_object_key }, rowKeys);
    rowKeys.forEach((key) => { if (key.startsWith("listings/")) keys.add(key); });
  }
  return [...keys];
}

export async function requestAccountDeletion(emailValue: string, locale: "zh" | "en" = "zh") {
  await ensureDatabaseSchema();
  const db = database();
  const email = normalizeEmail(emailValue);
  if (!validEmail(email)) return { accepted: true };
  if (!emailIsConfigured()) throw new AccountDeletionError("The account-deletion email service is not configured. Please contact support instead.", 503);

  const rows = await db.query("SELECT id, email, display_name FROM rental_users WHERE email = $1 LIMIT 1", [email]);
  const user = rows[0] as Record<string, unknown> | undefined;
  if (!user) return { accepted: true };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DELETION_CONFIRMATION_TTL_MS);
  const userId = String(user.id);
  await db.query("DELETE FROM rental_account_deletion_requests WHERE user_id = $1 OR expires_at <= NOW()", [userId]);
  await db.query(
    "INSERT INTO rental_account_deletion_requests (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [`account-delete-${randomUUID()}`, userId, tokenHash(token), expiresAt.toISOString()],
  );
  try {
    await sendAccountDeletionConfirmationEmail({ email: String(user.email), displayName: String(user.display_name || ""), token, locale });
  } catch (error) {
    await db.query("DELETE FROM rental_account_deletion_requests WHERE user_id = $1 AND token_hash = $2", [userId, tokenHash(token)]);
    throw error;
  }
  return { accepted: true };
}

export async function deleteAccountWithConfirmationToken(tokenValue: string) {
  await ensureDatabaseSchema();
  const db = database();
  const token = tokenValue.trim();
  if (!token) throw new AccountDeletionError("This account-deletion link is invalid or expired.", 400);

  const requestRows = await db.query(`
    SELECT r.user_id, r.expires_at, u.email, u.display_name
    FROM rental_account_deletion_requests r
    JOIN rental_users u ON u.id = r.user_id
    WHERE r.token_hash = $1 AND r.expires_at > NOW()
    LIMIT 1
  `, [tokenHash(token)]);
  const request = requestRows[0] as Record<string, unknown> | undefined;
  if (!request) throw new AccountDeletionError("This account-deletion link is invalid or expired. Request a new one to continue.", 400);

  const userId = String(request.user_id);
  const objectKeys = await mediaKeysForUser(userId);
  const result = await db.transaction((tx) => [
    tx.query("DELETE FROM rental_agent_profiles WHERE user_id = $1", [userId]),
    tx.query("DELETE FROM rental_listings WHERE owner_id = $1", [userId]),
    tx.query(`
      UPDATE rental_audit_logs
      SET user_id = NULL, user_email = '', ip_address_encrypted = '', ip_address_hash = ''
      WHERE user_id = $1
    `, [userId]),
    tx.query("DELETE FROM rental_users WHERE id = $1 RETURNING id", [userId]),
  ]);
  const deleted = result[3]?.[0] as Record<string, unknown> | undefined;
  if (!deleted) throw new AccountDeletionError("This account is no longer available. Request a new deletion link if you still need help.", 404);

  try {
    await Promise.all([
      deleteObjectKeys(objectKeys),
      deleteObjectPrefix(`listings/${userId}`),
    ]);
  } catch (error) {
    console.error("[account-deletion] media cleanup failed", { userId, error: error instanceof Error ? error.message : "Unknown error" });
  }

  return {
    email: String(request.email),
    displayName: String(request.display_name || ""),
    requestedAt: timestamp(request.expires_at),
  };
}

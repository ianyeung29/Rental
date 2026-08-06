import webpush, { type PushSubscription } from "web-push";
import { ensureDatabaseSchema, sql } from "./db";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function pushConfig() {
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = (process.env.VAPID_SUBJECT || "mailto:hello@anjurentals.com").trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function pushIsConfigured() {
  return Boolean(pushConfig());
}

export function vapidPublicKey() {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "").trim();
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!sql || !userId) return 0;
  const config = pushConfig();
  if (!config) return 0;
  await ensureDatabaseSchema();
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const rows = await sql.query("SELECT id, endpoint, p256dh, auth FROM rental_push_subscriptions WHERE user_id = $1", [userId]);
  const results = await Promise.allSettled((rows as Record<string, unknown>[]).map(async (row) => {
    const subscription: PushSubscription = {
      endpoint: String(row.endpoint || ""),
      keys: { p256dh: String(row.p256dh || ""), auth: String(row.auth || "") },
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 300 });
      return true;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await sql!.query("DELETE FROM rental_push_subscriptions WHERE id = $1", [String(row.id)]);
      }
      return false;
    }
  }));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}

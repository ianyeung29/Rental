import webpush, { type PushSubscription } from "web-push";
import { GoogleAuth } from "google-auth-library";
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

function firebaseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { project_id?: unknown; client_email?: unknown; private_key?: unknown };
    if (typeof parsed.project_id !== "string" || typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function nativePushIsConfigured() {
  return Boolean(firebaseServiceAccount());
}

async function sendAndroidPushToUser(userId: string, payload: PushPayload) {
  const config = firebaseServiceAccount();
  if (!config || !sql) return 0;
  const auth = new GoogleAuth({ credentials: { client_email: config.clientEmail, private_key: config.privateKey, project_id: config.projectId }, scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) return 0;
  const rows = await sql.query("SELECT id, token FROM rental_native_push_tokens WHERE user_id = $1 AND platform = 'android'", [userId]);
  const results = await Promise.allSettled((rows as Record<string, unknown>[]).map(async (row) => {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token: String(row.token || ""), notification: { title: payload.title, body: payload.body }, data: { url: payload.url || "/", tag: payload.tag || "anjurentals" }, android: { notification: { channel_id: "anjurentals-alerts" } } } }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      if (response.status === 404 || response.status === 410 || /UNREGISTERED|registration-token-not-registered/i.test(errorBody)) {
        await sql!.query("DELETE FROM rental_native_push_tokens WHERE id = $1", [String(row.id)]);
      }
      return false;
    }
    return true;
  }));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!sql || !userId) return 0;
  await ensureDatabaseSchema();
  let delivered = 0;
  const config = pushConfig();
  if (config) {
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
    delivered += results.filter((result) => result.status === "fulfilled" && result.value).length;
  }
  try {
    delivered += await sendAndroidPushToUser(userId, payload);
  } catch (error) {
    console.error("[push] Android native delivery failed", error);
  }
  return delivered;
}

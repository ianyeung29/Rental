import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WeChatTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type WeChatTicketResponse = {
  ticket?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type TokenCache = {
  value: string;
  expiresAt: number;
};

let accessTokenCache: TokenCache | null = null;
let jsApiTicketCache: TokenCache | null = null;
let accessTokenPromise: Promise<string> | null = null;
let jsApiTicketPromise: Promise<string> | null = null;

function configuredAppUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}

function allowedOrigins(request: Request) {
  const origins = new Set<string>();
  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // The request URL is supplied by Next.js and should always be valid.
  }
  const appUrl = configuredAppUrl();
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // Ignore a malformed optional app URL; the request origin remains available.
    }
  }
  return origins;
}

function getSignedUrl(rawUrl: unknown, request: Request) {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0 || rawUrl.length > 4_000) {
    throw new Error("A valid page URL is required.");
  }
  const url = new URL(rawUrl.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) page URLs can be signed.");
  if (!allowedOrigins(request).has(url.origin)) throw new Error("The page URL is not on an allowed application origin.");
  return rawUrl.trim().split("#")[0];
}

async function readJson<T>(response: Response) {
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok || !payload) throw new Error(`WeChat returned HTTP ${response.status}.`);
  return payload;
}

async function getAccessToken() {
  const appId = process.env.WECHAT_OFFICIAL_ACCOUNT_APP_ID;
  const appSecret = process.env.WECHAT_OFFICIAL_ACCOUNT_APP_SECRET;
  if (!appId || !appSecret) throw new Error("WeChat JS-SDK is not fully configured on the server.");
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) return accessTokenCache.value;
  if (accessTokenPromise) return accessTokenPromise;

  accessTokenPromise = (async () => {
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`, { cache: "no-store" });
    const payload = await readJson<WeChatTokenResponse>(response);
    if (!payload.access_token || payload.errcode) throw new Error(payload.errmsg || "WeChat access token could not be obtained.");
    const lifetime = Number(payload.expires_in) || 7_200;
    accessTokenCache = { value: payload.access_token, expiresAt: Date.now() + Math.max(60, lifetime - 120) * 1_000 };
    return payload.access_token;
  })().finally(() => {
    accessTokenPromise = null;
  });

  return accessTokenPromise;
}

async function getJsApiTicket() {
  if (jsApiTicketCache && jsApiTicketCache.expiresAt > Date.now() + 60_000) return jsApiTicketCache.value;
  if (jsApiTicketPromise) return jsApiTicketPromise;

  jsApiTicketPromise = (async () => {
    const accessToken = await getAccessToken();
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${encodeURIComponent(accessToken)}&type=jsapi`, { cache: "no-store" });
    const payload = await readJson<WeChatTicketResponse>(response);
    if (!payload.ticket || payload.errcode) throw new Error(payload.errmsg || "WeChat JS-SDK ticket could not be obtained.");
    const lifetime = Number(payload.expires_in) || 7_200;
    jsApiTicketCache = { value: payload.ticket, expiresAt: Date.now() + Math.max(60, lifetime - 120) * 1_000 };
    return payload.ticket;
  })().finally(() => {
    jsApiTicketPromise = null;
  });

  return jsApiTicketPromise;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 5_000) return NextResponse.json({ error: "The signing request is too large." }, { status: 413 });
    const body = JSON.parse(rawBody) as { url?: unknown };
    const url = getSignedUrl(body.url, request);
    const jsApiTicket = await getJsApiTicket();
    const nonceStr = randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1_000);
    const signature = createHash("sha1")
      .update(`jsapi_ticket=${jsApiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`)
      .digest("hex");
    return NextResponse.json({
      appId: process.env.WECHAT_OFFICIAL_ACCOUNT_APP_ID,
      timestamp,
      nonceStr,
      signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not fully configured")) return NextResponse.json({ error: "WeChat JS-SDK is not configured on the server yet." }, { status: 503 });
    if (message.includes("valid page URL") || message.includes("allowed application origin") || message.includes("Only HTTP")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("WeChat JS-SDK signature error", error);
    return NextResponse.json({ error: "WeChat sharing could not be prepared right now." }, { status: 502 });
  }
}

export type WeChatShareInput = {
  currentUrl: string;
  title: string;
  description: string;
  link: string;
  imageUrl: string;
};

export type WeChatShareResult =
  | { configured: true }
  | { configured: false; reason: "outside-wechat" };

type WeChatConfig = {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
};

type WeChatShareData = {
  title: string;
  desc?: string;
  link: string;
  imgUrl: string;
  success?: () => void;
  fail?: (error: unknown) => void;
};

type WeChatSdk = {
  config: (config: WeChatConfig & { debug: boolean; jsApiList: string[] }) => void;
  ready: (callback: () => void) => void;
  error: (callback: (error: unknown) => void) => void;
  updateTimelineShareData: (data: WeChatShareData) => void;
  updateAppMessageShareData: (data: WeChatShareData) => void;
};

declare global {
  interface Window {
    wx?: WeChatSdk;
  }
}

const WECHAT_SCRIPT_ID = "wechat-jssdk";
const WECHAT_SCRIPT_SRC = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";

let scriptPromise: Promise<WeChatSdk> | null = null;
let configuredPageUrl = "";
let configPromise: Promise<WeChatSdk> | null = null;

export function isWeChatBrowser() {
  return typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent);
}

export function toAbsoluteUrl(value: string) {
  if (typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

function loadWeChatSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("WeChat sharing is only available in a browser."));
  if (window.wx) return Promise.resolve(window.wx);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<WeChatSdk>((resolve, reject) => {
    const existingScript = document.getElementById(WECHAT_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => window.wx ? resolve(window.wx) : reject(new Error("WeChat JS-SDK did not load.")), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("WeChat JS-SDK could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = WECHAT_SCRIPT_ID;
    script.src = WECHAT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => window.wx ? resolve(window.wx) : reject(new Error("WeChat JS-SDK did not load."));
    script.onerror = () => reject(new Error("WeChat JS-SDK could not be loaded."));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

async function requestSignature(url: string) {
  const response = await fetch("/api/wechat/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { error?: unknown; configured?: unknown };
  if (!response.ok) {
    const error = new Error(typeof payload.error === "string" ? payload.error : "WeChat sharing is not configured.");
    if (response.status === 503) error.name = "WeChatNotConfigured";
    throw error;
  }
  return payload as WeChatConfig;
}

async function ensureConfigured(wx: WeChatSdk, currentUrl: string) {
  if (configPromise && configuredPageUrl === currentUrl) return configPromise;
  configuredPageUrl = currentUrl;
  configPromise = (async () => {
    const config = await requestSignature(currentUrl);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        callback();
      };
      const timer = window.setTimeout(() => finish(() => reject(new Error("WeChat JS-SDK configuration timed out."))), 8000);
      wx.ready(() => finish(() => {
        window.clearTimeout(timer);
        resolve();
      }));
      wx.error((error) => finish(() => {
        window.clearTimeout(timer);
        reject(new Error(typeof error === "string" ? error : "WeChat JS-SDK rejected this page configuration."));
      }));
      wx.config({
        debug: false,
        appId: config.appId,
        timestamp: config.timestamp,
        nonceStr: config.nonceStr,
        signature: config.signature,
        jsApiList: ["updateTimelineShareData", "updateAppMessageShareData"],
      });
    });
    return wx;
  })().catch((error) => {
    configPromise = null;
    configuredPageUrl = "";
    throw error;
  });
  return configPromise;
}

export async function configureWeChatShare(input: WeChatShareInput): Promise<WeChatShareResult> {
  if (!isWeChatBrowser()) return { configured: false, reason: "outside-wechat" };

  const wx = await loadWeChatSdk();
  const currentUrl = input.currentUrl.split("#")[0];
  const configuredWx = await ensureConfigured(wx, currentUrl);
  const shareData = {
    title: input.title,
    desc: input.description,
    link: input.link,
    imgUrl: toAbsoluteUrl(input.imageUrl),
  };

  await new Promise<void>((resolve, reject) => {
    let remaining = 2;
    let settled = false;
    const complete = () => {
      remaining -= 1;
      if (remaining === 0 && !settled) {
        settled = true;
        resolve();
      }
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(new Error(typeof error === "string" ? error : "WeChat could not prepare this share."));
    };
    try {
      configuredWx.updateTimelineShareData({ ...shareData, success: complete, fail });
      configuredWx.updateAppMessageShareData({ ...shareData, success: complete, fail });
    } catch (error) {
      fail(error);
    }
    window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve();
      }
    }, 2500);
  });

  return { configured: true };
}

export {};

"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

const NATIVE_CALLBACK_PROTOCOL = "com.anjurentals.app:";

async function handleNativeUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== NATIVE_CALLBACK_PROTOCOL || parsed.hostname !== "auth" || parsed.pathname !== "/callback") return;
  const status = parsed.searchParams.get("status");
  const handoff = parsed.searchParams.get("handoff") || "";
  const reason = parsed.searchParams.get("reason") || "error";
  try { await Browser.close(); } catch { /* The browser plugin is not open on every launch path. */ }
  if (status !== "success" || !handoff) {
    window.location.assign(`/?google=${encodeURIComponent(reason)}`);
    return;
  }
  const response = await fetch("/api/auth/google/mobile-exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoff }),
  });
  if (!response.ok) {
    window.location.assign("/?google=error");
    return;
  }
  window.location.assign("/?google=success");
}

export default function NativeRuntime() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const listener = App.addListener("appUrlOpen", ({ url }) => {
      if (!disposed) void handleNativeUrl(url);
    });
    void App.getLaunchUrl().then((result) => {
      if (!disposed && result?.url) void handleNativeUrl(result.url);
    });
    return () => {
      disposed = true;
      void listener.then((handle) => handle.remove());
    };
  }, []);
  return null;
}

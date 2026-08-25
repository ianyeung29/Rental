const CACHE_VERSION = "anjurentals-pwa-v7";
const APP_SHELL = [
  "/",
  "/about",
  "/agents",
  "/contact",
  "/feedback",
  "/install",
  "/legal",
  "/sitemap",
  "/brand/anjurentals-mark.svg",
  "/brand/anjurentals-mark.svg",
  "/icons/anjurentals-192.png",
  "/icons/anjurentals-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "安居 / Anjurentals";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "有新的房源动态。",
    icon: "/icons/anjurentals-192.png",
    badge: "/icons/anjurentals-192.png",
    tag: typeof payload.tag === "string" ? payload.tag : "anjurentals-update",
    data: { url: typeof payload.url === "string" ? payload.url : "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/").then((fallback) => fallback || offlineResponse())),
        ),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  const isCacheableAsset =
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/listings/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/brand/anjurentals-mark.svg";

  if (!isCacheableAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

function offlineResponse() {
  return new Response(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>安居 · Anjurentals</title><body style="margin:0;padding:32px;background:#f6f4ef;color:#142a44;font:16px system-ui,sans-serif"><h1>安居</h1><p>目前处于离线状态。请恢复网络后重试。</p><p>You are offline. Please reconnect and try again.</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

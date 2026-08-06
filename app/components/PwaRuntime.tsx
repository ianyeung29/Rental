"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "rental-marketplace.pwa-install-dismissed";
const LOCALE_KEY = "rental-marketplace.locale";

export default function PwaRuntime() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [standalone, setStandalone] = useState(() => isStandaloneDisplayMode());
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => getLocalStorageValue(DISMISSED_KEY) === "true");
  const [locale, setLocale] = useState<"zh" | "en">(() => (getLocalStorageValue(LOCALE_KEY) === "en" ? "en" : "zh"));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Browsing remains fully functional if the browser blocks service workers.
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  function dismissInstall() {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setInstallDismissed(true);
  }

  const showInstallPrompt = !standalone && !installDismissed && Boolean(installEvent);

  return (
    <>
      {!online ? (
        <div className="pwa-status-banner pwa-status-offline" role="status">
          {locale === "zh" ? "目前离线，已保存的页面仍可浏览。" : "You’re offline. Cached pages remain available."}
        </div>
      ) : null}
      {showInstallPrompt ? (
        <aside className="pwa-install-prompt" aria-label={locale === "zh" ? "安装安居应用" : "Install Anjurentals"}>
          <div className="pwa-install-copy">
            <strong>{locale === "zh" ? "安装安居" : "Install Anjurentals"}</strong>
            <span>{locale === "zh" ? "添加到主屏幕，随时查看房源。" : "Add it to your home screen for faster access."}</span>
          </div>
          <button className="pwa-install-button" type="button" onClick={installApp}>
            {locale === "zh" ? "安装" : "Install"}
          </button>
          <button className="pwa-dismiss-button" type="button" onClick={dismissInstall} aria-label={locale === "zh" ? "暂不安装" : "Dismiss"}>
            ×
          </button>
        </aside>
      ) : null}
    </>
  );
}

function getLocalStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

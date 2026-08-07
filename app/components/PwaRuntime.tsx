"use client";

import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "rental-marketplace.pwa-install-dismissed";
const IOS_DISMISSED_KEY = "rental-marketplace.pwa-ios-dismissed";
const LOCALE_KEY = "rental-marketplace.locale";

export default function PwaRuntime() {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [iosDismissed, setIosDismissed] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [locale, setLocale] = useState<"zh" | "en">("zh");
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const updatingRef = useRef(false);

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
    const handleLocaleChange = (event: Event) => {
      const next = (event as CustomEvent<"zh" | "en">).detail;
      if (next === "zh" || next === "en") setLocale(next);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("rental-locale-change", handleLocaleChange);
    const initialStatusTimer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      setStandalone(isStandaloneDisplayMode());
      setIosDevice(isIosDevice());
      setInstallDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
      setIosDismissed(window.localStorage.getItem(IOS_DISMISSED_KEY) === "true");
      setLocale(window.localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "zh");
    }, 0);

    let handleUpdateFound: (() => void) | null = null;
    if ("serviceWorker" in navigator) {
      const handleControllerChange = () => {
        if (updatingRef.current) window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
        registrationRef.current = registration;
        const showWaitingWorker = () => {
          if (registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true);
        };
        handleUpdateFound = () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") showWaitingWorker();
          });
        };
        registration.addEventListener("updatefound", handleUpdateFound);
        showWaitingWorker();
      }).catch(() => {
        // Browsing remains fully functional if the browser blocks service workers.
      });
      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        if (handleUpdateFound) registrationRef.current?.removeEventListener("updatefound", handleUpdateFound);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleInstalled);
        window.removeEventListener("rental-locale-change", handleLocaleChange);
        window.clearTimeout(initialStatusTimer);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("rental-locale-change", handleLocaleChange);
      window.clearTimeout(initialStatusTimer);
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

  function dismissIosInstall() {
    window.localStorage.setItem(IOS_DISMISSED_KEY, "true");
    setIosDismissed(true);
    setIosHelpOpen(false);
  }

  async function applyUpdate() {
    const registration = registrationRef.current;
    if (!registration) return;
    updatingRef.current = true;
    setUpdating(true);
    try {
      if (!registration.waiting) await registration.update();
      const waiting = registration.waiting;
      if (!waiting) {
        updatingRef.current = false;
        setUpdating(false);
        setUpdateAvailable(false);
        return;
      }
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      updatingRef.current = false;
      setUpdating(false);
      setUpdateAvailable(false);
    }
  }

  const showInstallPrompt = !standalone && !installDismissed && Boolean(installEvent);
  const showIosPrompt = !standalone && iosDevice && !iosDismissed;

  return (
    <>
      {!online ? (
        <div className="pwa-status-banner pwa-status-offline" role="status">
          {locale === "zh" ? "目前离线，已保存的页面仍可浏览。" : "You’re offline. Cached pages remain available."}
        </div>
      ) : null}
      {updateAvailable ? (
        <aside className="pwa-update-prompt" role="status" aria-live="polite">
          <div className="pwa-install-copy">
            <strong>{locale === "zh" ? "安居有新版本" : "Anjurentals has an update"}</strong>
            <span>{locale === "zh" ? "刷新后即可使用最新的搜索和发布体验。" : "Refresh to use the latest search and posting experience."}</span>
          </div>
          <button className="pwa-install-button" type="button" onClick={applyUpdate} disabled={updating}>
            {updating ? (locale === "zh" ? "更新中…" : "Updating…") : (locale === "zh" ? "更新" : "Update")}
          </button>
        </aside>
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
      {showIosPrompt ? (
        <aside className="pwa-install-prompt pwa-ios-prompt" aria-label={locale === "zh" ? "在 iPhone 上安装安居" : "Install Anjurentals on iPhone"}>
          <div className="pwa-install-copy">
            <strong>{locale === "zh" ? "把安居放到主屏幕" : "Add Anjurentals to your iPhone"}</strong>
            <span>{locale === "zh" ? "使用 Safari 的分享菜单安装，浏览房源更顺手。" : "Use Safari’s Share menu for a faster home-screen experience."}</span>
            {iosHelpOpen ? <span className="pwa-ios-steps">{locale === "zh" ? "打开 Safari → 点击分享 → 添加到主屏幕 → 添加。" : "Open Safari → tap Share → Add to Home Screen → Add."}</span> : null}
          </div>
          <button className="pwa-install-button" type="button" onClick={() => setIosHelpOpen((current) => !current)}>
            {iosHelpOpen ? (locale === "zh" ? "收起" : "Hide") : (locale === "zh" ? "查看步骤" : "How to install")}
          </button>
          <button className="pwa-dismiss-button" type="button" onClick={dismissIosInstall} aria-label={locale === "zh" ? "暂不显示" : "Dismiss"}>
            ×
          </button>
        </aside>
      ) : null}
    </>
  );
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

"use client";

import { useEffect, useState } from "react";

type Locale = "zh" | "en";
type Notification = { id: string; type: string; titleZh: string; titleEn: string; bodyZh: string; bodyEn: string; link: string; readAt: string | null; createdAt: string };
type NotificationPreferences = {
  emailEnabled: boolean;
  savedSearchAlerts: boolean;
  inquiryAlerts: boolean;
  listingExpirationAlerts: boolean;
  agentResponseAlerts: boolean;
  pushEnabled: boolean;
  updatedAt: string | null;
};
type PreferenceKey = keyof Omit<NotificationPreferences, "updatedAt">;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  savedSearchAlerts: true,
  inquiryAlerts: true,
  listingExpirationAlerts: true,
  agentResponseAlerts: true,
  pushEnabled: false,
  updatedAt: null,
};

type PushStatus = "idle" | "checking" | "unsupported" | "denied" | "subscribed" | "error";

function BellIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3v-4Z" stroke="currentColor" strokeWidth="1.7" /><path d="M10 20h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" /></svg>;
}

function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" /></svg>;
}

export default function NotificationCenter({ locale, authenticated, onRequireAuth }: { locale: Locale; authenticated: boolean; onRequireAuth: () => void }) {
  const zh = locale === "zh";
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState<PreferenceKey | null>(null);
  const [error, setError] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState("");

  const load = async () => {
    setLoading(true);
    setPreferencesLoading(true);
    setError("");
    setPreferencesError("");
    try {
      const [notificationResponse, preferencesResponse] = await Promise.all([
        fetch("/api/notifications", { cache: "no-store" }),
        fetch("/api/notification-preferences", { cache: "no-store" }),
      ]);
      const result = await notificationResponse.json() as { notifications?: Notification[]; unreadCount?: number; error?: string };
      if (!notificationResponse.ok) throw new Error(result.error || (zh ? "通知暂时无法加载。" : "Notifications are unavailable right now."));
      setNotifications(Array.isArray(result.notifications) ? result.notifications : []);
      setUnreadCount(Number(result.unreadCount || 0));
      if (preferencesResponse.ok) {
        const preferenceResult = await preferencesResponse.json() as Partial<NotificationPreferences>;
        setPreferences({ ...DEFAULT_PREFERENCES, ...preferenceResult });
      } else {
        const preferenceResult = await preferencesResponse.json().catch(() => ({})) as { error?: string };
        setPreferencesError(preferenceResult.error || (zh ? "提醒设置暂时无法加载。" : "Alert settings are unavailable right now."));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : (zh ? "通知暂时无法加载。" : "Notifications are unavailable right now."));
    } finally {
      setLoading(false);
      setPreferencesLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !authenticated) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [authenticated, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !authenticated) return;
    let cancelled = false;
    const checkSubscription = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setPushStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setPushStatus("denied");
        return;
      }
      setPushStatus("checking");
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setPushStatus(subscription ? "subscribed" : "idle");
      } catch {
        if (!cancelled) setPushStatus("error");
      }
    };
    void checkSubscription();
    return () => { cancelled = true; };
  }, [authenticated, open]);

  const markRead = async (id: string) => {
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount((current) => Math.max(0, current - 1));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => undefined);
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => undefined);
  };

  const savePreference = async (key: PreferenceKey, value: boolean) => {
    const previous = preferences[key];
    setPreferences((current) => ({ ...current, [key]: value }));
    setPreferencesSaving(key);
    setPreferencesError("");
    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const result = await response.json() as Partial<NotificationPreferences> & { error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "提醒设置保存失败。" : "Alert setting could not be saved."));
      setPreferences({ ...DEFAULT_PREFERENCES, ...result });
    } catch (saveError) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      setPreferencesError(saveError instanceof Error ? saveError.message : (zh ? "提醒设置保存失败。" : "Alert setting could not be saved."));
    } finally {
      setPreferencesSaving(null);
    }
  };

  const openCenter = () => {
    if (!authenticated) { onRequireAuth(); return; }
    setOpen(true);
  };

  const enablePushNotifications = async () => {
    if (!authenticated) { onRequireAuth(); return; }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    setPushLoading(true);
    setPushError("");
    try {
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setPushStatus("denied");
        if (permission === "denied") setPushError(zh ? "浏览器已阻止通知；请在网站权限中重新允许。" : "Notifications are blocked. Re-enable them in this site’s browser permissions.");
        return;
      }
      const keyResponse = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
      const keyResult = await keyResponse.json() as { publicKey?: string; error?: string };
      if (!keyResponse.ok || !keyResult.publicKey) throw new Error(keyResult.error || (zh ? "通知服务尚未配置。" : "Browser notifications are not configured yet."));
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyResult.publicKey) });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), userAgent: navigator.userAgent }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "通知订阅失败。" : "Browser notification subscription failed."));
      setPreferences((current) => ({ ...current, pushEnabled: true }));
      setPushStatus("subscribed");
    } catch (pushEnableError) {
      setPushStatus("error");
      setPushError(pushEnableError instanceof Error ? pushEnableError.message : (zh ? "通知暂时无法启用。" : "Browser notifications could not be enabled."));
    } finally {
      setPushLoading(false);
    }
  };

  const disablePushNotifications = async () => {
    setPushLoading(true);
    setPushError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const response = await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription?.endpoint || "" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "通知关闭失败。" : "Browser notifications could not be disabled."));
      await subscription?.unsubscribe();
      setPreferences((current) => ({ ...current, pushEnabled: false }));
      setPushStatus("idle");
    } catch (pushDisableError) {
      setPushStatus("error");
      setPushError(pushDisableError instanceof Error ? pushDisableError.message : (zh ? "通知暂时无法关闭。" : "Browser notifications could not be disabled."));
    } finally {
      setPushLoading(false);
    }
  };
  const preferenceItems: Array<{ key: PreferenceKey; zh: string; en: string }> = [
    { key: "savedSearchAlerts", zh: "保存搜索有新房源", en: "New matches for saved searches" },
    { key: "inquiryAlerts", zh: "咨询和看房进展", en: "Inquiry and tour updates" },
    { key: "listingExpirationAlerts", zh: "房源即将到期", en: "Listing expiration reminders" },
    { key: "agentResponseAlerts", zh: "经纪或申请回复", en: "Agent and application responses" },
  ];

  return <>
    <button className="notification-trigger" type="button" onClick={openCenter} aria-label={zh ? "打开通知" : "Open notifications"}><BellIcon />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>
    {open && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <aside className="drawer notification-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <div className="drawer-content">
          <div className="drawer-heading"><span className="section-label">SIGNAL DESK</span><button className="drawer-close" type="button" onClick={() => setOpen(false)} aria-label={zh ? "关闭" : "Close"}><CloseIcon /></button></div>
          <div className="notification-heading">
            <div><h2 id="notification-title">{zh ? "通知" : "Notifications"}</h2><p className="drawer-intro">{zh ? "咨询、搜索提醒和房源状态会集中显示在这里。" : "Inquiries, saved-search alerts, and account updates appear here."}</p></div>
            <div className="notification-heading-actions">{unreadCount > 0 && <button className="text-button" type="button" onClick={() => void markAllRead()}>{zh ? "全部已读" : "Mark all read"}</button>}<button className="text-button" type="button" onClick={() => setPreferencesOpen((current) => !current)} aria-expanded={preferencesOpen}>{zh ? "提醒设置" : "Alert settings"}</button></div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {preferencesOpen && <section className="notification-preferences" aria-labelledby="notification-preferences-title">
            <div className="notification-preferences-heading"><div><span className="section-label">DELIVERY CONTROL</span><h3 id="notification-preferences-title">{zh ? "提醒设置" : "Alert settings"}</h3></div>{preferences.updatedAt && <small>{new Date(preferences.updatedAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}</small>}</div>
            <p>{zh ? "站内通知始终保留；这里控制哪些提醒会通过 Resend 发送到邮箱。" : "In-app notices remain in your inbox; these controls decide which alerts are sent by Resend."}</p>
            {preferencesError && <p className="form-error" role="alert">{preferencesError}</p>}
            {preferencesLoading ? <div className="notification-preferences-loading" aria-live="polite">{zh ? "正在加载设置…" : "Loading settings…"}</div> : <>
              <label className="notification-toggle"><span><strong>{zh ? "启用邮件提醒" : "Email alerts"}</strong><small>{zh ? "关闭后不会收到任何分类邮件。" : "Turn off all email alerts."}</small></span><input type="checkbox" checked={preferences.emailEnabled} disabled={preferencesSaving !== null} onChange={(event) => { void savePreference("emailEnabled", event.target.checked); }} /></label>
              <div className={`notification-preference-list ${preferences.emailEnabled ? "" : "is-disabled"}`}>{preferenceItems.map((item) => <label className="notification-toggle" key={item.key}><span>{zh ? item.zh : item.en}</span><input type="checkbox" checked={preferences[item.key]} disabled={!preferences.emailEnabled || preferencesSaving !== null} onChange={(event) => { void savePreference(item.key, event.target.checked); }} /></label>)}</div>
              <section className="push-notification-control" aria-labelledby="push-notification-title">
                <div><span className="section-label">DEVICE SIGNAL</span><h4 id="push-notification-title">{zh ? "浏览器通知" : "Browser notifications"}</h4><p>{zh ? "在新咨询、保存搜索匹配或看房提醒出现时，在设备上收到即时通知。" : "Get an instant device notice for new inquiries, saved-search matches, and tour reminders."}</p>{pushError && <p className="push-notification-status" role="alert">{pushError}</p>}{pushStatus === "denied" && !pushError && <p className="push-notification-status">{zh ? "通知权限已关闭，请在浏览器设置中重新允许。" : "Notification permission is blocked; re-enable it in browser settings."}</p>}{pushStatus === "unsupported" && <p className="push-notification-status">{zh ? "此浏览器暂不支持浏览器通知。" : "This browser does not support push notifications."}</p>}</div>
                {pushStatus === "subscribed" ? <button className="outline-button" type="button" disabled={pushLoading} onClick={() => { void disablePushNotifications(); }}>{pushLoading ? (zh ? "处理中…" : "Working…") : (zh ? "关闭通知" : "Turn off")}</button> : <button className="outline-button" type="button" disabled={pushLoading || pushStatus === "unsupported" || pushStatus === "denied" || pushStatus === "checking"} onClick={() => { void enablePushNotifications(); }}>{pushLoading || pushStatus === "checking" ? (zh ? "处理中…" : "Working…") : (zh ? "启用通知" : "Enable")}</button>}
              </section>
            </>}
          </section>}
          {loading ? <div className="dashboard-loading" aria-live="polite"><span /><span /><span /></div> : notifications.length === 0 ? <div className="drawer-empty"><div className="empty-icon" aria-hidden="true"><BellIcon /></div><h3>{zh ? "暂无通知" : "No notifications"}</h3><p>{zh ? "新的咨询或搜索提醒会在这里出现。" : "New inquiries and saved-search alerts will appear here."}</p></div> : <div className="notification-list">{notifications.map((item) => <article className={`notification-item ${item.readAt ? "is-read" : "is-unread"}`} key={item.id}><div><div className="notification-item-top"><strong>{zh ? item.titleZh : item.titleEn}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}</time></div><p>{zh ? item.bodyZh : item.bodyEn}</p></div><div className="notification-item-actions">{item.link && <a className="link-button" href={item.link} onClick={() => { if (!item.readAt) void markRead(item.id); setOpen(false); }}>{zh ? "查看" : "Open"}</a>}{!item.readAt && <button className="text-button" type="button" onClick={() => void markRead(item.id)}>{zh ? "标记已读" : "Mark read"}</button>}</div></article>)}</div>}
        </div>
      </aside>
    </div>}
  </>;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

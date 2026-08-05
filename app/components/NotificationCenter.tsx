"use client";

import { useEffect, useState } from "react";

type Locale = "zh" | "en";
type Notification = { id: string; type: string; titleZh: string; titleEn: string; bodyZh: string; bodyEn: string; link: string; readAt: string | null; createdAt: string };

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const result = await response.json() as { notifications?: Notification[]; unreadCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "通知暂时无法加载。" : "Notifications are unavailable right now."));
      setNotifications(Array.isArray(result.notifications) ? result.notifications : []);
      setUnreadCount(Number(result.unreadCount || 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : (zh ? "通知暂时无法加载。" : "Notifications are unavailable right now."));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (!open || !authenticated) return; const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [authenticated, open]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const openCenter = () => {
    if (!authenticated) { onRequireAuth(); return; }
    setOpen(true);
  };
  return <><button className="notification-trigger" type="button" onClick={openCenter} aria-label={zh ? "打开通知" : "Open notifications"}><BellIcon />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>{open && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><aside className="drawer notification-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-title"><div className="drawer-content"><div className="drawer-heading"><span className="section-label">SIGNAL DESK</span><button className="drawer-close" type="button" onClick={() => setOpen(false)} aria-label={zh ? "关闭" : "Close"}><CloseIcon /></button></div><div className="notification-heading"><div><h2 id="notification-title">{zh ? "通知" : "Notifications"}</h2><p className="drawer-intro">{zh ? "咨询、搜索提醒和运营状态会集中显示在这里。" : "Inquiries, saved-search alerts, and account updates appear here."}</p></div>{unreadCount > 0 && <button className="text-button" type="button" onClick={() => void markAllRead()}>{zh ? "全部已读" : "Mark all read"}</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="dashboard-loading" aria-live="polite"><span /><span /><span /></div> : notifications.length === 0 ? <div className="drawer-empty"><div className="empty-icon" aria-hidden="true"><BellIcon /></div><h3>{zh ? "暂时没有通知" : "No notifications"}</h3><p>{zh ? "新的咨询或搜索提醒会在这里出现。" : "New inquiries and saved-search alerts will appear here."}</p></div> : <div className="notification-list">{notifications.map((item) => <article className={`notification-item ${item.readAt ? "is-read" : "is-unread"}`} key={item.id}><div><div className="notification-item-top"><strong>{zh ? item.titleZh : item.titleEn}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}</time></div><p>{zh ? item.bodyZh : item.bodyEn}</p></div><div className="notification-item-actions">{item.link && <a className="link-button" href={item.link} onClick={() => { if (!item.readAt) void markRead(item.id); setOpen(false); }}>{zh ? "查看" : "Open"}</a>}{!item.readAt && <button className="text-button" type="button" onClick={() => void markRead(item.id)}>{zh ? "标记已读" : "Mark read"}</button>}</div></article>)}</div>}</div></aside></div>}</>;
}

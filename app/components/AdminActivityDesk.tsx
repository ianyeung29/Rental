"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  eventType: string;
  outcome: string;
  userId: string | null;
  userEmail: string;
  authenticated: boolean;
  ipAddress: string;
  countryCode: string;
  browser: string;
  operatingSystem: string;
  deviceType: string;
  route: string;
  method: string;
  metadata: Record<string, unknown>;
  createdAt: string | null;
};

type ActivityFilters = { days: number; eventType: string; outcome: string; search: string };
type ActivityResult = { days: number; retentionDays: number; generatedAt: string; events: AuditEvent[]; totals: { events: number; authenticated: number; anonymous: number; failures: number; blocked: number } };

const EVENT_TYPES = [
  ["auth.", "认证"],
  ["listing.", "房源"],
  ["inquiry.", "咨询"],
  ["account.", "账号"],
  ["agent.", "经纪核验"],
  ["admin.", "管理员"],
] as const;

function numberLabel(value: number) {
  return value.toLocaleString("en-US");
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
}

function outcomeLabel(value: string) {
  if (value === "failure") return "失败 / Failure";
  if (value === "blocked") return "拦截 / Blocked";
  return "成功 / Success";
}

function outcomeClass(value: string) {
  if (value === "failure" || value === "blocked") return "expired";
  return "published";
}

function metadataLabel(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return "—";
  return entries.slice(0, 5).map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}

export default function AdminActivityDesk({ adminName }: { adminName: string }) {
  const [filters, setFilters] = useState<ActivityFilters>({ days: 30, eventType: "", outcome: "", search: "" });
  const [draft, setDraft] = useState<ActivityFilters>(filters);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (activeFilters: ActivityFilters) => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ days: String(activeFilters.days) });
    if (activeFilters.eventType) query.set("eventType", activeFilters.eventType);
    if (activeFilters.outcome) query.set("outcome", activeFilters.outcome);
    if (activeFilters.search.trim()) query.set("search", activeFilters.search.trim());
    try {
      const response = await fetch(`/api/admin/activity?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json() as ActivityResult | { error?: string };
      if (!response.ok || !("events" in payload)) throw new Error((payload as { error?: string }).error || "Activity log could not be loaded.");
      setResult(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Activity log could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(filters); }, 0);
    return () => window.clearTimeout(timer);
  }, [filters, load]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...draft, search: draft.search.trim() });
  };

  const selectDays = (days: number) => {
    setDraft((current) => ({ ...current, days }));
    setFilters((current) => ({ ...current, days }));
  };

  return <div className="admin-shell">
    <header className="admin-topbar"><div className="admin-topbar-inner"><Link className="brand" href="/"><span className="brand-wordmark"><strong>安居</strong><small>ANJURENTALS</small></span></Link><div className="admin-topbar-actions"><span className="admin-user-label"><span>ADMIN</span>{adminName}</span><Link className="admin-back-link" href="/">返回安居 / Back</Link></div></div></header>
    <main className="admin-main">
      <div className="admin-breadcrumb"><Link href="/">安居</Link><span>/</span><span>安全活动日志 / Activity log</span></div>
      <div className="admin-heading"><div><h1>安全活动日志</h1><p>查看登录、浏览、发布、咨询和管理员操作的设备与网络信号。日志只保留 30 天，并且不记录密码、令牌、私密地址或 AI 文案。</p></div><div className="admin-period-switcher" role="group" aria-label="Activity period"><button className={filters.days === 7 ? "active" : ""} type="button" onClick={() => selectDays(7)}>7 days</button><button className={filters.days === 30 ? "active" : ""} type="button" onClick={() => selectDays(30)}>30 days</button></div></div>
      <form className="admin-audit-filters" onSubmit={submit}>
        <label><span>事件类型</span><select value={draft.eventType} onChange={(event) => setDraft((current) => ({ ...current, eventType: event.target.value }))}><option value="">全部事件</option>{EVENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label} / {value}*</option>)}</select></label>
        <label><span>结果</span><select value={draft.outcome} onChange={(event) => setDraft((current) => ({ ...current, outcome: event.target.value }))}><option value="">全部结果</option><option value="success">成功 / Success</option><option value="failure">失败 / Failure</option><option value="blocked">拦截 / Blocked</option></select></label>
        <label className="admin-audit-search"><span>搜索账号、国家、浏览器或路由</span><input value={draft.search} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} maxLength={120} placeholder="例如 gmail.com、US、Chrome" /></label>
        <button className="primary-button" type="submit">应用筛选 / Apply</button>
      </form>
      {error && <div className="admin-alert" role="alert"><strong>读取失败 / Load failed</strong><span>{error}</span><button className="text-button" type="button" onClick={() => { void load(filters); }}>重试 / Retry</button></div>}
      {loading && !result ? <div className="admin-application-skeletons" aria-live="polite"><span /><span /></div> : result && <>
        <section className="admin-usage-summary admin-audit-summary" aria-label="Activity totals"><div><span>总事件 / Events</span><strong>{numberLabel(result.totals.events)}</strong></div><div><span>已登录 / Authenticated</span><strong>{numberLabel(result.totals.authenticated)}</strong></div><div><span>未登录 / Anonymous</span><strong>{numberLabel(result.totals.anonymous)}</strong></div><div><span>失败或拦截 / Issues</span><strong>{numberLabel(result.totals.failures + result.totals.blocked)}</strong></div></section>
        <section className="admin-queue admin-usage-section"><div className="admin-queue-heading"><div><span className="section-label">SECURITY SIGNALS</span><h2>最近活动</h2></div><p>显示最近 {result.days} 天，最多 200 条记录。管理员页面本身不会写入新的活动日志。</p></div>
          {loading ? <div className="admin-application-skeletons" aria-live="polite"><span /><span /></div> : result.events.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-mark">—</span><h3>暂时没有活动记录</h3><p>用户登录、发布房源或产生咨询后，相关信号会显示在这里。</p></div> : <div className="admin-usage-table-wrap"><table className="admin-usage-table admin-audit-table"><thead><tr><th>时间</th><th>事件</th><th>账号</th><th>国家 / 设备</th><th>IP</th><th>路由</th><th>附加信号</th></tr></thead><tbody>{result.events.map((item) => <tr key={item.id}><td><time dateTime={item.createdAt || undefined}>{dateLabel(item.createdAt)}</time></td><td><strong>{item.eventType}</strong><span className={`status-chip ${outcomeClass(item.outcome)}`}>{outcomeLabel(item.outcome)}</span><small>{item.method || "—"}</small></td><td>{item.authenticated ? <><strong>{item.userEmail || "已登录账号"}</strong><small>{item.userId || "—"}</small></> : <span>Anonymous / 未登录</span>}</td><td>{item.countryCode || "—"}<small>{item.browser} · {item.operatingSystem} · {item.deviceType}</small></td><td><code>{item.ipAddress}</code></td><td><code>{item.route || "—"}</code></td><td><span className="admin-audit-metadata">{metadataLabel(item.metadata)}</span></td></tr>)}</tbody></table></div>}
        </section>
      </>}
      <div className="admin-privacy-note"><strong>隐私边界 / Privacy boundary</strong><p>只有已验证的管理员可以打开此页面。IP 默认使用服务端密钥加密；如果 AUDIT_LOG_ENCRYPTION_KEY 尚未配置，页面只显示 Encrypted / hash-only，不显示原始 IP。用户邮箱仅用于已登录审计记录，不会出现在公开页面。</p></div>
    </main>
  </div>;
}

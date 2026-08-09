"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type UsageRow = {
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  placesCalls: number;
  routeCalls: number;
  cacheHits: number;
  grossCostUsd: number;
};

type DailyRow = {
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  placesCalls: number;
  routeCalls: number;
  grossCostUsd: number;
};

type UsageAlertSettings = {
  enabled: boolean;
  openaiMonthlyCostUsd: number;
  googlePlacesMonthlyCalls: number;
  googleRoutesMonthlyCalls: number;
  blockedRequestsThreshold: number;
  googlePlacesQualityIssuesThreshold: number;
  googleRoutesQualityIssuesThreshold: number;
};

type LocationLookupSettings = {
  placesCallsPerLookup: number;
  routeCallsPerLookup: number;
  updatedAt: string | null;
};

type MonitoringAlert = {
  key: string;
  provider: string;
  metric: string;
  value: number;
  threshold: number;
  active: boolean;
  message: string;
  lastTriggeredAt: string | null;
};

type MonitoringError = {
  id: string;
  source: string;
  severity: string;
  route: string;
  message: string;
  errorName: string;
  requestId: string;
  createdAt: string | null;
};

type UsageResult = {
  days: number;
  generatedAt: string;
  summary: UsageRow[];
  endpoints: UsageRow[];
  daily: DailyRow[];
  rateLimits: { activeKeys: number; currentRequests: number; blockedRequests: number };
  pricing: { googlePlacesFreeMonthly: number; googleRoutesFreeMonthly: number; googlePlacesCostPerCall: number; googleRoutesCostPerCall: number; note: string };
  locationLookup: LocationLookupSettings;
  monitoring: {
    settings: UsageAlertSettings;
    emailConfigured: boolean;
    month: { openaiEstimatedCostUsd: number; googlePlacesCalls: number; googleRoutesCalls: number; blockedRequests: number; googlePlacesQualityIssues: number; googleRoutesQualityIssues: number };
    alerts: MonitoringAlert[];
    errors: { last24Hours: number; critical: number; recent: MonitoringError[] };
  };
};

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatCost(value: number) {
  return `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`;
}

function formatUnitCost(value: number) {
  return `$${value.toFixed(3)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function providerLabel(value: string) {
  if (value === "openai") return "OpenAI";
  if (value === "google_maps") return "Google Maps";
  return value;
}

export default function AdminUsageDesk({ adminName }: { adminName: string }) {
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<UsageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertDraft, setAlertDraft] = useState<UsageAlertSettings | null>(null);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertSaveMessage, setAlertSaveMessage] = useState("");
  const [locationLookupDraft, setLocationLookupDraft] = useState<LocationLookupSettings | null>(null);
  const [locationLookupSaving, setLocationLookupSaving] = useState(false);
  const [locationLookupSaveMessage, setLocationLookupSaveMessage] = useState("");
  const [locationCacheClearing, setLocationCacheClearing] = useState(false);
  const [locationCacheClearMessage, setLocationCacheClearMessage] = useState("");

  const load = useCallback(async (period = days) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/usage?days=${period}`, { cache: "no-store" });
      const payload = await response.json() as UsageResult | { error?: string };
      if (!response.ok || !("summary" in payload)) throw new Error((payload as { error?: string }).error || "API usage could not be loaded.");
      setResult(payload);
      setAlertDraft(payload.monitoring.settings);
      setLocationLookupDraft(payload.locationLookup);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "API usage could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  const saveAlertSettings = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!alertDraft) return;
    setAlertSaving(true);
    setAlertSaveMessage("");
    try {
      const response = await fetch("/api/admin/usage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertDraft),
      });
      const payload = await response.json() as { settings?: UsageAlertSettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error || "Alert settings could not be saved.");
      setAlertDraft(payload.settings);
      setAlertSaveMessage("Saved / 已保存");
      await load();
    } catch (saveError) {
      setAlertSaveMessage(saveError instanceof Error ? saveError.message : "Alert settings could not be saved.");
    } finally {
      setAlertSaving(false);
    }
  }, [alertDraft, load]);

  const saveLocationLookupSettings = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!locationLookupDraft) return;
    setLocationLookupSaving(true);
    setLocationLookupSaveMessage("");
    try {
      const response = await fetch("/api/admin/usage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationLookup: locationLookupDraft }),
      });
      const payload = await response.json() as { locationLookup?: LocationLookupSettings; error?: string };
      if (!response.ok || !payload.locationLookup) throw new Error(payload.error || "Map lookup settings could not be saved.");
      setLocationLookupDraft(payload.locationLookup);
      setLocationLookupSaveMessage("Saved / 已保存");
      await load();
    } catch (saveError) {
      setLocationLookupSaveMessage(saveError instanceof Error ? saveError.message : "Map lookup settings could not be saved.");
    } finally {
      setLocationLookupSaving(false);
    }
  }, [load, locationLookupDraft]);

  const clearLocationCache = useCallback(async () => {
    if (!window.confirm("Clear all saved map lookup results? The next lookup will call Google Maps again.")) return;
    setLocationCacheClearing(true);
    setLocationCacheClearMessage("");
    try {
      const response = await fetch("/api/admin/usage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearLocationCache: true }),
      });
      const payload = await response.json() as { clearedLocationCache?: { persistent: number; memory: number }; error?: string };
      if (!response.ok || !payload.clearedLocationCache) throw new Error(payload.error || "Map cache could not be cleared.");
      setLocationCacheClearMessage(`Cleared ${formatNumber(payload.clearedLocationCache.persistent)} saved results / 已清除 ${formatNumber(payload.clearedLocationCache.persistent)} 条缓存`);
    } catch (clearError) {
      setLocationCacheClearMessage(clearError instanceof Error ? clearError.message : "Map cache could not be cleared.");
    } finally {
      setLocationCacheClearing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totals = useMemo(() => (result?.summary || []).reduce((total, row) => ({
    requests: total.requests + row.requests,
    inputTokens: total.inputTokens + row.inputTokens,
    outputTokens: total.outputTokens + row.outputTokens,
    placesCalls: total.placesCalls + row.placesCalls,
    routeCalls: total.routeCalls + row.routeCalls,
    grossCostUsd: total.grossCostUsd + row.grossCostUsd,
  }), { requests: 0, inputTokens: 0, outputTokens: 0, placesCalls: 0, routeCalls: 0, grossCostUsd: 0 }), [result]);

  const maxDailyRequests = Math.max(1, ...(result?.daily || []).map((row) => row.requests));

  return <div className="admin-shell">
    <header className="admin-topbar"><div className="admin-topbar-inner"><Link className="brand" href="/"><span className="brand-wordmark"><strong>安居</strong><small>ANJURENTALS</small></span></Link><div className="admin-topbar-actions"><span className="admin-user-label"><span>ADMIN</span>{adminName}</span><Link className="admin-back-link" href="/">返回安居 / Back</Link></div></div></header>
    <main className="admin-main">
      <div className="admin-breadcrumb"><Link href="/">安居</Link><span>/</span><span>API 使用 / API usage</span></div>
      <div className="admin-heading"><div><h1>API 使用与成本</h1><p>监控 OpenAI、Google Maps、缓存命中和数据库限流。费用是运营估算，不替代供应商账单。</p></div><div className="admin-period-switcher" role="group" aria-label="Usage period"><button className={days === 7 ? "active" : ""} type="button" onClick={() => setDays(7)}>7 days</button><button className={days === 30 ? "active" : ""} type="button" onClick={() => setDays(30)}>30 days</button><button className={days === 90 ? "active" : ""} type="button" onClick={() => setDays(90)}>90 days</button></div></div>
      {error && <div className="admin-alert" role="alert"><strong>读取失败 / Load failed</strong><span>{error}</span><button className="text-button" type="button" onClick={() => { void load(); }}>重试 / Retry</button></div>}
      {loading && !result ? <div className="admin-application-skeletons"><span /><span /></div> : result && <>
        <section className="admin-usage-summary" aria-label="Usage totals">
          <div><span>请求 / Requests</span><strong>{formatNumber(totals.requests)}</strong></div>
          <div><span>AI tokens</span><strong>{formatNumber(totals.inputTokens + totals.outputTokens)}</strong></div>
          <div>
            <span>Places calls</span>
            <strong>{formatNumber(totals.placesCalls)}</strong>
            <small className="admin-usage-quota">Free quota: {formatNumber(result.pricing.googlePlacesFreeMonthly)} / month · {formatUnitCost(result.pricing.googlePlacesCostPerCall)} per call after quota</small>
          </div>
          <div>
            <span>Routes calls</span>
            <strong>{formatNumber(totals.routeCalls)}</strong>
            <small className="admin-usage-quota">Free quota: {formatNumber(result.pricing.googleRoutesFreeMonthly)} / month · {formatUnitCost(result.pricing.googleRoutesCostPerCall)} per call after quota</small>
          </div>
          <div><span>Gross estimate</span><strong>{formatCost(totals.grossCostUsd)}</strong></div>
        </section>
        <section className="admin-usage-note"><strong>Limit status / 限流状态</strong><span>{formatNumber(result.rateLimits.activeKeys)} active windows · {formatNumber(result.rateLimits.currentRequests)} requests · {formatNumber(result.rateLimits.blockedRequests)} blocked</span><small>{result.pricing.note}</small></section>
        {alertDraft && <section className="admin-usage-section admin-monitoring-section"><div className="admin-queue-heading"><div><span className="section-label">GUARDRAILS</span><h2>Usage thresholds and errors</h2></div><p>Set monthly warning lines here. Active warnings stay visible in this desk, and Resend can notify verified administrators.</p></div><div className="admin-monitoring-grid"><form className="admin-monitoring-panel" onSubmit={(event) => { void saveAlertSettings(event); }}><div className="admin-monitoring-panel-heading"><div><strong>API usage thresholds / 调用阈值</strong><span>{result.monitoring.emailConfigured ? "Email alerts are configured." : "In-page alerts only · configure Resend and ADMIN_ALERT_EMAIL for email."}</span></div><label className="admin-monitoring-toggle"><input type="checkbox" checked={alertDraft.enabled} onChange={(event) => setAlertDraft((current) => current ? { ...current, enabled: event.target.checked } : current)} /><span>On / 启用</span></label></div><div className="admin-monitoring-alert-list">{result.monitoring.alerts.map((alert) => <div className={`admin-monitoring-alert ${alert.active ? "active" : "clear"}`} key={alert.key}><span className="admin-monitoring-alert-mark" aria-hidden="true">{alert.active ? "!" : "✓"}</span><div><strong>{alert.provider} · {alert.metric}</strong><span>{alert.message}</span></div></div>)}</div><div className="admin-monitoring-form-grid"><label><span>OpenAI monthly cost / 月度费用</span><div><input type="number" min="0.01" step="0.01" value={alertDraft.openaiMonthlyCostUsd} onChange={(event) => setAlertDraft((current) => current ? { ...current, openaiMonthlyCostUsd: Number(event.target.value) } : current)} /><small>USD</small></div></label><label><span>Google Places calls / Places 调用</span><div><input type="number" min="1" step="1" value={alertDraft.googlePlacesMonthlyCalls} onChange={(event) => setAlertDraft((current) => current ? { ...current, googlePlacesMonthlyCalls: Number(event.target.value) } : current)} /><small>calls / month</small></div></label><label><span>Google Routes calls / Routes 调用</span><div><input type="number" min="1" step="1" value={alertDraft.googleRoutesMonthlyCalls} onChange={(event) => setAlertDraft((current) => current ? { ...current, googleRoutesMonthlyCalls: Number(event.target.value) } : current)} /><small>calls / month</small></div></label><label><span>Blocked requests / 被拦截请求</span><div><input type="number" min="1" step="1" value={alertDraft.blockedRequestsThreshold} onChange={(event) => setAlertDraft((current) => current ? { ...current, blockedRequestsThreshold: Number(event.target.value) } : current)} /><small>this month</small></div></label><label><span>Places quality issues / 地图地点质量</span><div><input type="number" min="1" step="1" value={alertDraft.googlePlacesQualityIssuesThreshold} onChange={(event) => setAlertDraft((current) => current ? { ...current, googlePlacesQualityIssuesThreshold: Number(event.target.value) } : current)} /><small>missing / rejected</small></div></label><label><span>Routes quality issues / 地图路线质量</span><div><input type="number" min="1" step="1" value={alertDraft.googleRoutesQualityIssuesThreshold} onChange={(event) => setAlertDraft((current) => current ? { ...current, googleRoutesQualityIssuesThreshold: Number(event.target.value) } : current)} /><small>missing / rejected</small></div></label></div><div className="admin-application-actions"><button className="primary-button" type="submit" disabled={alertSaving}>{alertSaving ? "Saving…" : "Save thresholds / 保存阈值"}</button>{alertSaveMessage && <span className="admin-monitoring-save-status" role="status">{alertSaveMessage}</span>}</div></form><section className="admin-monitoring-panel"><div className="admin-monitoring-panel-heading"><div><strong>Error monitoring / 错误监控</strong><span>{formatNumber(result.monitoring.errors.last24Hours)} errors in the last 24 hours · {formatNumber(result.monitoring.errors.critical)} critical total</span></div><span className={`status-chip ${result.monitoring.errors.last24Hours > 0 ? "pending" : "published"}`}>{result.monitoring.errors.last24Hours > 0 ? "Review" : "Clear"}</span></div>{result.monitoring.errors.recent.length === 0 ? <p className="admin-monitoring-empty">No application errors have been recorded.</p> : <div className="admin-monitoring-error-list">{result.monitoring.errors.recent.slice(0, 8).map((item) => <article className="admin-monitoring-error" key={item.id}><div><span className={`status-chip ${item.severity === "critical" ? "rejected" : "pending"}`}>{item.severity}</span><time>{formatDate(item.createdAt)}</time></div><strong>{item.message}</strong><small>{item.source}{item.route ? ` · ${item.route}` : ""}{item.errorName ? ` · ${item.errorName}` : ""}</small></article>)}</div>}</section></div></section>}
        {locationLookupDraft && <section className="admin-usage-section admin-monitoring-section"><div className="admin-queue-heading"><div><span className="section-label">MAP BUDGET</span><h2>Map lookup controls</h2></div><p>Adjust the maximum Google Maps calls used by one uncached nearby-context lookup. Cached lookups use zero new Places or Routes calls. / 调整每次未缓存附近信息查询的 Google Maps 上限，命中缓存不会产生新的调用。</p></div><form className="admin-monitoring-panel admin-lookup-limits-panel" onSubmit={(event) => { void saveLocationLookupSettings(event); }}><div className="admin-monitoring-panel-heading"><div><strong>Per-lookup map budget / 单次地图预算</strong><span>Safe range: 1–10 calls per provider. Higher limits may improve fallback results but can increase cost.</span></div><span className="status-chip published">Live setting</span></div><p id="map-lookup-limit-note" className="admin-lookup-limit-callout">These limits apply to each uncached AI polish or commute lookup. They do not change Google’s monthly free quota or billing account limits.</p><div className="admin-monitoring-form-grid"><label><span>Google Places per lookup / Places 单次上限</span><div><input aria-describedby="map-lookup-limit-note" type="number" min="1" max="10" step="1" inputMode="numeric" value={locationLookupDraft.placesCallsPerLookup} onChange={(event) => setLocationLookupDraft((current) => current ? { ...current, placesCallsPerLookup: Number(event.target.value) } : current)} /><small>calls</small></div></label><label><span>Google Routes per lookup / Routes 单次上限</span><div><input aria-describedby="map-lookup-limit-note" type="number" min="1" max="10" step="1" inputMode="numeric" value={locationLookupDraft.routeCallsPerLookup} onChange={(event) => setLocationLookupDraft((current) => current ? { ...current, routeCallsPerLookup: Number(event.target.value) } : current)} /><small>calls</small></div></label></div><div className="admin-application-actions"><button className="primary-button" type="submit" disabled={locationLookupSaving}>{locationLookupSaving ? "Saving…" : "Save map limits / 保存地图上限"}</button>{locationLookupDraft.updatedAt && <span className="admin-lookup-limit-meta">Last saved {formatDate(locationLookupDraft.updatedAt)}</span>}{locationLookupSaveMessage && <span className="admin-monitoring-save-status" role="status">{locationLookupSaveMessage}</span>}</div><div className="admin-cache-actions"><button className="outline-button" type="button" onClick={() => { void clearLocationCache(); }} disabled={locationCacheClearing}>{locationCacheClearing ? "Clearing…" : "Clear saved map cache / 清除地图缓存"}</button>{locationCacheClearMessage && <span className="admin-monitoring-save-status" role="status">{locationCacheClearMessage}</span>}</div></form></section>}
        <section className="admin-queue admin-usage-section"><div className="admin-queue-heading"><div><span className="section-label">PROVIDER BREAKDOWN</span><h2>按服务查看</h2></div><p>Google Maps free quota per SKU: {formatNumber(result.pricing.googlePlacesFreeMonthly)} Places Text Search and {formatNumber(result.pricing.googleRoutesFreeMonthly)} Routes Compute Routes each month. After the quota, estimates use {formatUnitCost(result.pricing.googlePlacesCostPerCall)} per Places call and {formatUnitCost(result.pricing.googleRoutesCostPerCall)} per Routes call.</p></div><div className="admin-usage-provider-list">{result.summary.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-mark">—</span><h3>还没有 API 使用记录</h3><p>AI 润色或地图查询运行后，记录会显示在这里。</p></div> : result.summary.map((row) => <article className="admin-usage-provider" key={row.provider}><div><span className="status-chip published">{providerLabel(row.provider)}</span><h3>{row.provider === "openai" ? "AI copy and comparison" : "Nearby place and route context"}</h3></div><dl><div><dt>Requests</dt><dd>{formatNumber(row.requests)}</dd></div><div><dt>Tokens</dt><dd>{formatNumber(row.totalTokens)}</dd></div><div><dt>Places</dt><dd>{formatNumber(row.placesCalls)}{row.provider === "google_maps" && <small className="usage-quota"> / {formatNumber(result.pricing.googlePlacesFreeMonthly)} free/mo · {formatUnitCost(result.pricing.googlePlacesCostPerCall)} / call after</small>}</dd></div><div><dt>Routes</dt><dd>{formatNumber(row.routeCalls)}{row.provider === "google_maps" && <small className="usage-quota"> / {formatNumber(result.pricing.googleRoutesFreeMonthly)} free/mo · {formatUnitCost(result.pricing.googleRoutesCostPerCall)} / call after</small>}</dd></div><div><dt>Cache hits</dt><dd>{formatNumber(row.cacheHits)}</dd></div><div><dt>Gross estimate</dt><dd>{formatCost(row.grossCostUsd)}</dd></div></dl></article>)}</div></section>
        <section className="admin-usage-section"><div className="admin-queue-heading"><div><span className="section-label">DAILY ACTIVITY</span><h2>每日活动</h2></div><p>仅显示已记录的第三方 API 调用。</p></div><div className="admin-usage-daily-list">{result.daily.length === 0 ? <p className="admin-usage-empty">No activity recorded in this period.</p> : result.daily.map((row) => <div className="admin-usage-daily-row" key={row.day}><time>{row.day}</time><div className="admin-usage-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, (row.requests / maxDailyRequests) * 100)}%` }} /></div><strong>{formatNumber(row.requests)}</strong><small>{formatCost(row.grossCostUsd)}</small></div>)}</div></section>
        <section className="admin-usage-section"><div className="admin-queue-heading"><div><span className="section-label">ENDPOINTS</span><h2>按功能查看</h2></div><p>帮助定位最常用的 AI 或地图流程。</p></div><div className="admin-usage-table-wrap"><table className="admin-usage-table"><thead><tr><th>Provider / endpoint</th><th>Requests</th><th>Tokens</th><th>Places</th><th>Routes</th><th>Estimate</th></tr></thead><tbody>{result.endpoints.map((row, index) => <tr key={`${row.provider}-${index}`}><td>{row.provider}</td><td>{formatNumber(row.requests)}</td><td>{formatNumber(row.totalTokens)}</td><td>{formatNumber(row.placesCalls)}</td><td>{formatNumber(row.routeCalls)}</td><td>{formatCost(row.grossCostUsd)}</td></tr>)}</tbody></table></div></section>
      </>}
      <div className="admin-privacy-note"><strong>安全边界 / Security boundary</strong><p>此页面只显示聚合计数和估算费用，不显示 API key、完整邮箱、密码、私密地址或 OpenAI 请求内容。 / This desk shows aggregate counts and estimates only; secrets, full emails, passwords, private addresses, and prompt contents stay server-side.</p></div>
    </main>
  </div>;
}

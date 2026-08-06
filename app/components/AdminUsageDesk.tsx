"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type UsageResult = {
  days: number;
  generatedAt: string;
  summary: UsageRow[];
  endpoints: UsageRow[];
  daily: DailyRow[];
  rateLimits: { activeKeys: number; currentRequests: number; blockedRequests: number };
  pricing: { googlePlacesFreeMonthly: number; googleRoutesFreeMonthly: number; note: string };
};

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatCost(value: number) {
  return `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`;
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

  const load = useCallback(async (period = days) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/usage?days=${period}`, { cache: "no-store" });
      const payload = await response.json() as UsageResult | { error?: string };
      if (!response.ok || !("summary" in payload)) throw new Error((payload as { error?: string }).error || "API usage could not be loaded.");
      setResult(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "API usage could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [days]);

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
        <section className="admin-usage-summary" aria-label="Usage totals"><div><span>请求 / Requests</span><strong>{formatNumber(totals.requests)}</strong></div><div><span>AI tokens</span><strong>{formatNumber(totals.inputTokens + totals.outputTokens)}</strong></div><div><span>Places calls</span><strong>{formatNumber(totals.placesCalls)}</strong></div><div><span>Routes calls</span><strong>{formatNumber(totals.routeCalls)}</strong></div><div><span>Gross estimate</span><strong>{formatCost(totals.grossCostUsd)}</strong></div></section>
        <section className="admin-usage-note"><strong>Limit status / 限流状态</strong><span>{formatNumber(result.rateLimits.activeKeys)} active windows · {formatNumber(result.rateLimits.currentRequests)} requests · {formatNumber(result.rateLimits.blockedRequests)} blocked</span><small>{result.pricing.note}</small></section>
        <section className="admin-queue admin-usage-section"><div className="admin-queue-heading"><div><span className="section-label">PROVIDER BREAKDOWN</span><h2>按服务查看</h2></div><p>Google Maps monthly free caps: {formatNumber(result.pricing.googlePlacesFreeMonthly)} Places and {formatNumber(result.pricing.googleRoutesFreeMonthly)} Routes.</p></div><div className="admin-usage-provider-list">{result.summary.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-mark">—</span><h3>还没有 API 使用记录</h3><p>AI 润色或地图查询运行后，记录会显示在这里。</p></div> : result.summary.map((row) => <article className="admin-usage-provider" key={row.provider}><div><span className="status-chip published">{providerLabel(row.provider)}</span><h3>{row.provider === "openai" ? "AI copy and comparison" : "Nearby place and route context"}</h3></div><dl><div><dt>Requests</dt><dd>{formatNumber(row.requests)}</dd></div><div><dt>Tokens</dt><dd>{formatNumber(row.totalTokens)}</dd></div><div><dt>Places</dt><dd>{formatNumber(row.placesCalls)}</dd></div><div><dt>Routes</dt><dd>{formatNumber(row.routeCalls)}</dd></div><div><dt>Cache hits</dt><dd>{formatNumber(row.cacheHits)}</dd></div><div><dt>Gross estimate</dt><dd>{formatCost(row.grossCostUsd)}</dd></div></dl></article>)}</div></section>
        <section className="admin-usage-section"><div className="admin-queue-heading"><div><span className="section-label">DAILY ACTIVITY</span><h2>每日活动</h2></div><p>仅显示已记录的第三方 API 调用。</p></div><div className="admin-usage-daily-list">{result.daily.length === 0 ? <p className="admin-usage-empty">No activity recorded in this period.</p> : result.daily.map((row) => <div className="admin-usage-daily-row" key={row.day}><time>{row.day}</time><div className="admin-usage-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, (row.requests / maxDailyRequests) * 100)}%` }} /></div><strong>{formatNumber(row.requests)}</strong><small>{formatCost(row.grossCostUsd)}</small></div>)}</div></section>
        <section className="admin-usage-section"><div className="admin-queue-heading"><div><span className="section-label">ENDPOINTS</span><h2>按功能查看</h2></div><p>帮助定位最常用的 AI 或地图流程。</p></div><div className="admin-usage-table-wrap"><table className="admin-usage-table"><thead><tr><th>Provider / endpoint</th><th>Requests</th><th>Tokens</th><th>Places</th><th>Routes</th><th>Estimate</th></tr></thead><tbody>{result.endpoints.map((row, index) => <tr key={`${row.provider}-${index}`}><td>{row.provider}</td><td>{formatNumber(row.requests)}</td><td>{formatNumber(row.totalTokens)}</td><td>{formatNumber(row.placesCalls)}</td><td>{formatNumber(row.routeCalls)}</td><td>{formatCost(row.grossCostUsd)}</td></tr>)}</tbody></table></div></section>
      </>}
      <div className="admin-privacy-note"><strong>安全边界 / Security boundary</strong><p>此页面只显示聚合计数和估算费用，不显示 API key、完整邮箱、密码、私密地址或 OpenAI 请求内容。 / This desk shows aggregate counts and estimates only; secrets, full emails, passwords, private addresses, and prompt contents stay server-side.</p></div>
    </main>
  </div>;
}

"use client";

import { useEffect, useState } from "react";

type Locale = "zh" | "en";
type AnalyticsListing = { id: string; titleZh: string; titleEn: string; status: string; views: number; saves: number; contacts: number; shares: number; inquiries: number };
type AnalyticsPayload = { totals?: Record<string, unknown>; listings?: AnalyticsListing[]; error?: string };
type Promotion = { listing_id: string; status: string };

const metricLabels = {
  zh: { views: "浏览", saves: "收藏", contacts: "联系", shares: "分享", inquiries: "咨询" },
  en: { views: "Views", saves: "Saves", contacts: "Contacts", shares: "Shares", inquiries: "Inquiries" },
};

function metricValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export default function ListingAnalyticsPanel({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [analyticsResponse, promotionsResponse] = await Promise.all([fetch("/api/analytics", { cache: "no-store" }), fetch("/api/promotions", { cache: "no-store" })]);
      const analytics = await analyticsResponse.json() as AnalyticsPayload;
      const promotionResult = await promotionsResponse.json().catch(() => []);
      if (!analyticsResponse.ok) throw new Error(analytics.error || (zh ? "数据暂时无法加载。" : "Analytics are unavailable right now."));
      setPayload(analytics);
      setPromotions(Array.isArray(promotionResult) ? promotionResult as Promotion[] : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : (zh ? "数据暂时无法加载。" : "Analytics are unavailable right now."));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const requestPromotion = async (listingId: string) => {
    setWorkingId(listingId);
    try {
      const response = await fetch("/api/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, package: "featured" }) });
      const result = await response.json().catch(() => ({})) as { id?: string; status?: string; error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "推广申请暂时无法提交。" : "Promotion request could not be submitted."));
      setPromotions((current) => [...current.filter((item) => item.listing_id !== listingId), { listing_id: listingId, status: result.status || "requested" }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : (zh ? "推广申请暂时无法提交。" : "Promotion request could not be submitted."));
    } finally {
      setWorkingId("");
    }
  };
  const totals = payload?.totals || {};
  const metrics = ["views", "saves", "contacts", "shares", "inquiries"] as const;
  return <section className="analytics-panel" aria-labelledby="analytics-title"><div className="account-profile-heading"><div><span className="section-label">LISTING SIGNALS</span><h3 id="analytics-title">{zh ? "房源表现" : "Listing performance"}</h3><p>{zh ? "浏览、收藏、联系和分享都来自真实的房源互动记录。" : "Views, saves, contacts, and shares are based on recorded listing activity."}</p></div><button className="text-button" type="button" onClick={() => void load()}>{zh ? "刷新" : "Refresh"}</button></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="dashboard-loading" aria-live="polite"><span /><span /><span /></div> : <><div className="analytics-metrics">{metrics.map((metric) => <div className="analytics-metric" key={metric}><span>{metricLabels[locale][metric]}</span><strong>{metricValue(totals[metric])}</strong></div>)}</div>{payload?.listings?.length ? <div className="analytics-list">{payload.listings.map((listing) => { const promotion = promotions.find((item) => item.listing_id === listing.id); const promotionLabel = promotion?.status === "active" ? (zh ? "已推广" : "Active") : promotion?.status === "requested" ? (zh ? "待审批" : "Requested") : ""; return <article className="analytics-row" key={listing.id}><div><strong>{zh ? listing.titleZh : listing.titleEn}</strong><small>{listing.status}</small></div><div className="analytics-row-facts"><span>{metricLabels[locale].views} {listing.views}</span><span>{metricLabels[locale].saves} {listing.saves}</span><span>{metricLabels[locale].contacts} {listing.contacts}</span><span>{metricLabels[locale].inquiries} {listing.inquiries}</span></div><div className="analytics-row-action">{promotionLabel ? <span className="status-chip pending">{promotionLabel}</span> : <button className="outline-button" type="button" onClick={() => void requestPromotion(listing.id)} disabled={workingId === listing.id}>{workingId === listing.id ? (zh ? "提交中…" : "Requesting…") : (zh ? "申请推广" : "Request featured")}</button>}</div></article>; })}</div> : <div className="drawer-empty"><h3>{zh ? "还没有表现数据" : "No performance data yet"}</h3><p>{zh ? "发布房源并开始收到浏览或咨询后，数据会显示在这里。" : "Performance will appear after your listings receive views or inquiries."}</p></div>}</>}</section>;
}

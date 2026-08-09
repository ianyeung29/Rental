"use client";

import { useEffect, useState } from "react";

type Locale = "zh" | "en";
type AnalyticsListing = { id: string; titleZh: string; titleEn: string; status: string; views: number; saves: number; contacts: number; shares: number; inquiries: number; wechatShares: number; tiktokShares: number; posterShares: number; updatedAt?: string; availabilityConfirmedAt?: string | null };
type AnalyticsPayload = { totals?: Record<string, unknown>; summary?: { activeListings: number; inquiryRate: number; topListingId: string | null; topListingTitleZh: string | null; topListingTitleEn: string | null }; listings?: AnalyticsListing[]; error?: string };
type Promotion = { listing_id: string; status: string };
type NotificationAddon = {
  listingId: string;
  status: "pending_payment" | "active" | "expired" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  priceCents: number;
  configuredPriceCents: number;
  listingTitleZh?: string;
  listingTitleEn?: string;
  listingStatus?: string;
  checkoutConfigured?: boolean;
};
type NotificationAddonPayload = { addons?: NotificationAddon[]; configuredPriceCents?: number; checkoutConfigured?: boolean; error?: string };

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
  const [notificationAddons, setNotificationAddons] = useState<NotificationAddon[]>([]);
  const [notificationAddonPriceCents, setNotificationAddonPriceCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificationAddonError, setNotificationAddonError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [notificationAddonWorkingId, setNotificationAddonWorkingId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    setNotificationAddonError("");
    try {
      const [analyticsResponse, promotionsResponse, notificationAddonsResponse] = await Promise.all([
        fetch("/api/analytics", { cache: "no-store" }),
        fetch("/api/promotions", { cache: "no-store" }),
        fetch("/api/listing-notification-addons", { cache: "no-store" }),
      ]);
      const analytics = await analyticsResponse.json() as AnalyticsPayload;
      const promotionResult = await promotionsResponse.json().catch(() => []);
      const notificationAddonResult = await notificationAddonsResponse.json().catch(() => ({})) as NotificationAddonPayload;
      if (!analyticsResponse.ok) throw new Error(analytics.error || (zh ? "数据暂时无法加载。" : "Analytics are unavailable right now."));
      setPayload(analytics);
      setPromotions(Array.isArray(promotionResult) ? promotionResult as Promotion[] : []);
      if (notificationAddonsResponse.ok) {
        setNotificationAddons(Array.isArray(notificationAddonResult.addons) ? notificationAddonResult.addons : []);
        setNotificationAddonPriceCents(Number(notificationAddonResult.configuredPriceCents || 0));
      } else {
        setNotificationAddonError(notificationAddonResult.error || (zh ? "保存搜索曝光状态暂时无法加载。" : "Saved-search exposure status is unavailable right now."));
      }
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

  const requestNotificationAddon = async (listingId: string) => {
    setNotificationAddonWorkingId(listingId);
    setNotificationAddonError("");
    try {
      const response = await fetch("/api/listing-notification-addons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
      const result = await response.json().catch(() => ({})) as NotificationAddonPayload & { addon?: NotificationAddon };
      if (!response.ok || !result.addon) throw new Error(result.error || (zh ? "保存搜索曝光申请暂时无法提交。" : "Saved-search exposure request could not be submitted."));
      setNotificationAddonPriceCents(Number(result.addon.configuredPriceCents || notificationAddonPriceCents));
      setNotificationAddons((current) => [...current.filter((item) => item.listingId !== listingId), result.addon!]);
    } catch (requestError) {
      setNotificationAddonError(requestError instanceof Error ? requestError.message : (zh ? "保存搜索曝光申请暂时无法提交。" : "Saved-search exposure request could not be submitted."));
    } finally {
      setNotificationAddonWorkingId("");
    }
  };

  const addonLabel = (addon: NotificationAddon | undefined) => {
    if (addon?.status === "active") return zh ? "已开通" : "Active";
    if (addon?.status === "pending_payment") return zh ? "待确认付款" : "Payment pending";
    if (addon?.status === "expired") return zh ? "已到期" : "Expired";
    if (addon?.status === "cancelled") return zh ? "未开通" : "Not active";
    return zh ? "未开通" : "Not enabled";
  };

  const addonClass = (addon: NotificationAddon | undefined) => addon?.status === "active" ? "published" : addon?.status === "pending_payment" ? "pending" : "unpublished";
  const addonPriceLabel = notificationAddonPriceCents > 0
    ? `$${(notificationAddonPriceCents / 100).toFixed(2)} ${zh ? "/ 房源" : "/ listing"}`
    : (zh ? "付款后开通" : "Payment confirmation required");
  const totals = payload?.totals || {};
  const metrics = ["views", "saves", "contacts", "shares", "inquiries"] as const;

  return <section className="analytics-panel" aria-labelledby="analytics-title">
    <div className="account-profile-heading"><div><span className="section-label">LISTING SIGNALS</span><h3 id="analytics-title">{zh ? "房源表现" : "Listing performance"}</h3><p>{zh ? "浏览、收藏、联系和分享都来自真实的房源互动记录。" : "Views, saves, contacts, and shares are based on recorded listing activity."}</p></div><button className="text-button" type="button" onClick={() => void load()}>{zh ? "刷新" : "Refresh"}</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <div className="dashboard-loading" aria-live="polite"><span /><span /><span /></div> : <>
      <div className="analytics-metrics">{metrics.map((metric) => <div className="analytics-metric" key={metric}><span>{metricLabels[locale][metric]}</span><strong>{metricValue(totals[metric])}</strong></div>)}</div>
      <p className="analytics-owner-view-note">{zh ? "房源所有者自己的浏览不会计入浏览总数。" : "Views from the listing owner are excluded from the totals."}</p>
      {payload?.summary && <div className="analytics-summary-strip"><div><span>{zh ? "已发布房源" : "Active listings"}</span><strong>{payload.summary.activeListings}</strong></div><div><span>{zh ? "咨询转化率" : "Inquiry rate"}</span><strong>{payload.summary.inquiryRate}%</strong></div><div><span>{zh ? "表现最佳" : "Top listing"}</span><strong>{zh ? payload.summary.topListingTitleZh || "—" : payload.summary.topListingTitleEn || "—"}</strong></div></div>}
      {payload?.listings?.length ? <div className="analytics-list">{payload.listings.map((listing) => { const promotion = promotions.find((item) => item.listing_id === listing.id); const promotionLabel = promotion?.status === "active" ? (zh ? "已推广" : "Active") : promotion?.status === "requested" ? (zh ? "待审批" : "Requested") : ""; return <article className="analytics-row" key={listing.id}><div><strong>{zh ? listing.titleZh : listing.titleEn}</strong><small>{listing.status}</small></div><div className="analytics-row-facts"><span>{metricLabels[locale].views} {listing.views}</span><span>{metricLabels[locale].saves} {listing.saves}</span><span>{metricLabels[locale].contacts} {listing.contacts}</span><span>{metricLabels[locale].inquiries} {listing.inquiries}</span><span>{zh ? "转化" : "Rate"} {listing.views > 0 ? (listing.inquiries / listing.views * 100).toFixed(1) + "%" : "—"}</span><span>{zh ? "微信" : "WeChat"} {listing.wechatShares}</span><span>TikTok {listing.tiktokShares}</span></div><div className="analytics-row-action">{promotionLabel ? <span className="status-chip pending">{promotionLabel}</span> : <button className="outline-button" type="button" onClick={() => void requestPromotion(listing.id)} disabled={workingId === listing.id}>{workingId === listing.id ? (zh ? "提交中…" : "Requesting…") : (zh ? "申请推广" : "Request featured")}</button>}</div></article>; })}</div> : <div className="drawer-empty"><h3>{zh ? "还没有表现数据" : "No performance data yet"}</h3><p>{zh ? "发布房源并开始收到浏览或咨询后，数据会显示在这里。" : "Performance will appear after your listings receive views or inquiries."}</p></div>}

      <section className="listing-alert-addon-panel" aria-labelledby="listing-alert-addon-title">
        <div className="listing-alert-addon-heading"><div><span className="section-label">SAVED SEARCH EXPOSURE</span><h3 id="listing-alert-addon-title">{zh ? "保存搜索曝光增值功能" : "Paid saved-search exposure"}</h3><p>{zh ? "付费后，匹配这套房源的保存搜索用户可以收到新房源提醒。普通咨询、租赁申请、看房和房源运营通知，无需付费也会发送给房主。" : "After payment, users with matching saved searches can receive an alert for this listing. Owners still receive normal inquiry, application, tour, and listing-operation notifications without this add-on."}</p></div><strong>{addonPriceLabel}</strong></div>
        <p className="listing-alert-addon-note">{zh ? "当前在线支付尚未接入；申请会进入管理员付款确认队列，确认后才会开通。" : "Online checkout is not connected yet. Requests enter an admin payment-confirmation queue and remain locked until confirmed."}</p>
        {notificationAddonError && <p className="form-error" role="alert">{notificationAddonError}</p>}
        {payload?.listings?.length ? <div className="listing-alert-addon-list">{payload.listings.map((listing) => { const addon = notificationAddons.find((item) => item.listingId === listing.id); const isWorking = notificationAddonWorkingId === listing.id; return <article className="listing-alert-addon-row" key={listing.id}><div><strong>{zh ? listing.titleZh : listing.titleEn}</strong><small>{zh ? "单套房源保存搜索曝光" : "Per-listing saved-search exposure"}</small></div><div className="listing-alert-addon-actions"><span className={`status-chip ${addonClass(addon)}`}>{addonLabel(addon)}</span>{addon?.status !== "active" && addon?.status !== "pending_payment" && <button className="outline-button" type="button" onClick={() => void requestNotificationAddon(listing.id)} disabled={isWorking}>{isWorking ? (zh ? "提交中…" : "Requesting…") : (zh ? "申请开通" : "Request activation")}</button>}</div></article>; })}</div> : <p className="listing-alert-addon-empty">{zh ? "发布第一套房源后，可以在这里申请保存搜索曝光。" : "Publish your first listing to request saved-search exposure here."}</p>}
      </section>
    </>}
  </section>;
}

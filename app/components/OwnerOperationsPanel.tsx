"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DEFAULT_REPLY_TEMPLATES, personalizeReply, type ReplyTemplate } from "../lib/owner-operations";

type Locale = "zh" | "en";

type OwnerListing = {
  id: string;
  titleZh: string;
  titleEn: string;
  status: string;
};

type OwnerInquiry = {
  id: string;
  listingTitle: string;
  requesterName?: string;
  requesterEmail?: string;
};

type OperationListing = OwnerListing & {
  expiresOn: string | null;
  availabilityConfirmedAt: string | null;
  needsConfirmation: boolean;
  views30d: number;
  shares30d: number;
  inquiries30d: number;
  ownerAlertsActive: boolean;
};

type OperationsPayload = {
  staleDays: number;
  summary: { activeListings: number; needsConfirmation: number; views30d: number; shares30d: number; inquiries30d: number };
  listings: OperationListing[];
  replyTemplates: ReplyTemplate[];
};

type OwnerOperationsPanelProps = {
  locale: Locale;
  listings: OwnerListing[];
  inquiries: OwnerInquiry[];
  onListingOperationalChange: (id: string, updates: { status?: "published" | "paused"; availabilityConfirmedAt?: string | null }) => void;
};

function fallbackPayload(listings: OwnerListing[]): OperationsPayload {
  return {
    staleDays: 14,
    summary: { activeListings: listings.filter((listing) => listing.status === "published").length, needsConfirmation: 0, views30d: 0, shares30d: 0, inquiries30d: 0 },
    listings: listings.map((listing) => ({ ...listing, expiresOn: null, availabilityConfirmedAt: null, needsConfirmation: false, views30d: 0, shares30d: 0, inquiries30d: 0, ownerAlertsActive: false })),
    replyTemplates: DEFAULT_REPLY_TEMPLATES,
  };
}

function number(value: unknown) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

export default function OwnerOperationsPanel({ locale, listings, inquiries, onListingOperationalChange }: OwnerOperationsPanelProps) {
  const zh = locale === "zh";
  const [payload, setPayload] = useState<OperationsPayload>(() => fallbackPayload(listings));
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [replyTemplateId, setReplyTemplateId] = useState(DEFAULT_REPLY_TEMPLATES[0]?.id || "");
  const [inquiryId, setInquiryId] = useState("");
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState("");
  const [customDraft, setCustomDraft] = useState({ title: "", body: "" });

  const selectedTemplate = payload.replyTemplates.find((template) => template.id === replyTemplateId) || payload.replyTemplates[0];
  const selectedInquiry = inquiries.find((inquiry) => inquiry.id === inquiryId);
  const replyRecipient = selectedInquiry?.requesterName || selectedInquiry?.requesterEmail || (zh ? "租客" : "the renter");
  const replyListing = selectedInquiry?.listingTitle || (zh ? "这套房源" : "this listing");
  const replyBody = selectedTemplate
    ? personalizeReply(zh ? selectedTemplate.bodyZh : selectedTemplate.bodyEn, { renter: replyRecipient, listing: replyListing })
    : "";
  const staleListings = useMemo(() => payload.listings.filter((listing) => listing.needsConfirmation), [payload.listings]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/owner-operations", { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as Partial<OperationsPayload> & { error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "房东工作台暂时无法加载。" : "Owner operations are unavailable right now."));
      const nextPayload: OperationsPayload = {
        staleDays: number(result.staleDays) || 14,
        summary: {
          activeListings: number(result.summary?.activeListings),
          needsConfirmation: number(result.summary?.needsConfirmation),
          views30d: number(result.summary?.views30d),
          shares30d: number(result.summary?.shares30d),
          inquiries30d: number(result.summary?.inquiries30d),
        },
        listings: Array.isArray(result.listings) ? result.listings as OperationListing[] : fallbackPayload(listings).listings,
        replyTemplates: Array.isArray(result.replyTemplates) && result.replyTemplates.length > 0 ? result.replyTemplates as ReplyTemplate[] : DEFAULT_REPLY_TEMPLATES,
      };
      setPayload(nextPayload);
      setReplyTemplateId((current) => nextPayload.replyTemplates.some((template) => template.id === current) ? current : (nextPayload.replyTemplates[0]?.id || ""));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : (zh ? "房东工作台暂时无法加载。" : "Owner operations are unavailable right now."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const operate = async (listing: OperationListing, action: "confirmAvailability" | "pauseStale") => {
    setWorkingId(listing.id);
    setFeedback("");
    try {
      const response = await fetch("/api/owner-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, listingId: listing.id }) });
      const result = await response.json().catch(() => ({})) as { error?: string; status?: "published" | "paused"; availabilityConfirmedAt?: string | null };
      if (!response.ok) throw new Error(result.error || (zh ? "房源操作暂时无法完成。" : "The listing operation could not be completed."));
      setPayload((current) => ({
        ...current,
        listings: current.listings.map((item) => item.id === listing.id ? { ...item, status: result.status || item.status, needsConfirmation: false, availabilityConfirmedAt: result.availabilityConfirmedAt || item.availabilityConfirmedAt } : item),
        summary: { ...current.summary, needsConfirmation: Math.max(0, current.summary.needsConfirmation - (listing.needsConfirmation ? 1 : 0)), activeListings: action === "pauseStale" ? Math.max(0, current.summary.activeListings - 1) : current.summary.activeListings },
      }));
      onListingOperationalChange(listing.id, action === "pauseStale" ? { status: "paused" } : { availabilityConfirmedAt: result.availabilityConfirmedAt || new Date().toISOString() });
      setFeedback(action === "pauseStale" ? (zh ? "房源已暂停，之后可以重新发布。" : "The listing is paused and can be republished later.") : (zh ? "已确认房源仍可租。" : "Availability confirmed."));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : (zh ? "房源操作暂时无法完成。" : "The listing operation could not be completed."));
    } finally {
      setWorkingId("");
    }
  };

  const copyReply = async () => {
    if (!replyBody) return;
    try {
      await navigator.clipboard.writeText(replyBody);
      setFeedback(zh ? "回复内容已复制。" : "Reply copied.");
    } catch {
      setFeedback(zh ? "复制失败，请手动选择文字。" : "Copy failed; select the reply text manually.");
    }
  };

  const openReplyEmail = () => {
    if (!selectedInquiry?.requesterEmail || !replyBody) return;
    window.location.href = `mailto:${selectedInquiry.requesterEmail}?subject=${encodeURIComponent(zh ? `关于${replyListing}的回复` : `About ${replyListing}`)}&body=${encodeURIComponent(replyBody)}`;
  };

  const saveCustomTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomSaving(true);
    setCustomError("");
    try {
      const response = await fetch("/api/reply-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleZh: customDraft.title, titleEn: customDraft.title, bodyZh: customDraft.body, bodyEn: customDraft.body }) });
      const result = await response.json().catch(() => ({})) as { template?: ReplyTemplate; error?: string };
      if (!response.ok || !result.template) throw new Error(result.error || (zh ? "回复模板无法保存。" : "Reply template could not be saved."));
      setPayload((current) => ({ ...current, replyTemplates: [...current.replyTemplates, result.template!] }));
      setReplyTemplateId(result.template.id);
      setCustomDraft({ title: "", body: "" });
      setCustomFormOpen(false);
      setFeedback(zh ? "回复模板已保存。" : "Reply template saved.");
    } catch (error) {
      setCustomError(error instanceof Error ? error.message : (zh ? "回复模板无法保存。" : "Reply template could not be saved."));
    } finally {
      setCustomSaving(false);
    }
  };

  const deleteTemplate = async (template: ReplyTemplate) => {
    if (template.isDefault) return;
    try {
      const response = await fetch(`/api/reply-templates/${encodeURIComponent(template.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setPayload((current) => ({ ...current, replyTemplates: current.replyTemplates.filter((item) => item.id !== template.id) }));
      setReplyTemplateId((current) => current === template.id ? (DEFAULT_REPLY_TEMPLATES[0]?.id || "") : current);
      setFeedback(zh ? "回复模板已删除。" : "Reply template deleted.");
    } catch {
      setFeedback(zh ? "回复模板无法删除。" : "Reply template could not be deleted.");
    }
  };

  return <section className="owner-operations-panel" aria-labelledby="owner-operations-title">
    <div className="owner-operations-heading"><div><span className="section-label">OWNER DESK</span><h3 id="owner-operations-title">{zh ? "房东运营工作台" : "Owner operations"}</h3><p>{zh ? `集中处理房源确认、表现和租客回复。超过 ${payload.staleDays} 天未确认的已发布房源会显示在这里。` : `Keep availability, performance, and renter replies in one place. Published listings appear here after ${payload.staleDays} days without a confirmation.`}</p></div><button className="text-button" type="button" onClick={() => void load()}>{zh ? "刷新" : "Refresh"}</button></div>
    {feedback && <p className="owner-operations-feedback" role="status">{feedback}</p>}
    {loading ? <div className="owner-operations-loading" aria-live="polite"><span /><span /><span /></div> : <>
      <div className="owner-operations-summary" aria-label={zh ? "房东运营摘要" : "Owner operations summary"}>
        <div><span>{zh ? "已发布" : "Active"}</span><strong>{payload.summary.activeListings}</strong></div>
        <div className={payload.summary.needsConfirmation > 0 ? "attention" : ""}><span>{zh ? "待确认" : "Needs confirmation"}</span><strong>{payload.summary.needsConfirmation}</strong></div>
        <div><span>{zh ? "近30天咨询" : "Inquiries · 30d"}</span><strong>{payload.summary.inquiries30d}</strong></div>
        <div><span>{zh ? "近30天分享" : "Shares · 30d"}</span><strong>{payload.summary.shares30d}</strong></div>
      </div>
      <section className="owner-availability-queue" aria-labelledby="owner-availability-title">
        <div className="owner-operations-subheading"><div><span className="section-label">AVAILABILITY</span><h4 id="owner-availability-title">{zh ? "确认房源仍可租" : "Confirm listings are still available"}</h4></div><span>{staleListings.length}</span></div>
        {staleListings.length === 0 ? <p className="owner-operations-empty">{zh ? "暂时没有需要确认的房源。定期确认可以减少租客看到过期信息。" : "Nothing needs confirmation right now. Regular confirmations help prevent stale listings from misleading renters."}</p> : <div className="owner-availability-list">{staleListings.map((listing) => <article className="owner-availability-row" key={listing.id}><div><strong>{zh ? listing.titleZh : listing.titleEn}</strong><small>{zh ? `近30天：${listing.views30d} 次浏览 · ${listing.inquiries30d} 条咨询` : `${listing.views30d} views · ${listing.inquiries30d} inquiries in the last 30 days`}</small></div><div className="owner-availability-actions"><button className="primary-button" type="button" onClick={() => { void operate(listing, "confirmAvailability"); }} disabled={workingId === listing.id}>{workingId === listing.id ? (zh ? "处理中…" : "Working…") : (zh ? "仍可租" : "Still available")}</button><button className="text-button" type="button" onClick={() => { void operate(listing, "pauseStale"); }} disabled={workingId === listing.id}>{zh ? "暂停房源" : "Pause listing"}</button></div></article>)}</div>}
      </section>
      <section className="owner-reply-kit" aria-labelledby="owner-reply-title">
        <div className="owner-operations-subheading"><div><span className="section-label">REPLY KIT</span><h4 id="owner-reply-title">{zh ? "常用回复" : "Reusable replies"}</h4></div><button className="outline-button" type="button" onClick={() => setCustomFormOpen((open) => !open)}>{customFormOpen ? (zh ? "取消" : "Cancel") : (zh ? "新建模板" : "New template")}</button></div>
        <p className="owner-reply-help">{zh ? "用 {{renter}} 和 {{listing}} 自动代入租客及房源名称。" : "Use {{renter}} and {{listing}} to personalize a reply automatically."}</p>
        {customFormOpen && <form className="owner-reply-form" onSubmit={saveCustomTemplate}><label className="field-label"><span>{zh ? "模板名称" : "Template name"}</span><input value={customDraft.title} onChange={(event) => setCustomDraft((current) => ({ ...current, title: event.target.value }))} maxLength={100} required /></label><label className="field-label"><span>{zh ? "回复内容" : "Reply text"}</span><textarea rows={3} value={customDraft.body} onChange={(event) => setCustomDraft((current) => ({ ...current, body: event.target.value }))} maxLength={2000} required /></label>{customError && <p className="form-error" role="alert">{customError}</p>}<button className="primary-button" type="submit" disabled={customSaving}>{customSaving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存模板" : "Save template")}</button></form>}
        <div className="owner-reply-inquiry"><label className="field-label"><span>{zh ? "选择咨询（可选）" : "Choose an inquiry (optional)"}</span><select value={inquiryId} onChange={(event) => setInquiryId(event.target.value)}><option value="">{zh ? "不指定租客" : "No renter selected"}</option>{inquiries.map((inquiry) => <option key={inquiry.id} value={inquiry.id}>{inquiry.listingTitle} · {inquiry.requesterName || inquiry.requesterEmail || (zh ? "租客" : "Renter")}</option>)}</select></label></div>
        <div className="owner-reply-list">{payload.replyTemplates.map((template) => <article className={`owner-reply-row ${template.id === selectedTemplate?.id ? "selected" : ""}`} key={template.id}><button className="owner-reply-select" type="button" onClick={() => setReplyTemplateId(template.id)}><strong>{zh ? template.titleZh : template.titleEn}</strong><span>{personalizeReply(zh ? template.bodyZh : template.bodyEn, { renter: replyRecipient, listing: replyListing })}</span></button><div className="owner-reply-actions">{!template.isDefault && <button className="text-button" type="button" onClick={() => { void deleteTemplate(template); }}>{zh ? "删除" : "Delete"}</button>}</div></article>)}</div>
        {selectedTemplate && <div className="owner-reply-preview"><span>{zh ? "预览" : "Preview"}</span><p>{replyBody}</p><div className="owner-reply-actions"><button className="outline-button" type="button" onClick={() => { void copyReply(); }}>{zh ? "复制回复" : "Copy reply"}</button>{selectedInquiry?.requesterEmail && <button className="primary-button" type="button" onClick={openReplyEmail}>{zh ? "打开邮件" : "Open email"}</button>}</div></div>}
      </section>
    </>}
  </section>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SiteFooter from "./SiteFooter";
import portraitStyles from "./AgentPortrait.module.css";

type Locale = "zh" | "en";
type QueueStatus = "pending" | "rejected" | "expired" | "unsubmitted";
type ReviewAction = "verified" | "rejected";

type AgentApplication = {
  user_id: string;
  display_name: string;
  email: string;
  account_type: string;
  agent_verification_status: QueueStatus;
  profile_id: string | null;
  portrait_url: string | null;
  brokerage: string | null;
  license_state: string | null;
  license_number: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_note: string | null;
};

function formatDate(value: string | null, locale: Locale) {
  if (!value) return locale === "zh" ? "尚未提交" : "Not submitted";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: QueueStatus, locale: Locale) {
  if (status === "pending") return locale === "zh" ? "待审核" : "Pending review";
  if (status === "rejected") return locale === "zh" ? "需要补充" : "Needs update";
  if (status === "expired") return locale === "zh" ? "已过期" : "Expired";
  return locale === "zh" ? "尚未提交" : "Not submitted";
}

function statusClass(status: QueueStatus) {
  if (status === "pending") return "pending";
  if (status === "rejected" || status === "expired") return "expired";
  return "unpublished";
}

export default function AdminAgentVerificationDesk({ adminName }: { adminName: string }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const [applications, setApplications] = useState<AgentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const zh = locale === "zh";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("rental-marketplace.locale");
        if (saved === "en" || saved === "zh") setLocale(saved);
      } catch {
        // The admin desk remains usable when local storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("rental-marketplace.locale", locale);
    } catch {
      // The locale switch is a convenience, not a requirement for review.
    }
  }, [locale]);

  const loadApplications = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/agent-verifications", { cache: "no-store" });
      const result = await response.json().catch(() => null) as AgentApplication[] | { error?: string } | null;
      if (!response.ok) {
        throw new Error(result && !Array.isArray(result) && result.error ? result.error : (zh ? "核验申请暂时无法读取。" : "The verification queue could not be loaded."));
      }
      setApplications(Array.isArray(result) ? result : []);
      setLastUpdated(new Date().toISOString());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : (zh ? "核验申请暂时无法读取。" : "The verification queue could not be loaded."));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [zh]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadApplications(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadApplications]);

  const pendingCount = useMemo(() => applications.filter((application) => application.agent_verification_status === "pending").length, [applications]);
  const submittedCount = useMemo(() => applications.filter((application) => application.profile_id && application.license_state && application.license_number).length, [applications]);

  const updateApplication = async (application: AgentApplication, status: ReviewAction) => {
    const key = `${application.user_id}:${status}`;
    setActionKey(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/agent-verifications/${encodeURIComponent(application.user_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: notes[application.user_id] || "" }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "审核决定暂时无法保存。" : "The review decision could not be saved."));
      setNotes((current) => {
        const next = { ...current };
        delete next[application.user_id];
        return next;
      });
      await loadApplications(false);
      setNotice(status === "verified"
        ? (zh ? `${application.display_name} 已通过经纪身份核验。` : `${application.display_name} is now verified.`)
        : (zh ? `${application.display_name} 的申请已退回补充。` : `${application.display_name}'s application was returned for updates.`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : (zh ? "审核决定暂时无法保存。" : "The review decision could not be saved."));
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">{zh ? "跳到主要内容" : "Skip to main content"}</a>
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <Link className="brand" href="/" aria-label="安居 Anjurentals home">
            <Image className="brand-logo" src="/brand/anjurentals-mark.svg" alt="" width={30} height={30} priority />
            <span className="brand-wordmark"><strong>安居</strong><small>ANJURENTALS</small></span>
          </Link>
          <div className="admin-topbar-actions">
            <span className="admin-user-label"><span>{zh ? "管理员" : "Admin"}</span>{adminName}</span>
            <button className="language-switch" type="button" onClick={() => setLocale((current) => current === "zh" ? "en" : "zh")} aria-label={zh ? "Switch to English" : "切换到中文"}>
              <span className="language-dot" aria-hidden="true" />
              {zh ? "English" : "中文"}
            </button>
            <Link className="admin-back-link" href="/">{zh ? "返回找房" : "Back to rentals"}</Link>
          </div>
        </div>
      </header>

      <main id="admin-content" className="admin-main">
        <nav className="admin-breadcrumb" aria-label={zh ? "管理后台路径" : "Admin breadcrumb"}>
          <Link href="/">{zh ? "找房" : "Rentals"}</Link>
          <span aria-hidden="true">/</span>
          <span>{zh ? "经纪身份核验" : "Agent verification"}</span>
        </nav>

        <div className="admin-heading">
          <div>
            <h1>{zh ? "核验经纪身份" : "Review agent identity"}</h1>
            <p>{zh ? "核对申请人提交的执照州、编号和所属经纪公司；通过后，系统才会开启更高的房源发布额度。" : "Check the submitted license state, number, and brokerage before enabling the higher listing capacity."}</p>
          </div>
          <button className="outline-button" type="button" onClick={() => { void loadApplications(); }} disabled={loading}>
            {loading ? (zh ? "读取中…" : "Loading…") : (zh ? "刷新申请" : "Refresh queue")}
          </button>
        </div>

        <div className="admin-summary-row" aria-label={zh ? "核验队列摘要" : "Verification queue summary"}>
          <div><span>{zh ? "待审核" : "Pending"}</span><strong>{pendingCount}</strong></div>
          <div><span>{zh ? "已提交资料" : "Submitted profiles"}</span><strong>{submittedCount}</strong></div>
          <p>{lastUpdated ? (zh ? `最近更新：${formatDate(lastUpdated, locale)}` : `Last updated: ${formatDate(lastUpdated, locale)}`) : (zh ? "正在读取队列…" : "Loading queue…")}</p>
        </div>

        {error && <div className="admin-alert" role="alert"><strong>{zh ? "队列读取失败" : "Queue unavailable"}</strong><span>{error}</span><button className="text-button" type="button" onClick={() => { void loadApplications(); }}>{zh ? "重试" : "Try again"}</button></div>}
        {notice && <div className="admin-notice" role="status">{notice}</div>}

        <section className="admin-queue" aria-labelledby="admin-queue-title">
          <div className="admin-queue-heading">
            <div><span className="section-label">REVIEW QUEUE</span><h2 id="admin-queue-title">{zh ? "经纪申请" : "Agent applications"}</h2></div>
            <p>{zh ? "通过或退回后，申请会从待处理队列中更新。" : "Approved and returned applications update the queue immediately."}</p>
          </div>

          {loading ? <div className="admin-application-skeletons" aria-label={zh ? "正在读取申请" : "Loading applications"}><span /><span /><span /></div> : applications.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-mark" aria-hidden="true">✓</span><h3>{zh ? "目前没有待处理申请" : "No applications need attention"}</h3><p>{zh ? "新的经纪账户提交执照资料后，会显示在这里。" : "New applications will appear here after an agent submits license details."}</p><Link className="outline-button" href="/">{zh ? "返回找房" : "Back to rentals"}</Link></div> : <div className="admin-application-list">
            {applications.map((application) => {
              const hasLicense = Boolean(application.profile_id && application.license_state && application.license_number);
              const busy = actionKey?.startsWith(`${application.user_id}:`) === true;
              return <article className="admin-application" key={application.user_id}>
                <div className="admin-application-header">
                  <div><span className={`status-chip ${statusClass(application.agent_verification_status)}`}>{statusLabel(application.agent_verification_status, locale)}</span><span className="admin-application-date">{zh ? "提交于" : "Submitted"} {formatDate(application.verification_submitted_at, locale)}</span></div>
                  <div><h3>{application.display_name}</h3><p>{application.email}</p></div>
                </div>
                <div className="admin-application-body">
                  {application.portrait_url && <div className={portraitStyles.adminReview}><Image src={application.portrait_url} alt={zh ? `经纪 ${application.display_name} 的头像` : `${application.display_name}'s portrait`} width={88} height={88} /><div><strong>{zh ? "经纪头像" : "Agent portrait"}</strong><p>{zh ? "供管理员在核验身份时参考。" : "Reference image for the identity review."}</p></div></div>}
                  <dl className="admin-application-facts">
                    <div><dt>{zh ? "执照州 / 编号" : "License state / number"}</dt><dd>{hasLicense ? `${application.license_state} · ${application.license_number}` : (zh ? "尚未提交" : "Not submitted")}</dd></div>
                    <div><dt>{zh ? "所属经纪公司" : "Brokerage"}</dt><dd>{application.brokerage || (zh ? "尚未提交" : "Not submitted")}</dd></div>
                    <div><dt>{zh ? "上次审核" : "Last reviewed"}</dt><dd>{formatDate(application.verification_reviewed_at, locale)}</dd></div>
                  </dl>
                  <div className="admin-review-controls">
                    <label className="admin-note-field"><span>{zh ? "审核备注（可选）" : "Review note (optional)"}</span><textarea value={notes[application.user_id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [application.user_id]: event.target.value }))} maxLength={1000} placeholder={zh ? "例如：已在纽约州公开记录核对。" : "e.g. Checked against the New York public license record."} disabled={Boolean(actionKey)} /></label>
                    <div className="admin-application-actions">
                      {hasLicense ? <>
                        <button className="primary-button" type="button" onClick={() => { void updateApplication(application, "verified"); }} disabled={Boolean(actionKey)}>{busy && actionKey === `${application.user_id}:verified` ? (zh ? "保存中…" : "Saving…") : (zh ? "通过核验" : "Approve verification")}</button>
                        <button className="outline-button" type="button" onClick={() => { void updateApplication(application, "rejected"); }} disabled={Boolean(actionKey)}>{busy && actionKey === `${application.user_id}:rejected` ? (zh ? "保存中…" : "Saving…") : (zh ? "退回补充" : "Return for updates")}</button>
                      </> : <p className="admin-no-submission">{zh ? "等待申请人提交执照资料后才能审核。" : "Waiting for license details before review."}</p>}
                    </div>
                  </div>
                </div>
              </article>;
            })}
          </div>}
        </section>

        <aside className="admin-privacy-note">
          <strong>{zh ? "核验边界" : "Verification boundary"}</strong>
          <p>{zh ? "安居目前收集执照资料并由管理员人工核对公开州记录；通过核验只代表经纪身份资料已核对，不代表房源、房屋所有权或服务质量已获保证。" : "Anjurentals currently collects license details and relies on a manual check against public state records. Approval confirms the submitted agent identity only; it does not guarantee a listing, property ownership, or service quality."}</p>
        </aside>
      </main>

      <SiteFooter />
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

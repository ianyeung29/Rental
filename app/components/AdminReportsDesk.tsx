"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type ModerationStatus = "approved" | "under_review" | "hidden" | "rejected";

type ModerationReport = {
  id: string;
  listingId: string;
  titleZh: string;
  titleEn: string;
  areaZh: string;
  areaEn: string;
  listingPrice: number;
  listingModerationStatus: ModerationStatus;
  ownerName: string;
  ownerEmail: string;
  reporterName: string;
  reporterEmail: string;
  reason: string;
  details: string;
  status: ReportStatus;
  reviewNote: string;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  reportCount: number;
  photoCount: number;
  reviewSignals: string[];
};

type ReportCounts = Record<ReportStatus, number>;
type Filter = "all" | ReportStatus;

const EMPTY_COUNTS: ReportCounts = { open: 0, reviewing: 0, resolved: 0, dismissed: 0 };
const reasonLabels: Record<string, string> = {
  misleading: "信息可能不实",
  scam: "疑似诈骗",
  discriminatory: "歧视性内容",
  privacy: "隐私或地址问题",
  other: "其他问题",
};
const statusLabels: Record<ReportStatus, string> = {
  open: "待处理",
  reviewing: "审核中",
  resolved: "已处理",
  dismissed: "已驳回",
};
const moderationLabels: Record<ModerationStatus, string> = {
  approved: "公开中",
  under_review: "审核中",
  hidden: "已隐藏",
  rejected: "未通过",
};

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function statusClass(status: string) {
  if (status === "approved") return "published";
  if (status === "hidden" || status === "rejected") return "expired";
  return "pending";
}

export default function AdminReportsDesk({ adminName }: { adminName: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [counts, setCounts] = useState<ReportCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const response = await fetch(`/api/admin/reports${query}`, { cache: "no-store" });
      const result = await response.json() as { reports?: ModerationReport[]; counts?: ReportCounts; error?: string };
      if (!response.ok) throw new Error(result.error || "审核队列暂时无法读取。");
      setReports(Array.isArray(result.reports) ? result.reports : []);
      setCounts({ ...EMPTY_COUNTS, ...(result.counts || {}) });
      setNotes((current) => Object.fromEntries((result.reports || []).map((report) => [report.id, current[report.id] ?? report.reviewNote])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "审核队列暂时无法读取。");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const activeCount = useMemo(() => counts.open + counts.reviewing, [counts]);

  const updateReport = async (report: ModerationReport, input: { status?: ReportStatus; moderationStatus?: ModerationStatus }) => {
    setWorkingId(report.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, note: notes[report.id] || "" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "审核决定保存失败。");
      setNotice("审核决定已保存，相关账号会收到站内通知。");
      await loadReports();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "审核决定保存失败。");
    } finally {
      setWorkingId(null);
    }
  };

  const saveNote = async (report: ModerationReport) => updateReport(report, { status: report.status });

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <Link className="brand" href="/"><span className="brand-wordmark"><strong>安居</strong><small>ANJURENTALS</small></span></Link>
          <div className="admin-topbar-actions"><span className="admin-user-label"><span>ADMIN</span>{adminName}</span><Link className="admin-back-link" href="/">返回安居</Link></div>
        </div>
      </header>
      <main className="admin-main">
        <div className="admin-breadcrumb"><Link href="/">安居</Link><span>/</span><span>安全审核</span></div>
        <div className="admin-heading">
          <div><h1>安全审核队列</h1><p>先确认事实，再决定房源是否继续公开。举报只是审核信号，不会自动认定房源或用户违规。</p></div>
          <Link className="outline-button" href="/#account">返回账号工作台</Link>
        </div>
        <div className="admin-summary-row admin-moderation-summary">
          <div><span>待处理</span><strong>{activeCount}</strong></div>
          <div><span>已处理</span><strong>{counts.resolved}</strong></div>
          <p>房源公开状态和举报处理状态分开记录，方便恢复和追踪。</p>
        </div>
        {error && <p className="admin-alert" role="alert"><strong>无法完成操作</strong><span>{error}</span><button className="text-button" type="button" onClick={() => void loadReports()}>重试</button></p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        <section className="admin-queue" aria-labelledby="moderation-queue-title">
          <div className="admin-queue-heading"><div><span className="section-label">TRUST &amp; SAFETY</span><h2 id="moderation-queue-title">举报记录</h2></div><p>审核人员可保留公开、暂时隐藏、拒绝发布或恢复公开，并留下说明。</p></div>
          <div className="admin-filter-bar" role="group" aria-label="筛选举报状态">
            {(["all", "open", "reviewing", "resolved", "dismissed"] as Filter[]).map((value) => <button className={`admin-filter-button ${filter === value ? "active" : ""}`} key={value} type="button" onClick={() => setFilter(value)}>{value === "all" ? "全部" : statusLabels[value]}<span>{value === "all" ? Object.values(counts).reduce((sum, count) => sum + count, 0) : counts[value]}</span></button>)}
          </div>
          {loading ? <div className="admin-application-skeletons" aria-live="polite"><span /><span /></div> : reports.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-mark">✓</span><h3>{filter === "all" ? "暂时没有举报" : `没有${statusLabels[filter]}举报`}</h3><p>新的安全举报会在这里出现。收到举报后，系统会先把房源标记为“审核中”，但不会自动隐藏。</p></div> : <div className="admin-moderation-list">{reports.map((report) => {
            const busy = workingId === report.id;
            const listingTitle = report.titleZh || report.titleEn || "未命名房源";
            const listingArea = report.areaZh || report.areaEn || "未填写区域";
            return <article className="admin-moderation-item" key={report.id}>
              <header className="admin-moderation-item-header"><div><span className={`status-chip ${statusClass(report.status)}`}>{statusLabels[report.status]}</span><span className={`status-chip ${statusClass(report.listingModerationStatus)}`}>{moderationLabels[report.listingModerationStatus]}</span><span className="admin-application-date">{dateLabel(report.createdAt)}</span></div><h3>{listingTitle}</h3><p>{listingArea} · ${report.listingPrice.toLocaleString("en-US")}/月 · 房源 ID {report.listingId}</p></header>
              <div className="admin-moderation-body">
                <dl className="admin-moderation-facts"><div><dt>举报原因</dt><dd>{reasonLabels[report.reason] || report.reason}</dd></div><div><dt>举报人</dt><dd>{report.reporterName || "用户"}<br /><small>{report.reporterEmail}</small></dd></div><div><dt>发布者</dt><dd>{report.ownerName || "未登录发布"}<br /><small>{report.ownerEmail || "无账号邮箱"}</small></dd></div><div><dt>房源信号</dt><dd>{report.photoCount} 张照片 · {report.reportCount} 次举报</dd></div></dl>
                {report.details && <blockquote className="admin-report-details">“{report.details}”</blockquote>}
                {report.reviewSignals.length > 0 && <div className="admin-review-signals"><strong>辅助审核信号</strong><span>{report.reviewSignals.join(" · ")}</span><small>这些信号只用于排序和复核，不是自动判定。</small></div>}
                <div className="admin-review-controls"><label className="admin-note-field"><span>审核说明（会记录到审计历史）</span><textarea value={notes[report.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={1_000} rows={3} placeholder="例如：已核对公开记录；暂不采取下架措施。" /></label><div className="admin-application-actions">
                  {report.status === "open" && <button className="outline-button" type="button" onClick={() => void updateReport(report, { status: "reviewing" })} disabled={busy}>开始审核</button>}
                  <button className="text-button" type="button" onClick={() => void saveNote(report)} disabled={busy}>保存说明</button>
                  {report.listingModerationStatus !== "approved" && <button className="outline-button" type="button" onClick={() => void updateReport(report, { moderationStatus: "approved" })} disabled={busy}>恢复公开</button>}
                  {report.listingModerationStatus !== "hidden" && <button className="outline-button moderation-warning-button" type="button" onClick={() => void updateReport(report, { moderationStatus: "hidden" })} disabled={busy}>暂时隐藏</button>}
                  {report.listingModerationStatus !== "rejected" && <button className="primary-button" type="button" onClick={() => void updateReport(report, { moderationStatus: "rejected" })} disabled={busy}>拒绝发布</button>}
                  {report.status !== "dismissed" && <button className="text-button" type="button" onClick={() => void updateReport(report, { status: "dismissed", moderationStatus: "approved" })} disabled={busy}>驳回举报并保持公开</button>}
                </div></div>
              </div>
            </article>;
          })}</div>}
        </section>
        <div className="admin-privacy-note"><strong>审核边界</strong><p>管理员决定只影响房源公开状态，不会把举报人的姓名或邮箱分享给发布者。邮件通知依赖 Resend 配置；即使邮件暂时失败，数据库里的决定、站内通知和审计记录仍会保存。</p></div>
      </main>
    </div>
  );
}

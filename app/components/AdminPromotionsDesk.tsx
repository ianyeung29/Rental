"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LocaleRow = { title_zh?: string; title_en?: string; area_zh?: string; area_en?: string };
type Promotion = LocaleRow & { id: string; listing_id: string; package: string; status: string; note: string; requester_name: string; requester_email: string; created_at: string };

const labels: Record<string, string> = { requested: "待处理", active: "已启用", completed: "已完成", declined: "已拒绝" };

export default function AdminPromotionsDesk({ adminName }: { adminName: string }) {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/promotions", { cache: "no-store" });
      const result = await response.json() as Promotion[] | { error?: string };
      if (!response.ok || !Array.isArray(result)) throw new Error((result as { error?: string }).error || "推广申请无法加载。");
      setRows(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "推广申请无法加载。");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  const update = async (id: string, status: string) => {
    setWorkingId(id);
    try {
      const response = await fetch("/api/admin/promotions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!response.ok) throw new Error("状态更新失败。");
      setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "状态更新失败。");
    } finally {
      setWorkingId("");
    }
  };
  return <div className="admin-shell"><header className="admin-topbar"><div className="admin-topbar-inner"><Link className="brand" href="/"><span className="brand-wordmark"><strong>安居</strong><small>ANJURENTALS</small></span></Link><div className="admin-topbar-actions"><span className="admin-user-label"><span>ADMIN</span>{adminName}</span><Link className="admin-back-link" href="/">返回安居</Link></div></div></header><main className="admin-main"><div className="admin-breadcrumb"><Link href="/">安居</Link><span>/</span><span>推广申请</span></div><div className="admin-heading"><div><h1>房源推广申请</h1><p>这是一个可审计的商业化入口。当前只记录申请和人工审批，不会自动向房主收费。</p></div></div><section className="admin-queue"><div className="admin-queue-heading"><div><span className="section-label">PROMOTION DESK</span><h2>申请队列</h2></div><p>通过后，后续可以接入 Stripe 或其他支付与投放规则。</p></div>{error && <p className="admin-alert">{error}</p>}{loading ? <div className="admin-application-skeletons"><span /><span /></div> : rows.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-mark">—</span><h3>还没有推广申请</h3><p>房主从账号工作台提交推广请求后，会显示在这里。</p></div> : <div className="admin-application-list">{rows.map((row) => <article className="admin-application" key={row.id}><div className="admin-application-header"><div><span className={`status-chip ${row.status === "active" ? "published" : row.status === "declined" ? "expired" : "pending"}`}>{labels[row.status] || row.status}</span><span className="admin-application-date">{new Date(row.created_at).toLocaleString("zh-CN")}</span></div><h3>{row.title_zh || row.title_en || "房源"}</h3><p>{row.area_zh || row.area_en || ""} · {row.requester_name} · {row.requester_email}</p></div><div className="admin-application-body"><dl className="admin-application-facts"><div><dt>方案</dt><dd>{row.package}</dd></div><div><dt>房源 ID</dt><dd>{row.listing_id}</dd></div><div><dt>备注</dt><dd>{row.note || "未填写"}</dd></div></dl><div className="admin-review-controls"><span className="field-help">审批只是状态操作；收费和展示位置仍需人工确认。</span><div className="admin-application-actions">{row.status === "requested" && <><button className="primary-button" type="button" onClick={() => void update(row.id, "active")} disabled={workingId === row.id}>通过申请</button><button className="outline-button" type="button" onClick={() => void update(row.id, "declined")} disabled={workingId === row.id}>拒绝</button></>}{row.status === "active" && <button className="outline-button" type="button" onClick={() => void update(row.id, "completed")} disabled={workingId === row.id}>标记完成</button>}</div></div></div></article>)}</div>}</section><div className="admin-privacy-note"><strong>商业化边界</strong><p>系统不会在没有支付集成和明确确认前收费；推广申请只作为运营队列和未来套餐的接口。</p></div></main></div>;
}

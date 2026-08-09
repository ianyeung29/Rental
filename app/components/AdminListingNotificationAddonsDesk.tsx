"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Addon = {
  listingId: string;
  ownerId: string;
  status: "pending_payment" | "active" | "expired" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  priceCents: number;
  paymentReference: string;
  paidAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  listingTitleZh: string;
  listingTitleEn: string;
  listingAreaZh: string;
  listingAreaEn: string;
  ownerName: string;
  ownerEmail: string;
  listingStatus: string;
};

type Payload = { addons?: Addon[]; configuredPriceCents?: number; error?: string };

const statusLabels: Record<Addon["status"], string> = {
  pending_payment: "待确认付款",
  active: "已开通",
  expired: "已停止",
  cancelled: "已取消",
};

const paymentLabels: Record<Addon["paymentStatus"], string> = {
  unpaid: "未付款",
  paid: "已付款",
  refunded: "已退款",
};

function money(cents: number) {
  return cents > 0 ? `$${(cents / 100).toFixed(2)}` : "待配置";
}

export default function AdminListingNotificationAddonsDesk({ adminName }: { adminName: string }) {
  const [rows, setRows] = useState<Addon[]>([]);
  const [priceCents, setPriceCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/listing-notification-addons", { cache: "no-store" });
      const result = await response.json() as Payload;
      if (!response.ok || !Array.isArray(result.addons)) throw new Error(result.error || "保存搜索曝光申请无法加载。");
      setRows(result.addons);
      setPriceCents(Number(result.configuredPriceCents || 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "保存搜索曝光申请无法加载。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const update = async (row: Addon, action: "confirm_paid" | "cancel" | "refund") => {
    let paymentReference = row.paymentReference;
    if (action === "confirm_paid") {
      const entered = window.prompt("请输入付款参考号（可选）：", row.paymentReference);
      if (entered === null) return;
      paymentReference = entered.trim();
    } else if (!window.confirm(action === "refund" ? "确认将这项保存搜索曝光标记为已退款并停止吗？" : "确认取消这项保存搜索曝光申请吗？")) {
      return;
    }
    setWorkingId(row.listingId);
    setError("");
    try {
      const response = await fetch("/api/admin/listing-notification-addons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: row.listingId, action, paymentReference }),
      });
      const result = await response.json() as { addon?: Addon; error?: string };
      if (!response.ok || !result.addon) throw new Error(result.error || "保存搜索曝光状态更新失败。");
      setRows((current) => current.map((item) => item.listingId === row.listingId ? result.addon! : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "保存搜索曝光状态更新失败。");
    } finally {
      setWorkingId("");
    }
  };

  return <div className="admin-shell">
    <header className="admin-topbar"><div className="admin-topbar-inner"><Link className="brand" href="/"><span className="brand-wordmark"><strong>安居</strong><small>ANJURENTALS</small></span></Link><div className="admin-topbar-actions"><span className="admin-user-label"><span>ADMIN</span>{adminName}</span><Link className="admin-back-link" href="/">返回安居</Link></div></div></header>
    <main className="admin-main">
      <div className="admin-breadcrumb"><Link href="/">安居</Link><span>/</span><span>保存搜索曝光</span></div>
      <div className="admin-heading"><div><h1>保存搜索曝光付款确认</h1><p>确认付款后，匹配这套房源的保存搜索用户才会收到房源提醒。房主自己的咨询、租赁申请、看房和房源运营通知不受此功能影响。当前在线支付尚未接入，管理员只负责确认外部付款记录。</p></div></div>
      <section className="admin-queue">
        <div className="admin-queue-heading"><div><span className="section-label">SAVED SEARCH EXPOSURE DESK</span><h2>付款确认队列</h2></div><p>当前配置价格：{money(priceCents)}。未配置价格时仍可人工确认，但不会自动收费。</p></div>
        {error && <p className="admin-alert" role="alert">{error}</p>}
        {loading ? <div className="admin-application-skeletons"><span /><span /></div> : rows.length === 0 ? <div className="admin-empty-state"><span className="admin-empty-mark">—</span><h3>还没有保存搜索曝光申请</h3><p>房主从账号工作台申请单套房源保存搜索曝光后，会显示在这里。</p></div> : <div className="admin-application-list">{rows.map((row) => {
          const isWorking = workingId === row.listingId;
          const title = row.listingTitleZh || row.listingTitleEn || "房源";
          const area = row.listingAreaZh || row.listingAreaEn;
          return <article className="admin-application" key={row.listingId}>
            <div className="admin-application-header"><div><span className={`status-chip ${row.status === "active" ? "published" : row.status === "cancelled" || row.status === "expired" ? "expired" : "pending"}`}>{statusLabels[row.status]}</span><span className="admin-application-date">{row.updatedAt ? new Date(row.updatedAt).toLocaleString("zh-CN") : ""}</span></div><h3>{title}</h3><p>{area}{area ? " · " : ""}{row.ownerName} · {row.ownerEmail}</p></div>
            <div className="admin-application-body"><dl className="admin-application-facts"><div><dt>房源 ID</dt><dd>{row.listingId}</dd></div><div><dt>付款状态</dt><dd>{paymentLabels[row.paymentStatus]}</dd></div><div><dt>申请价格</dt><dd>{money(row.priceCents)}</dd></div><div><dt>房源状态</dt><dd>{row.listingStatus || "—"}</dd></div><div><dt>付款参考号</dt><dd>{row.paymentReference || "未填写"}</dd></div><div><dt>开通时间</dt><dd>{row.activatedAt ? new Date(row.activatedAt).toLocaleString("zh-CN") : "未开通"}</dd></div></dl><div className="admin-review-controls"><span className="field-help">{row.status === "pending_payment" ? "请核对外部付款后再开通。开通后，匹配的保存搜索用户会收到这套房源的提醒。" : row.status === "active" ? "这套房源的保存搜索曝光已开放。" : "这项保存搜索曝光目前未开放。"}</span><div className="admin-application-actions">{row.status === "pending_payment" && <><button className="primary-button" type="button" onClick={() => void update(row, "confirm_paid")} disabled={isWorking}>确认已付款并开通</button><button className="outline-button" type="button" onClick={() => void update(row, "cancel")} disabled={isWorking}>取消申请</button></>}{row.status === "active" && <button className="outline-button" type="button" onClick={() => void update(row, "refund")} disabled={isWorking}>退款并停止</button>}{(row.status === "cancelled" || row.status === "expired") && <button className="outline-button" type="button" onClick={() => void update(row, "cancel")} disabled={isWorking}>保持未开通</button>}</div></div></div>
          </article>;
        })}</div>}
      </section>
      <div className="admin-privacy-note"><strong>收费边界</strong><p>系统不会在没有支付服务和明确确认前向房主收费。正式上线前，可以把“确认付款”替换为 Stripe Checkout、Webhook 和退款流程。</p></div>
    </main>
  </div>;
}

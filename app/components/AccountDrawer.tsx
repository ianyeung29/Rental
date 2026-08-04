"use client";

type Locale = "zh" | "en";
type DashboardTab = "listings" | "inquiries" | "agentRequests";
type AgentRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

type AccountUser = {
  displayName: string;
  email: string;
  emailVerified: boolean;
};

type DashboardListing = {
  id: string;
  titleZh: string;
  titleEn: string;
  areaZh: string;
  areaEn: string;
  price: number;
  moveIn: string;
  lease: string;
  privateAddress: string;
  agentService?: "selfManaged" | "agentMatch";
  agentFeePlan?: "agentQuote" | "firstMonthRent" | "flatFee";
  agentFeeAmount?: number | null;
  agentProfileId?: string | null;
  agentProfileNameZh?: string | null;
  agentProfileNameEn?: string | null;
  agentRequestId?: string | null;
  agentRequestStatus?: AgentRequestStatus | null;
  agentRequestNote?: string;
  status: string;
  expiresOn?: string | null;
  publishedAt?: string | null;
  createdAt: string;
};

type DashboardAgentRequest = {
  id: string;
  listingTitleZh: string;
  listingTitleEn: string;
  listingAreaZh: string;
  listingAreaEn: string;
  ownerName: string;
  ownerEmail: string;
  feePlan: "agentQuote" | "firstMonthRent" | "flatFee";
  feeAmount: number | null;
  status: AgentRequestStatus;
  ownerNote: string;
  agentNote: string;
  createdAt: string;
  updatedAt: string;
};

type DashboardInquiry = {
  id: string;
  listingTitle: string;
  sentAt: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  tourPreference: string;
  message: string;
  requesterName?: string;
  requesterEmail?: string;
};

type AccountDrawerProps = {
  locale: Locale;
  user: AccountUser;
  tab: DashboardTab;
  listings: DashboardListing[];
  inquiries: DashboardInquiry[];
  agentRequests: DashboardAgentRequest[];
  canManageAgentRequests: boolean;
  agentRequestLoadingId: string | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onTabChange: (tab: DashboardTab) => void;
  onLogout: () => void;
  resendLoading: boolean;
  resendError: string;
  onResendVerification: () => void;
  onViewListing: (id: string) => void;
  onEditListing: (id: string) => void;
  onSetListingStatus: (id: string, status: "published" | "paused") => void;
  onRenewListing: (id: string) => void;
  onAgentRequestDecision: (id: string, status: "accepted" | "declined") => void;
};

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function AccountDrawer({ locale, user, tab, listings, inquiries, agentRequests, canManageAgentRequests, agentRequestLoadingId, loading, error, onClose, onTabChange, onLogout, onViewListing, onEditListing, onSetListingStatus, onRenewListing, onAgentRequestDecision, resendLoading, resendError, onResendVerification }: AccountDrawerProps) {
  const zh = locale === "zh";
  const initial = user.displayName.trim().slice(0, 1).toUpperCase() || "U";
  const labelDate = (value: string) => value ? new Date(value).toLocaleDateString(zh ? "zh-CN" : "en-US") : "—";
  const agentFeeLabel = (listing: DashboardListing) => {
    if (listing.agentFeePlan === "firstMonthRent") return zh ? "成交后支付一个月租金" : "One month’s rent after a lease";
    if (listing.agentFeePlan === "flatFee") return zh ? `固定 $${Number(listing.agentFeeAmount || 0).toLocaleString("en-US")} USD` : `$${Number(listing.agentFeeAmount || 0).toLocaleString("en-US")} USD flat fee`;
    return zh ? "请经纪报价" : "Agent to quote";
  };
  const requestFeeLabel = (request: DashboardAgentRequest) => {
    if (request.feePlan === "firstMonthRent") return zh ? "成交后支付一个月租金" : "One month’s rent after a lease";
    if (request.feePlan === "flatFee") return zh ? `固定 $${Number(request.feeAmount || 0).toLocaleString("en-US")} USD` : `$${Number(request.feeAmount || 0).toLocaleString("en-US")} USD flat fee`;
    return zh ? "请经纪报价" : "Agent to quote";
  };
  const requestStatusLabel = (status: AgentRequestStatus) => {
    if (status === "accepted") return zh ? "已接受" : "Accepted";
    if (status === "declined") return zh ? "已拒绝" : "Declined";
    if (status === "cancelled") return zh ? "已取消" : "Cancelled";
    return zh ? "待回复" : "Pending";
  };
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer account-drawer" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="drawer-content">
          <div className="drawer-heading">
            <span className="section-label">{zh ? "我的工作台" : "MY DESK"}</span>
            <button className="drawer-close" type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><CloseIcon /></button>
          </div>
          <div className="account-identity">
            <div className="account-avatar-large" aria-hidden="true">{initial}</div>
            <div><h2 id="account-title">{user.displayName}</h2><p>{user.email}</p><div className="account-verification"><span className={`status-chip ${user.emailVerified ? "published" : "unpublished"}`}>{user.emailVerified ? (zh ? "邮箱已验证" : "Email verified") : (zh ? "邮箱未验证" : "Email not verified")}</span>{!user.emailVerified && <button className="text-button" type="button" onClick={onResendVerification} disabled={resendLoading}>{resendLoading ? (zh ? "发送中…" : "Sending…") : (zh ? "重新发送" : "Resend")}</button>}</div></div>
          </div>
          {resendError && <p className="form-error" role="alert">{resendError}</p>}
          <div className="account-tabs" role="tablist" aria-label={zh ? "账户工作台" : "Account workspace"}>
            <button className={tab === "listings" ? "active" : ""} type="button" role="tab" aria-selected={tab === "listings"} onClick={() => onTabChange("listings")}>{zh ? "我的房源" : "My listings"}<span>{listings.length}</span></button>
            <button className={tab === "inquiries" ? "active" : ""} type="button" role="tab" aria-selected={tab === "inquiries"} onClick={() => onTabChange("inquiries")}>{zh ? "收到的咨询" : "Received inquiries"}<span>{inquiries.length}</span></button>
            {canManageAgentRequests && <button className={tab === "agentRequests" ? "active" : ""} type="button" role="tab" aria-selected={tab === "agentRequests"} onClick={() => onTabChange("agentRequests")}>{zh ? "经纪请求" : "Agent requests"}<span>{agentRequests.filter((request) => request.status === "pending").length}</span></button>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {loading ? <div className="dashboard-loading" aria-live="polite"><span /><span /><span /></div> : tab === "listings" ? (
            listings.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有房源" : "No listings yet"}</h3><p>{zh ? "发布第一套房源后，它会在这里显示。" : "Publish your first listing and it will appear here."}</p></div> :
              <div className="dashboard-list">
                {listings.map((listing) => {
                  const published = listing.status === "published";
                  const expired = Boolean(listing.expiresOn && listing.expiresOn < new Date().toISOString().slice(0, 10));
                  const lifecycleClass = expired ? "expired" : published ? "published" : "unpublished";
                  const lifecycleLabel = expired ? (zh ? "已过期" : "Expired") : published ? (zh ? "已发布" : "Published") : (zh ? "已暂停" : "Paused");
                  const expiryDate = listing.expiresOn ? new Date(`${listing.expiresOn}T00:00:00`).toLocaleDateString(zh ? "zh-CN" : "en-US") : "";
                  return <article className="dashboard-row" key={listing.id}>
                    <div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{zh ? listing.titleZh : listing.titleEn}</h3><span className={`status-chip ${lifecycleClass}`}>{lifecycleLabel}</span></div><p>{zh ? listing.areaZh : listing.areaEn} · ${listing.price.toLocaleString("en-US")} USD / {zh ? "月" : "mo"}</p><small>{zh ? "精确地址" : "Exact address"}: {listing.privateAddress} · {labelDate(listing.createdAt)}</small>{listing.expiresOn && <small className={`listing-expiry-note ${expired ? "expired" : ""}`}>{expired ? (zh ? "公开期限已过：" : "Public until passed: ") : (zh ? "公开至：" : "Public until: ")}{expiryDate}</small>}{listing.agentService === "agentMatch" && <><small className="agent-status-note">{listing.agentProfileId ? (zh ? `指定经纪：${listing.agentProfileNameZh || "已选择"}` : `Selected agent: ${listing.agentProfileNameEn || "Selected"}`) : (zh ? "经纪协助：等待匹配" : "Agent assistance: matching requested")} · {requestStatusLabel(listing.agentRequestStatus || "pending")}</small><small>{zh ? "费用意向：" : "Fee preference: "}{agentFeeLabel(listing)}</small>{listing.agentRequestNote && <small>{zh ? "经纪留言：" : "Agent note: "}{listing.agentRequestNote}</small>}</>}</div>
                    <div className="dashboard-row-actions"><button className="link-button" type="button" onClick={() => onViewListing(listing.id)}>{zh ? "查看" : "View"}</button><button className="text-button" type="button" onClick={() => onEditListing(listing.id)}>{zh ? "编辑" : "Edit"}</button>{expired ? <button className="text-button" type="button" onClick={() => onRenewListing(listing.id)}>{zh ? "续期 30 天" : "Renew 30 days"}</button> : <button className="text-button" type="button" onClick={() => onSetListingStatus(listing.id, published ? "paused" : "published")}>{published ? (zh ? "暂停" : "Pause") : (zh ? "重新发布" : "Republish")}</button>}</div>
                  </article>;
                })}
              </div>
          ) : tab === "inquiries" ? (
            inquiries.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有咨询" : "No inquiries yet"}</h3><p>{zh ? "租客发送咨询后，内容会在这里显示。" : "Renter inquiries will appear here when someone contacts you."}</p></div> :
              <div className="dashboard-list inquiry-list">
                {inquiries.map((inquiry) => <article className="dashboard-row inquiry-row" key={inquiry.id}><div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{inquiry.listingTitle}</h3><span className="status-chip published">{zh ? "新咨询" : "New"}</span></div><p>{inquiry.requesterName} · {inquiry.requesterEmail}</p><small>{zh ? "入住" : "Move-in"}: {inquiry.moveIn} · {zh ? "租期" : "Lease"}: {inquiry.leaseLength} · {zh ? "人数" : "Occupants"}: {inquiry.occupants}</small>{inquiry.message && <blockquote>{inquiry.message}</blockquote>}</div><div className="dashboard-row-actions"><a className="link-button" href={`mailto:${inquiry.requesterEmail || ""}`}>{zh ? "回复" : "Reply"}</a></div></article>)}
              </div>
          ) : (
            agentRequests.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有经纪请求" : "No agent requests"}</h3><p>{zh ? "房主请求你的经纪协助后，内容会在这里显示。" : "Owner requests for your assistance will appear here."}</p></div> :
              <div className="dashboard-list agent-request-list">
                {agentRequests.map((request) => <article className="dashboard-row agent-request-row" key={request.id}>
                  <div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{zh ? request.listingTitleZh : request.listingTitleEn}</h3><span className={`status-chip ${request.status === "accepted" ? "published" : "unpublished"}`}>{requestStatusLabel(request.status)}</span></div><p>{zh ? request.listingAreaZh : request.listingAreaEn}</p><small>{zh ? "房主" : "Owner"}: {request.ownerName} · {request.ownerEmail}</small><small>{zh ? "费用意向" : "Fee preference"}: {requestFeeLabel(request)}</small>{request.ownerNote && <blockquote>{request.ownerNote}</blockquote>}{request.agentNote && <small className="agent-status-note">{zh ? "你的留言" : "Your note"}: {request.agentNote}</small>}</div>
                  <div className="dashboard-row-actions">{request.status === "pending" ? <><button className="outline-button" type="button" onClick={() => onAgentRequestDecision(request.id, "accepted")} disabled={agentRequestLoadingId === request.id}>{agentRequestLoadingId === request.id ? (zh ? "处理中…" : "Working…") : (zh ? "接受" : "Accept")}</button><button className="text-button" type="button" onClick={() => onAgentRequestDecision(request.id, "declined")} disabled={agentRequestLoadingId === request.id}>{zh ? "拒绝" : "Decline"}</button></> : <span className="status-chip">{requestStatusLabel(request.status)}</span>}</div>
                </article>)}
              </div>
          )}
          <div className="account-footer"><p>{zh ? "账户权限只允许你管理自己的房源和收到的咨询。" : "Your account can manage only its own listings and received inquiries."}</p><button className="outline-button" type="button" onClick={onLogout}>{zh ? "退出登录" : "Sign out"}</button></div>
        </div>
      </aside>
    </div>
  );
}

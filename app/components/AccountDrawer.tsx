"use client";

type Locale = "zh" | "en";
type DashboardTab = "listings" | "inquiries";

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
  status: string;
  createdAt: string;
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
  onSetListingStatus: (id: string, status: "published" | "unpublished") => void;
};

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function AccountDrawer({ locale, user, tab, listings, inquiries, loading, error, onClose, onTabChange, onLogout, onViewListing, onEditListing, onSetListingStatus, resendLoading, resendError, onResendVerification }: AccountDrawerProps) {
  const zh = locale === "zh";
  const initial = user.displayName.trim().slice(0, 1).toUpperCase() || "U";
  const labelDate = (value: string) => value ? new Date(value).toLocaleDateString(zh ? "zh-CN" : "en-US") : "—";
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
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {loading ? <div className="dashboard-loading" aria-live="polite"><span /><span /><span /></div> : tab === "listings" ? (
            listings.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有房源" : "No listings yet"}</h3><p>{zh ? "发布第一套房源后，它会在这里显示。" : "Publish your first listing and it will appear here."}</p></div> :
              <div className="dashboard-list">
                {listings.map((listing) => {
                  const published = listing.status === "published";
                  return <article className="dashboard-row" key={listing.id}>
                    <div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{zh ? listing.titleZh : listing.titleEn}</h3><span className={`status-chip ${published ? "published" : "unpublished"}`}>{published ? (zh ? "已发布" : "Published") : (zh ? "已下架" : "Unpublished")}</span></div><p>{zh ? listing.areaZh : listing.areaEn} · ${listing.price.toLocaleString("en-US")} USD / {zh ? "月" : "mo"}</p><small>{zh ? "精确地址" : "Exact address"}: {listing.privateAddress} · {labelDate(listing.createdAt)}</small></div>
                    <div className="dashboard-row-actions"><button className="link-button" type="button" onClick={() => onViewListing(listing.id)}>{zh ? "查看" : "View"}</button><button className="text-button" type="button" onClick={() => onEditListing(listing.id)}>{zh ? "编辑" : "Edit"}</button><button className="text-button" type="button" onClick={() => onSetListingStatus(listing.id, published ? "unpublished" : "published")}>{published ? (zh ? "下架" : "Unpublish") : (zh ? "重新发布" : "Republish")}</button></div>
                  </article>;
                })}
              </div>
          ) : (
            inquiries.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有咨询" : "No inquiries yet"}</h3><p>{zh ? "租客发送咨询后，内容会在这里显示。" : "Renter inquiries will appear here when someone contacts you."}</p></div> :
              <div className="dashboard-list inquiry-list">
                {inquiries.map((inquiry) => <article className="dashboard-row inquiry-row" key={inquiry.id}><div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{inquiry.listingTitle}</h3><span className="status-chip published">{zh ? "新咨询" : "New"}</span></div><p>{inquiry.requesterName} · {inquiry.requesterEmail}</p><small>{zh ? "入住" : "Move-in"}: {inquiry.moveIn} · {zh ? "租期" : "Lease"}: {inquiry.leaseLength} · {zh ? "人数" : "Occupants"}: {inquiry.occupants}</small>{inquiry.message && <blockquote>{inquiry.message}</blockquote>}</div><div className="dashboard-row-actions"><a className="link-button" href={`mailto:${inquiry.requesterEmail || ""}`}>{zh ? "回复" : "Reply"}</a></div></article>)}
              </div>
          )}
          <div className="account-footer"><p>{zh ? "账户权限只允许你管理自己的房源和收到的咨询。" : "Your account can manage only its own listings and received inquiries."}</p><button className="outline-button" type="button" onClick={onLogout}>{zh ? "退出登录" : "Sign out"}</button></div>
        </div>
      </aside>
    </div>
  );
}

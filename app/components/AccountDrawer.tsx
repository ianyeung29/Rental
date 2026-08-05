"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { listingLimitFor } from "../lib/account-types";
import { toChineseLocationLabel } from "../lib/location-labels";
import portraitStyles from "./AgentPortrait.module.css";

type Locale = "zh" | "en";
type DashboardTab = "listings" | "inquiries" | "agentRequests";
type AgentRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

type AccountUser = {
  displayName: string;
  email: string;
  phone: string;
  role: string;
  accountType: "user" | "agent";
  agentVerificationStatus: "unsubmitted" | "pending" | "verified" | "rejected" | "expired";
  agentVerified: boolean;
  emailVerified: boolean;
};

type AgentVerificationApplication = {
  licenseState: string;
  licenseNumber: string;
  brokerage: string;
  portraitUrl: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
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
  onUpdateProfile: (input: { displayName: string; phone: string }) => Promise<void>;
  onAgentVerificationStatusChange: (status: AccountUser["agentVerificationStatus"]) => void;
  onViewListing: (id: string) => void;
  onEditListing: (id: string) => void;
  onSetListingStatus: (id: string, status: "published" | "paused") => void;
  onRenewListing: (id: string) => void;
  onAgentRequestDecision: (id: string, status: "accepted" | "declined") => void;
};

const AGENT_PORTRAIT_MAX_BYTES = 8 * 1024 * 1024;
const AGENT_PORTRAIT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function AccountDrawer({ locale, user, tab, listings, inquiries, agentRequests, canManageAgentRequests, agentRequestLoadingId, loading, error, onClose, onTabChange, onLogout, onViewListing, onEditListing, onSetListingStatus, onRenewListing, onAgentRequestDecision, resendLoading, resendError, onResendVerification, onUpdateProfile, onAgentVerificationStatusChange }: AccountDrawerProps) {
  const zh = locale === "zh";
  const initial = user.displayName.trim().slice(0, 1).toUpperCase() || "U";
  const listingLimit = listingLimitFor(user.accountType, user.agentVerified);
  const today = new Date().toISOString().slice(0, 10);
  const activeListingCount = listings.filter((listing) => (listing.status === "published" || listing.status === "paused") && (!listing.expiresOn || listing.expiresOn >= today)).length;
  const agentStatusLabel = user.agentVerified
    ? (zh ? "经纪执照已核验" : "Agent license checked")
    : user.agentVerificationStatus === "rejected"
      ? (zh ? "经纪核验未通过" : "Agent review not approved")
      : user.agentVerificationStatus === "expired"
        ? (zh ? "经纪核验已过期" : "Agent review expired")
        : user.agentVerificationStatus === "pending"
          ? (zh ? "经纪身份审核中" : "Agent review pending")
          : (zh ? "经纪身份待核验" : "Agent verification not submitted");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileName, setProfileName] = useState(user.displayName);
  const [profilePhone, setProfilePhone] = useState(user.phone || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [verificationApplication, setVerificationApplication] = useState<AgentVerificationApplication | null>(null);
  const [verificationState, setVerificationState] = useState("");
  const [verificationNumber, setVerificationNumber] = useState("");
  const [verificationBrokerage, setVerificationBrokerage] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState("");
  const [portraitUploadStatus, setPortraitUploadStatus] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [portraitUploadError, setPortraitUploadError] = useState("");
  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    try {
      await onUpdateProfile({ displayName: profileName, phone: profilePhone });
      setProfileEditing(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : (zh ? "资料暂时无法更新。" : "Profile could not be updated right now."));
    } finally {
      setProfileSaving(false);
    }
  };
  const labelDate = (value: string) => value ? new Date(value).toLocaleDateString(zh ? "zh-CN" : "en-US") : "—";
  const agentFeeLabel = (listing: DashboardListing) => {
    if (listing.agentFeePlan === "firstMonthRent") return zh ? "成交后支付一个月租金" : "One month’s rent after a lease";
    if (listing.agentFeePlan === "flatFee") return zh ? `固定 $${Number(listing.agentFeeAmount || 0).toLocaleString("en-US")}` : `$${Number(listing.agentFeeAmount || 0).toLocaleString("en-US")} flat fee`;
    return zh ? "请经纪报价" : "Agent to quote";
  };
  const requestFeeLabel = (request: DashboardAgentRequest) => {
    if (request.feePlan === "firstMonthRent") return zh ? "成交后支付一个月租金" : "One month’s rent after a lease";
    if (request.feePlan === "flatFee") return zh ? `固定 $${Number(request.feeAmount || 0).toLocaleString("en-US")}` : `$${Number(request.feeAmount || 0).toLocaleString("en-US")} flat fee`;
    return zh ? "请经纪报价" : "Agent to quote";
  };
  const requestStatusLabel = (status: AgentRequestStatus) => {
    if (status === "accepted") return zh ? "已接受" : "Accepted";
    if (status === "declined") return zh ? "已拒绝" : "Declined";
    if (status === "cancelled") return zh ? "已取消" : "Cancelled";
    return zh ? "待回复" : "Pending";
  };
  useEffect(() => {
    if (user.accountType !== "agent") return;
    let cancelled = false;
    fetch("/api/agent-verification", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { application?: AgentVerificationApplication | null };
        if (!cancelled && result.application) {
          setVerificationApplication(result.application);
          setVerificationState(result.application.licenseState);
          setVerificationNumber(result.application.licenseNumber);
          setVerificationBrokerage(result.application.brokerage);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setVerificationLoading(false); });
    return () => { cancelled = true; };
  }, [user.accountType]);
  useEffect(() => {
    return () => {
      if (portraitPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(portraitPreviewUrl);
    };
  }, [portraitPreviewUrl]);
  const handlePortraitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setPortraitUploadError("");
    setPortraitUploadStatus("idle");
    if (!file) return;
    if (!AGENT_PORTRAIT_TYPES.has(file.type)) {
      setPortraitFile(null);
      setPortraitUploadError(zh ? "请选择 JPEG、PNG 或 WebP 图片。" : "Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AGENT_PORTRAIT_MAX_BYTES) {
      setPortraitFile(null);
      setPortraitUploadError(zh ? "头像图片需要小于 8 MB。" : "The portrait must be 8 MB or smaller.");
      return;
    }
    setPortraitFile(file);
    setPortraitPreviewUrl(URL.createObjectURL(file));
  };
  const uploadAgentPortrait = async () => {
    if (!portraitFile) return "";
    setPortraitUploadStatus("uploading");
    const presignResponse = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "agentPortrait", filename: portraitFile.name, contentType: portraitFile.type, size: portraitFile.size }),
    });
    const presign = await presignResponse.json().catch(() => ({})) as { error?: string; key?: string; uploadUrl?: string };
    if (!presignResponse.ok || !presign.key || !presign.uploadUrl) throw new Error(presign.error || (zh ? "头像上传准备失败。" : "The portrait upload could not be prepared."));
    const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": portraitFile.type }, body: portraitFile });
    if (!uploadResponse.ok) throw new Error(zh ? "头像上传失败，请检查 R2 设置后重试。" : "The portrait upload failed. Check the R2 settings and try again.");
    setPortraitUploadStatus("uploaded");
    return presign.key;
  };
  const handleAgentVerificationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVerificationSaving(true);
    setVerificationError("");
    setVerificationSuccess(false);
    try {
      const portraitKey = await uploadAgentPortrait();
      const response = await fetch("/api/agent-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseState: verificationState, licenseNumber: verificationNumber, brokerage: verificationBrokerage, portraitKey: portraitKey || undefined }),
      });
      const result = await response.json() as { error?: string; application?: AgentVerificationApplication | null };
      if (!response.ok) throw new Error(result.error || (zh ? "执照核验资料暂时无法提交。" : "Agent verification could not be submitted."));
      setVerificationApplication(result.application || null);
      setPortraitFile(null);
      setPortraitPreviewUrl("");
      setPortraitUploadStatus("idle");
      setVerificationSuccess(true);
      onAgentVerificationStatusChange("pending");
    } catch (error) {
      setPortraitUploadStatus("idle");
      setVerificationError(error instanceof Error ? error.message : (zh ? "执照核验资料暂时无法提交。" : "Agent verification could not be submitted."));
    } finally {
      setVerificationSaving(false);
    }
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
            <div className={portraitStyles.accountAvatarLarge} aria-hidden="true">{verificationApplication?.portraitUrl ? <Image src={verificationApplication.portraitUrl} alt="" width={46} height={46} unoptimized /> : initial}</div>
            <div><h2 id="account-title">{user.displayName}</h2><p>{user.email}</p><div className="account-verification"><span className={`status-chip ${user.emailVerified ? "published" : "unpublished"}`}>{user.emailVerified ? (zh ? "邮箱已验证" : "Email verified") : (zh ? "邮箱未验证" : "Email not verified")}</span>{user.accountType === "agent" && <span className={`status-chip ${user.agentVerified ? "published" : user.agentVerificationStatus === "rejected" || user.agentVerificationStatus === "expired" ? "expired" : "unpublished"}`}>{agentStatusLabel}</span>}{!user.emailVerified && <button className="text-button" type="button" onClick={onResendVerification} disabled={resendLoading}>{resendLoading ? (zh ? "发送中…" : "Sending…") : (zh ? "重新发送" : "Resend")}</button>}</div></div>
          </div>
          {user.role === "admin" && <Link className="admin-access-panel" href="/admin/agent-verifications" onClick={onClose}>
            <span><strong>{zh ? "管理员工作台" : "Admin workspace"}</strong><small>{zh ? "查看并处理经纪身份核验申请。" : "Review and decide agent identity applications."}</small></span>
            <b aria-hidden="true">→</b>
          </Link>}
          {user.role === "admin" && <Link className="admin-access-panel" href="/admin/promotions" onClick={onClose}>
            <span><strong>{zh ? "房源推广队列" : "Promotion queue"}</strong><small>{zh ? "处理房主提交的推广申请，未来可接入付款。" : "Review owner promotion requests before payment is added."}</small></span>
            <b aria-hidden="true">→</b>
          </Link>}
          <section className="account-profile-panel" aria-labelledby="private-profile-title">
            <div className="account-profile-heading">
              <div><span className="section-label">{zh ? "私密资料" : "PRIVATE PROFILE"}</span><h3 id="private-profile-title">{zh ? "我的资料" : "My profile"}</h3><p>{zh ? "仅你可见，不会出现在公开房源页。" : "Private to your account; it is not shown on public listings."}</p></div>
              {!profileEditing && <button className="text-button" type="button" onClick={() => { setProfileError(""); setProfileEditing(true); }}>{zh ? "编辑资料" : "Edit profile"}</button>}
            </div>
            {profileError && <p className="form-error" role="alert">{profileError}</p>}
            {!profileEditing ? <div className="profile-summary">
              <div><span>{zh ? "姓名" : "Name"}</span><strong>{user.displayName}</strong></div>
              <div><span>{zh ? "电话" : "Phone"}</span><strong>{user.phone || (zh ? "尚未设置" : "Not set")}</strong></div>
              <div><span>{zh ? "登录邮箱" : "Sign-in email"}</span><strong>{user.email}</strong></div>
            </div> : <form className="profile-form" onSubmit={handleProfileSubmit}>
              <label className="profile-field"><span className="profile-field-label" id="profile-display-name-label">{zh ? "姓名" : "Name"}</span><input id="profile-display-name" aria-labelledby="profile-display-name-label" value={profileName} onChange={(event) => setProfileName(event.target.value)} autoComplete="name" maxLength={80} required /></label>
              <label className="profile-field"><span className="profile-field-label" id="profile-phone-label">{zh ? "电话（可选）" : "Phone (optional)"}</span><input id="profile-phone" aria-labelledby="profile-phone-label" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" maxLength={32} inputMode="tel" placeholder={zh ? "例如 516-555-0123" : "e.g. 516-555-0123"} /></label>
              <label className="profile-field"><span className="profile-field-label" id="profile-email-label">{zh ? "登录邮箱" : "Sign-in email"}</span><input id="profile-email" aria-labelledby="profile-email-label" value={user.email} readOnly disabled /><small>{zh ? "邮箱用于登录；如需更改，之后需要重新验证。" : "Used for sign-in; changing it will require a separate re-verification flow."}</small></label>
              <div className="profile-form-actions"><button className="outline-button" type="button" onClick={() => { setProfileName(user.displayName); setProfilePhone(user.phone || ""); setProfileError(""); setProfileEditing(false); }} disabled={profileSaving}>{zh ? "取消" : "Cancel"}</button><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存资料" : "Save profile")}</button></div>
            </form>}
          </section>
          <section className="account-quota-panel" aria-label={zh ? "房源发布额度" : "Listing publishing capacity"}>
            <div><span className="section-label">{zh ? "发布额度" : "POSTING CAPACITY"}</span><strong>{user.agentVerified ? (zh ? "已核验经纪额度" : "Verified agent capacity") : (zh ? "普通账户额度" : "Regular account capacity")}</strong><p>{user.agentVerified ? (zh ? "执照核验通过后，可发布更多房源。" : "Your approved license gives this account a higher listing limit.") : (zh ? "经纪账户完成执照核验后，额度会自动提高。" : "Agent accounts receive the higher limit after license verification.")}</p></div><span className="quota-count">{activeListingCount} / {listingLimit}</span>
          </section>
          {user.accountType === "agent" && <section className="agent-verification-panel" aria-labelledby="agent-verification-title">
            <div className="account-profile-heading"><div><span className="section-label">{zh ? "经纪身份" : "AGENT IDENTITY"}</span><h3 id="agent-verification-title">{zh ? "提交执照核验" : "Submit license verification"}</h3><p>{zh ? "我们会根据州执照公开记录人工核对。提交经纪身份不会自动获得核验徽章或更高额度。" : "We manually compare the license with public state records. Choosing agent does not automatically grant verification or higher capacity."}</p></div><span className={`status-chip ${user.agentVerified ? "published" : user.agentVerificationStatus === "rejected" || user.agentVerificationStatus === "expired" ? "expired" : "unpublished"}`}>{agentStatusLabel}</span></div>
            {verificationError && <p className="form-error" role="alert">{verificationError}</p>}
            {verificationSuccess && <p className="verification-success" role="status">{zh ? "资料已提交，等待人工核验。" : "Submitted for manual review."}</p>}
            {user.agentVerified ? <p className="verification-approved">{zh ? "你的经纪执照已核验，可以使用更高的房源发布额度。" : "Your license is verified and the higher listing capacity is enabled."}</p> : <form className="verification-form" onSubmit={handleAgentVerificationSubmit}>
              <label className="profile-field"><span className="profile-field-label">{zh ? "执照州" : "License state"}</span><input value={verificationState} onChange={(event) => setVerificationState(event.target.value.toUpperCase())} maxLength={2} placeholder="NY" required /></label>
              <label className="profile-field"><span className="profile-field-label">{zh ? "执照编号" : "License number"}</span><input value={verificationNumber} onChange={(event) => setVerificationNumber(event.target.value)} maxLength={40} placeholder={zh ? "例如 NY-123456789" : "e.g. NY-123456789"} required /></label>
              <label className="profile-field"><span className="profile-field-label">{zh ? "所属经纪公司" : "Brokerage"}</span><input value={verificationBrokerage} onChange={(event) => setVerificationBrokerage(event.target.value)} maxLength={120} placeholder={zh ? "执照登记的经纪公司" : "Brokerage listed on the license"} required /></label>
              <div className={portraitStyles.uploadPanel}>
                <div className={portraitStyles.preview} aria-label={zh ? "经纪头像预览" : "Agent portrait preview"}>
                  {(portraitPreviewUrl || verificationApplication?.portraitUrl) ? <Image src={portraitPreviewUrl || verificationApplication?.portraitUrl || ""} alt="" width={72} height={72} unoptimized /> : <span>{initial}</span>}
                </div>
                <div className={portraitStyles.copy}>
                  <strong>{zh ? "经纪头像（可选）" : "Agent portrait (optional)"}</strong>
                  <small>{zh ? "上传一张清晰、专业的正面照片；核验通过后会显示在经纪目录中。" : "Add a clear, professional headshot. It will appear in the agent directory after approval."}</small>
                  <label className={`outline-button ${portraitStyles.picker}`} htmlFor="agent-portrait-file">{portraitFile ? (zh ? "更换照片" : "Change photo") : (zh ? "选择照片" : "Choose photo")}</label>
                  <input className={portraitStyles.fileInput} id="agent-portrait-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePortraitChange} />
                  {portraitUploadStatus === "uploading" && <small className={portraitStyles.status} role="status">{zh ? "正在上传头像…" : "Uploading portrait…"}</small>}
                  {portraitUploadStatus === "uploaded" && <small className={portraitStyles.status} role="status">{zh ? "头像已上传，提交核验后保存。" : "Portrait uploaded; it will be saved with this submission."}</small>}
                  {portraitUploadError && <small className={portraitStyles.error} role="alert">{portraitUploadError}</small>}
                </div>
              </div>
              <p className="field-help">{verificationLoading ? (zh ? "正在读取已保存的核验资料…" : "Loading saved verification details…") : (zh ? "目前先收集执照州、编号和经纪公司；管理员会在公开州记录中核对后更新状态。" : "We collect the state, license number, and brokerage first; an admin updates the status after checking public state records.")}</p>
              <button className="outline-button" type="submit" disabled={verificationSaving || verificationLoading}>{verificationSaving ? (zh ? "提交中…" : "Submitting…") : (user.agentVerificationStatus === "pending" ? (zh ? "更新核验资料" : "Update verification") : (zh ? "提交核验资料" : "Submit for review"))}</button>
            </form>}
            {verificationApplication?.reviewNote && <p className="verification-review-note">{zh ? "审核备注：" : "Review note: "}{verificationApplication.reviewNote}</p>}
          </section>}
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
                    <div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{zh ? listing.titleZh : listing.titleEn}</h3><span className={`status-chip ${lifecycleClass}`}>{lifecycleLabel}</span></div><p>{zh ? toChineseLocationLabel(listing.areaZh || listing.areaEn) : listing.areaEn || listing.areaZh} · ${listing.price.toLocaleString("en-US")} / {zh ? "月" : "mo"}</p><small>{zh ? "精确地址" : "Exact address"}: {listing.privateAddress} · {labelDate(listing.createdAt)}</small>{listing.expiresOn && <small className={`listing-expiry-note ${expired ? "expired" : ""}`}>{expired ? (zh ? "公开期限已过：" : "Public until passed: ") : (zh ? "公开至：" : "Public until: ")}{expiryDate}</small>}{listing.agentService === "agentMatch" && <><small className="agent-status-note">{listing.agentProfileId ? (zh ? `指定经纪：${listing.agentProfileNameZh || "已选择"}` : `Selected agent: ${listing.agentProfileNameEn || "Selected"}`) : (zh ? "经纪协助：等待匹配" : "Agent assistance: matching requested")} · {requestStatusLabel(listing.agentRequestStatus || "pending")}</small><small>{zh ? "费用意向：" : "Fee preference: "}{agentFeeLabel(listing)}</small>{listing.agentRequestNote && <small>{zh ? "经纪留言：" : "Agent note: "}{listing.agentRequestNote}</small>}</>}</div>
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

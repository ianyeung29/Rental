"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { hasUnlimitedListingAccess, listingLimitFor } from "../lib/account-types";
import { toChineseLocationLabel } from "../lib/location-labels";
import { exactOccupantOrDefault, OCCUPANT_OPTIONS } from "../lib/renter-options";
import { DEFAULT_RENTER_PROFILE_SHARING, type RenterProfileShareOptions } from "../lib/renter-application";
import { useDialogA11y } from "../lib/use-dialog-a11y";
import { optimizeImageFile } from "../lib/image-optimizer";
import portraitStyles from "./AgentPortrait.module.css";
import OwnerOperationsPanel from "./OwnerOperationsPanel";

type Locale = "zh" | "en";
type DashboardTab = "listings" | "inquiries" | "applications" | "agentRequests" | "safety";
type AgentRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

type AccountUser = {
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string;
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
  moderationStatus?: "approved" | "under_review" | "hidden" | "rejected";
  moderationNote?: string;
  expiresOn?: string | null;
  publishedAt?: string | null;
  availabilityConfirmedAt?: string | null;
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
  tourRequestedDate?: string | null;
  tourRequestedWindow?: string;
  message: string;
  status?: string;
  readAt?: string | null;
  tourScheduledAt?: string | null;
  tourTimeZone?: string;
  tourNote?: string;
  addressRevealStatus?: "hidden" | "revealed";
  addressRevealedAt?: string | null;
  requesterName?: string;
  requesterEmail?: string;
};

type BlockedPublisher = {
  id: string;
  displayName: string;
  accountType: string;
  blockedAt: string;
};

type DashboardApplication = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingArea: string;
  currentCity?: string;
  preferredName: string;
  phone: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  employmentStatus: string;
  incomeRange: string;
  message: string;
  status: string;
  ownerNote: string;
  requesterNote: string;
  submittedAt: string;
  updatedAt: string;
  ownerReadAt?: string;
  requesterReadAt?: string;
  unread?: boolean;
  events?: Array<{ id: string; status: string; note: string; actorRole: "renter" | "owner"; createdAt: string }>;
  applicantName?: string;
  applicantEmail?: string;
  ownerName?: string;
  ownerEmail?: string;
};

type RenterProfile = {
  preferredName: string;
  phone: string;
  currentCity: string;
  employmentStatus: string;
  incomeRange: string;
  householdSize: string;
  pets: string;
  moveIn: string;
  leaseLength: string;
  note: string;
} & RenterProfileShareOptions;

type AccountDrawerProps = {
  locale: Locale;
  user: AccountUser;
  tab: DashboardTab;
  listings: DashboardListing[];
  inquiries: DashboardInquiry[];
  applications: DashboardApplication[];
  receivedApplications: DashboardApplication[];
  agentRequests: DashboardAgentRequest[];
  blockedPublishers: BlockedPublisher[];
  blockLoadingId: string | null;
  canManageAgentRequests: boolean;
  agentRequestLoadingId: string | null;
  applicationActionLoadingId: string | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onTabChange: (tab: DashboardTab) => void;
  onLogout: () => void;
  resendLoading: boolean;
  resendError: string;
  onResendVerification: () => void;
  onUpdateProfile: (input: { displayName: string; phone: string; avatarKey?: string | null }) => Promise<void>;
  onAgentAccountActivated: (input: { accountType: "agent"; agentVerificationStatus: AccountUser["agentVerificationStatus"]; agentVerified: boolean }) => void;
  onAgentVerificationStatusChange: (status: AccountUser["agentVerificationStatus"]) => void;
  onViewListing: (id: string) => void;
  onEditListing: (id: string) => void;
  onSetListingStatus: (id: string, status: "published" | "paused") => void;
  onRenewListing: (id: string) => void;
  onAgentRequestDecision: (id: string, status: "accepted" | "declined") => void;
  onInquiryStatusChange: (id: string, status: "contacted" | "closed") => Promise<void>;
  onScheduleInquiry: (id: string, input: { scheduledAt: string; timeZone: string; note: string }) => Promise<void>;
  onRevealInquiryAddress: (id: string) => Promise<void>;
  onApplicationStatusChange: (id: string, status: "reviewing" | "approved" | "declined" | "withdrawn", note: string) => Promise<void>;
  onUnblockPublisher: (id: string) => void;
  onListingOperationalChange: (id: string, updates: { status?: "published" | "paused"; availabilityConfirmedAt?: string | null }) => void;
};

const AGENT_PORTRAIT_MAX_BYTES = 8 * 1024 * 1024;
const AGENT_PORTRAIT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function defaultRenterProfile(user: Pick<AccountUser, "displayName" | "phone">): RenterProfile {
  return {
    preferredName: user.displayName,
    phone: user.phone || "",
    currentCity: "",
    employmentStatus: "preferNotToSay",
    incomeRange: "preferNotToSay",
    householdSize: "1",
    pets: "no",
    moveIn: "immediate",
    leaseLength: "12",
    note: "",
    ...DEFAULT_RENTER_PROFILE_SHARING,
  };
}

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function AccountDrawer({ locale, user, tab, listings, inquiries, applications, receivedApplications, agentRequests, blockedPublishers, blockLoadingId, canManageAgentRequests, agentRequestLoadingId, applicationActionLoadingId, loading, error, onClose, onTabChange, onLogout, onViewListing, onEditListing, onSetListingStatus, onRenewListing, onAgentRequestDecision, onInquiryStatusChange, onScheduleInquiry, onRevealInquiryAddress, onApplicationStatusChange, onUnblockPublisher, onListingOperationalChange, resendLoading, resendError, onResendVerification, onUpdateProfile, onAgentAccountActivated, onAgentVerificationStatusChange }: AccountDrawerProps) {
  const zh = locale === "zh";
  const dialogRef = useDialogA11y(true, onClose);
  const initial = user.displayName.trim().slice(0, 1).toUpperCase() || "U";
  const unlimitedListingAccess = hasUnlimitedListingAccess(user.role);
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
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState("");
  const [profileUploadStatus, setProfileUploadStatus] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [profileUploadError, setProfileUploadError] = useState("");
  const [renterProfile, setRenterProfile] = useState<RenterProfile>(() => defaultRenterProfile(user));
  const [renterProfileDraft, setRenterProfileDraft] = useState<RenterProfile>(() => defaultRenterProfile(user));
  const [renterProfileEditing, setRenterProfileEditing] = useState(false);
  const [renterProfileLoading, setRenterProfileLoading] = useState(() => user.emailVerified);
  const [renterProfileSaving, setRenterProfileSaving] = useState(false);
  const [renterProfileError, setRenterProfileError] = useState("");
  const [renterProfileSaved, setRenterProfileSaved] = useState(false);
  const [verificationApplication, setVerificationApplication] = useState<AgentVerificationApplication | null>(null);
  const [verificationState, setVerificationState] = useState("");
  const [verificationNumber, setVerificationNumber] = useState("");
  const [verificationBrokerage, setVerificationBrokerage] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [agentApplicationLoading, setAgentApplicationLoading] = useState(false);
  const [agentApplicationError, setAgentApplicationError] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState("");
  const [portraitUploadStatus, setPortraitUploadStatus] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [portraitUploadError, setPortraitUploadError] = useState("");
  const [schedulingInquiryId, setSchedulingInquiryId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [inquiryActionId, setInquiryActionId] = useState<string | null>(null);
  const [applicationNotes, setApplicationNotes] = useState<Record<string, string>>({});
  const [readApplicationIds, setReadApplicationIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (tab !== "applications") return;
    const unreadIds = [...applications, ...receivedApplications]
      .filter((application) => application.unread && !readApplicationIds.has(application.id))
      .map((application) => application.id);
    if (unreadIds.length === 0) return;
    void Promise.all(unreadIds.map((id) => fetch(`/api/applications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) }).catch(() => undefined))).then(() => {
      setReadApplicationIds((current) => new Set([...current, ...unreadIds]));
    });
  }, [applications, receivedApplications, readApplicationIds, tab]);
  const applicationIsUnread = (application: DashboardApplication) => Boolean(application.unread && !readApplicationIds.has(application.id));
  const handleProfileAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setProfileUploadError("");
    setProfileUploadStatus("idle");
    if (!file) return;
    if (!AGENT_PORTRAIT_TYPES.has(file.type)) {
      setProfileFile(null);
      setProfileUploadError(zh ? "请选择 JPEG、PNG 或 WebP 图片。" : "Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AGENT_PORTRAIT_MAX_BYTES) {
      setProfileFile(null);
      setProfileUploadError(zh ? "头像图片需要小于 8 MB。" : "The profile picture must be 8 MB or smaller.");
      return;
    }
    setProfileFile(file);
    setProfilePreviewUrl(URL.createObjectURL(file));
  };
  const uploadProfileAvatar = async () => {
    if (!profileFile) return "";
    setProfileUploadStatus("uploading");
    const optimized = await optimizeImageFile(profileFile, "agentPortrait");
    const presignResponse = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "profileAvatar", filename: profileFile.name, contentType: optimized.contentType, size: optimized.blob.size }),
    });
    const presign = await presignResponse.json().catch(() => ({})) as { error?: string; key?: string; uploadUrl?: string; cacheControl?: string };
    if (!presignResponse.ok || !presign.key || !presign.uploadUrl) throw new Error(presign.error || (zh ? "头像上传准备失败。" : "The profile picture upload could not be prepared."));
    const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": optimized.contentType, "Cache-Control": presign.cacheControl || "public, max-age=31536000, immutable" }, body: optimized.blob });
    if (!uploadResponse.ok) throw new Error(zh ? "头像上传失败，请检查 R2 设置后重试。" : "The profile picture upload failed. Check the R2 settings and try again.");
    setProfileUploadStatus("uploaded");
    return presign.key;
  };
  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    try {
      const avatarKey = await uploadProfileAvatar();
      await onUpdateProfile({ displayName: profileName, phone: profilePhone, ...(avatarKey ? { avatarKey } : {}) });
      setProfileEditing(false);
      setProfileFile(null);
      setProfilePreviewUrl("");
      setProfileUploadStatus("idle");
    } catch (error) {
      setProfileUploadStatus("idle");
      setProfileError(error instanceof Error ? error.message : (zh ? "资料暂时无法更新。" : "Profile could not be updated right now."));
    } finally {
      setProfileSaving(false);
    }
  };
  const labelDate = (value: string) => value ? new Date(value).toLocaleDateString(zh ? "zh-CN" : "en-US") : "—";
  const localDateInput = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const localTimeInput = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const inquiryStatusLabel = (status: string) => {
    if (status === "contacted") return zh ? "已联系" : "Contacted";
    if (status === "tourScheduled") return zh ? "已安排看房" : "Tour scheduled";
    if (status === "closed") return zh ? "已完成" : "Closed";
    return zh ? "新咨询" : "New";
  };
  const inquiryStatusClass = (status: string) => status === "tourScheduled" ? "tour-scheduled" : status === "contacted" ? "contacted" : status === "closed" ? "closed" : "published";
  const inquiryTourDateLabel = (value: string, timeZone?: string) => {
    try {
      return new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timeZone || undefined }).format(new Date(value));
    } catch {
      return value;
    }
  };
  const updateRenterProfile = <K extends keyof RenterProfile>(key: K, value: RenterProfile[K]) => {
    setRenterProfileDraft((current) => ({ ...current, [key]: value }));
    setRenterProfileError("");
    setRenterProfileSaved(false);
  };
  const handleRenterProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRenterProfileSaving(true);
    setRenterProfileError("");
    setRenterProfileSaved(false);
    try {
      const response = await fetch("/api/renter-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renterProfileDraft),
      });
      const result = await response.json().catch(() => ({})) as { profile?: Partial<RenterProfile>; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error || (zh ? "租客申请资料暂时无法保存。" : "Renter application profile could not be saved."));
      const nextProfile = { ...renterProfileDraft, ...result.profile };
      setRenterProfile(nextProfile);
      setRenterProfileDraft(nextProfile);
      setRenterProfileEditing(false);
      setRenterProfileSaved(true);
    } catch (error) {
      setRenterProfileError(error instanceof Error ? error.message : (zh ? "租客申请资料暂时无法保存。" : "Renter application profile could not be saved."));
    } finally {
      setRenterProfileSaving(false);
    }
  };
  const applicationStatusLabel = (status: string) => {
    if (status === "reviewing") return zh ? "审核中" : "Reviewing";
    if (status === "approved") return zh ? "已通过" : "Approved";
    if (status === "declined") return zh ? "未通过" : "Declined";
    if (status === "withdrawn") return zh ? "已撤回" : "Withdrawn";
    return zh ? "已提交" : "Submitted";
  };
  const applicationEventActorLabel = (role: "renter" | "owner") => role === "owner" ? (zh ? "房源方" : "Listing side") : (zh ? "租客" : "Renter");
  const applicationEventsLabel = (application: DashboardApplication) => application.events?.length ? application.events : [{ id: `legacy-${application.id}`, status: application.status, note: "", actorRole: "renter" as const, createdAt: application.submittedAt }];
  const applicationStatusClass = (status: string) => status === "approved" ? "published" : status === "declined" || status === "withdrawn" ? "closed" : status === "reviewing" ? "contacted" : "unpublished";
  const applicationDateLabel = (value: string) => value ? new Date(value).toLocaleDateString(zh ? "zh-CN" : "en-US") : "—";
  const renterMoveInLabel = (value: string) => value === "immediate" ? (zh ? "立即入住" : "Move in immediately") : value === "august" ? (zh ? "2026年8月" : "Aug 2026") : value === "september" ? (zh ? "2026年9月" : "Sep 2026") : value === "october" ? (zh ? "2026年10月" : "Oct 2026") : value || (zh ? "未填写" : "Not set");
  const renterLeaseLabel = (value: string) => value === "6" ? (zh ? "6个月" : "6 months") : value === "12" ? (zh ? "12个月" : "12 months") : value === "24" ? (zh ? "24个月以上" : "24+ months") : value === "undefined" ? (zh ? "未确定" : "Undefined") : value || (zh ? "未填写" : "Not set");
  const renterPetsLabel = (value: string) => value === "yes" ? (zh ? "有宠物" : "Pets" ) : value === "no" ? (zh ? "没有" : "No pets") : value || (zh ? "未填写" : "Not set");
  const renterEmploymentLabel = (value: string) => ({ employed: zh ? "受雇工作" : "Employed", selfEmployed: zh ? "自雇" : "Self-employed", student: zh ? "学生" : "Student", retired: zh ? "退休" : "Retired", betweenJobs: zh ? "正在寻找工作" : "Between jobs", preferNotToSay: zh ? "不便说明" : "Prefer not to say" }[value] || value || (zh ? "未填写" : "Not set"));
  const renterIncomeLabel = (value: string) => ({ preferNotToSay: zh ? "不便说明" : "Prefer not to say", under2500: zh ? "$2,500 以下" : "Under $2,500", "2500-3999": "$2,500–$3,999", "4000-5999": "$4,000–$5,999", "6000plus": zh ? "$6,000 以上" : "$6,000+" }[value] || value || (zh ? "未填写" : "Not set"));
  const openSchedule = (inquiry: DashboardInquiry) => {
    const candidate = inquiry.tourScheduledAt ? new Date(inquiry.tourScheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const date = Number.isNaN(candidate.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : candidate;
    setSchedulingInquiryId(inquiry.id);
    setScheduleDate(localDateInput(date));
    setScheduleTime(localTimeInput(date));
    setScheduleNote(inquiry.tourNote || "");
    setScheduleError("");
  };
  const handleInquiryStatusChange = async (id: string, status: "contacted" | "closed") => {
    setInquiryActionId(id);
    try {
      await onInquiryStatusChange(id, status);
    } catch {
      // The parent surfaces the server error in the shared toast.
    } finally {
      setInquiryActionId(null);
    }
  };
  const handleScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schedulingInquiryId || !scheduleDate || !scheduleTime) {
      setScheduleError(zh ? "请选择日期和时间。" : "Choose a date and time.");
      return;
    }
    const localDate = new Date(`${scheduleDate}T${scheduleTime}`);
    if (Number.isNaN(localDate.getTime())) {
      setScheduleError(zh ? "日期或时间格式不正确。" : "The date or time is not valid.");
      return;
    }
    setInquiryActionId(schedulingInquiryId);
    setScheduleError("");
    try {
      await onScheduleInquiry(schedulingInquiryId, {
        scheduledAt: localDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        note: scheduleNote,
      });
      setSchedulingInquiryId(null);
      setScheduleDate("");
      setScheduleTime("10:00");
      setScheduleNote("");
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : (zh ? "看房时间暂时无法保存。" : "The tour could not be scheduled."));
    } finally {
      setInquiryActionId(null);
    }
  };
  const handleRevealAddress = async (inquiry: DashboardInquiry) => {
    if (!window.confirm(zh ? "只在你确认看房安排后分享精确地址。现在分享给这位租客吗？" : "Share the exact address only after confirming the tour arrangement. Share it with this renter now?")) return;
    setInquiryActionId(inquiry.id);
    try {
      await onRevealInquiryAddress(inquiry.id);
    } catch {
      // The parent displays the localized error toast.
    } finally {
      setInquiryActionId(null);
    }
  };
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
    let cancelled = false;
    const fallback = defaultRenterProfile({ displayName: user.displayName, phone: user.phone });
    if (!user.emailVerified) {
      return () => { cancelled = true; };
    }
    fetch("/api/renter-profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(zh ? "租客申请资料暂时无法读取。" : "Renter application profile could not be loaded.");
        const result = await response.json() as { profile?: Partial<RenterProfile> };
        if (!cancelled) {
          setRenterProfileError("");
          const nextProfile = { ...fallback, ...(result.profile || {}) };
          nextProfile.householdSize = exactOccupantOrDefault(nextProfile.householdSize);
          setRenterProfile(nextProfile);
          setRenterProfileDraft(nextProfile);
        }
      })
      .catch((error) => { if (!cancelled) setRenterProfileError(error instanceof Error ? error.message : (zh ? "租客申请资料暂时无法读取。" : "Renter application profile could not be loaded.")); })
      .finally(() => { if (!cancelled) setRenterProfileLoading(false); });
    return () => { cancelled = true; };
  }, [user.displayName, user.emailVerified, user.phone, zh]);
  useEffect(() => {
    return () => {
      if (portraitPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(portraitPreviewUrl);
    };
  }, [portraitPreviewUrl]);
  useEffect(() => {
    return () => {
      if (profilePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(profilePreviewUrl);
    };
  }, [profilePreviewUrl]);
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
    const optimized = await optimizeImageFile(portraitFile, "agentPortrait");
    const presignResponse = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "agentPortrait", filename: portraitFile.name, contentType: optimized.contentType, size: optimized.blob.size }),
    });
    const presign = await presignResponse.json().catch(() => ({})) as { error?: string; key?: string; uploadUrl?: string; contentType?: string; cacheControl?: string };
    if (!presignResponse.ok || !presign.key || !presign.uploadUrl) throw new Error(presign.error || (zh ? "头像上传准备失败。" : "The portrait upload could not be prepared."));
    const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": optimized.contentType, "Cache-Control": presign.cacheControl || "public, max-age=31536000, immutable" }, body: optimized.blob });
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
  const handleAgentApplication = async () => {
    setAgentApplicationLoading(true);
    setAgentApplicationError("");
    try {
      const response = await fetch("/api/agent-application", { method: "POST" });
      const result = await response.json().catch(() => ({})) as { error?: string; user?: { accountType?: string; agentVerificationStatus?: AccountUser["agentVerificationStatus"]; agentVerified?: boolean } };
      if (!response.ok || !result.user || result.user.accountType !== "agent") throw new Error(result.error || (zh ? "经纪申请暂时无法开始。" : "The agent application could not be started."));
      onAgentAccountActivated({ accountType: "agent", agentVerificationStatus: result.user.agentVerificationStatus || "unsubmitted", agentVerified: result.user.agentVerified === true });
    } catch (error) {
      setAgentApplicationError(error instanceof Error ? error.message : (zh ? "经纪申请暂时无法开始。" : "The agent application could not be started."));
    } finally {
      setAgentApplicationLoading(false);
    }
  };
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} className="drawer account-drawer" role="dialog" aria-modal="true" aria-labelledby="account-title" tabIndex={-1}>
        <div className="drawer-content">
          <div className="drawer-heading">
            <span className="section-label">{zh ? "我的工作台" : "MY DESK"}</span>
            <button className="drawer-close" type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><CloseIcon /></button>
          </div>
          <div className="account-identity">
            <div className={portraitStyles.accountAvatarLarge} aria-hidden="true">{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={46} height={46} unoptimized /> : verificationApplication?.portraitUrl ? <Image src={verificationApplication.portraitUrl} alt="" width={46} height={46} unoptimized /> : initial}</div>
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
          {user.role === "admin" && <Link className="admin-access-panel" href="/admin/listing-notification-addons" onClick={onClose}>
            <span><strong>{zh ? "保存搜索曝光队列" : "Saved-search exposure queue"}</strong><small>{zh ? "确认付款后开通单套房源的保存搜索曝光。" : "Confirm payment before activating per-listing saved-search exposure."}</small></span>
            <b aria-hidden="true">→</b>
          </Link>}
          {user.role === "admin" && <Link className="admin-access-panel" href="/admin/reports" onClick={onClose}>
            <span><strong>{zh ? "安全审核队列" : "Safety review queue"}</strong><small>{zh ? "查看举报，留下审核说明，并隐藏或恢复房源。" : "Review reports, add notes, and hide or restore listings."}</small></span>
            <b aria-hidden="true">→</b>
          </Link>}
          {user.role === "admin" && <Link className="admin-access-panel" href="/admin/usage" onClick={onClose}>
            <span><strong>{zh ? "API 使用与成本" : "API usage and cost"}</strong><small>{zh ? "查看 AI、地图调用、缓存命中和限流情况。" : "Monitor AI, map calls, cache hits, and persistent limits."}</small></span>
            <b aria-hidden="true">→</b>
          </Link>}
          {user.role === "admin" && <Link className="admin-access-panel" href="/admin/activity" onClick={onClose}>
            <span><strong>{zh ? "安全活动日志" : "Security activity log"}</strong><small>{zh ? "查看登录、浏览、发布和管理操作的设备与网络信号。" : "Review login, browsing, publishing, and admin activity signals."}</small></span>
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
              <div className={portraitStyles.uploadPanel}>
                <div className={portraitStyles.preview} aria-label={zh ? "个人头像预览" : "Profile picture preview"}>
                  {(profilePreviewUrl || user.avatarUrl) ? <Image src={profilePreviewUrl || user.avatarUrl} alt="" width={72} height={72} unoptimized /> : <span>{initial}</span>}
                </div>
                <div className={portraitStyles.copy}>
                  <strong>{zh ? "个人头像（可选）" : "Profile picture (optional)"}</strong>
                  <small>{zh ? "这张照片只用于你的账号头像；不会出现在公开房源页。" : "This picture is used for your account avatar and is not shown on public listings."}</small>
                  <label className={`outline-button ${portraitStyles.picker}`} htmlFor="profile-avatar-file">{profileFile ? (zh ? "更换照片" : "Change photo") : (zh ? "选择照片" : "Choose photo")}</label>
                  <input className={portraitStyles.fileInput} id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileAvatarChange} />
                  {profileUploadStatus === "uploading" && <small className={portraitStyles.status} role="status">{zh ? "正在上传头像…" : "Uploading profile picture…"}</small>}
                  {profileUploadStatus === "uploaded" && <small className={portraitStyles.status} role="status">{zh ? "头像已上传，保存资料后生效。" : "Picture uploaded; save your profile to apply it."}</small>}
                  {profileUploadError && <small className={portraitStyles.error} role="alert">{profileUploadError}</small>}
                </div>
              </div>
              <label className="profile-field"><span className="profile-field-label" id="profile-display-name-label">{zh ? "姓名" : "Name"}</span><input id="profile-display-name" aria-labelledby="profile-display-name-label" value={profileName} onChange={(event) => setProfileName(event.target.value)} autoComplete="name" maxLength={80} required /></label>
              <label className="profile-field"><span className="profile-field-label" id="profile-phone-label">{zh ? "电话（可选）" : "Phone (optional)"}</span><input id="profile-phone" aria-labelledby="profile-phone-label" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" maxLength={32} inputMode="tel" placeholder={zh ? "例如 516-555-0123" : "e.g. 516-555-0123"} /></label>
              <label className="profile-field"><span className="profile-field-label" id="profile-email-label">{zh ? "登录邮箱" : "Sign-in email"}</span><input id="profile-email" aria-labelledby="profile-email-label" value={user.email} readOnly disabled /><small>{zh ? "邮箱用于登录；如需更改，之后需要重新验证。" : "Used for sign-in; changing it will require a separate re-verification flow."}</small></label>
              <div className="profile-form-actions"><button className="outline-button" type="button" onClick={() => { setProfileName(user.displayName); setProfilePhone(user.phone || ""); setProfileFile(null); setProfilePreviewUrl(""); setProfileUploadStatus("idle"); setProfileUploadError(""); setProfileError(""); setProfileEditing(false); }} disabled={profileSaving}>{zh ? "取消" : "Cancel"}</button><button className="primary-button" type="submit" disabled={profileSaving || profileUploadStatus === "uploading"}>{profileSaving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存资料" : "Save profile")}</button></div>
            </form>}
          </section>
          <section className="account-profile-panel renter-profile-panel" aria-labelledby="renter-profile-title">
            <div className="account-profile-heading">
              <div><span className="section-label">{zh ? "可复用申请" : "REUSABLE APPLICATION"}</span><h3 id="renter-profile-title">{zh ? "租客申请资料" : "Renter application profile"}</h3><p>{zh ? "保存一次，下次提交申请时自动带入。资料只在你提交申请时发送给对应房主或经纪。" : "Save once and reuse these details in future applications. They are shared only when you submit to a specific owner or agent."}</p></div>
              {user.emailVerified && !renterProfileEditing && <button className="text-button" type="button" onClick={() => { setRenterProfileError(""); setRenterProfileSaved(false); setRenterProfileEditing(true); }}>{zh ? "编辑申请资料" : "Edit application profile"}</button>}
            </div>
            {renterProfileSaved && <p className="verification-success" role="status">{zh ? "租客申请资料已保存，下次申请可以直接复用。" : "Your renter application profile is saved and ready to reuse."}</p>}
            {renterProfileError && <p className="form-error" role="alert">{renterProfileError}</p>}
            {!user.emailVerified ? <div className="profile-privacy-note"><strong>{zh ? "验证邮箱后即可保存" : "Verify your email to save this profile"}</strong><p>{zh ? "验证邮箱后，你可以预先保存入住偏好，提交申请时不用重复填写。" : "After email verification, you can save your renter preferences before applying."}</p></div> : renterProfileLoading ? <p className="field-help">{zh ? "正在读取已保存的申请资料…" : "Loading your saved application profile…"}</p> : !renterProfileEditing ? <div className="profile-summary renter-profile-summary">
              <div><span>{zh ? "称呼" : "Preferred name"}</span><strong>{renterProfile.preferredName || (zh ? "未填写" : "Not set")}</strong></div>
              <div><span>{zh ? "联系电话" : "Phone"}</span><strong>{renterProfile.phone || (zh ? "未填写" : "Not set")}</strong></div>
              <div><span>{zh ? "目前所在城市" : "Current city"}</span><strong>{renterProfile.currentCity || (zh ? "未填写" : "Not set")}</strong></div>
              <div><span>{zh ? "预计入住" : "Move-in"}</span><strong>{renterMoveInLabel(renterProfile.moveIn)}</strong></div>
              <div><span>{zh ? "预计租期" : "Lease length"}</span><strong>{renterLeaseLabel(renterProfile.leaseLength)}</strong></div>
              <div><span>{zh ? "居住人数" : "Occupants"}</span><strong>{renterProfile.householdSize || (zh ? "未填写" : "Not set")}</strong></div>
              <div><span>{zh ? "宠物" : "Pets"}</span><strong>{renterPetsLabel(renterProfile.pets)}</strong></div>
              <div><span>{zh ? "工作情况 / 收入" : "Employment / income"}</span><strong>{renterEmploymentLabel(renterProfile.employmentStatus)} · {renterIncomeLabel(renterProfile.incomeRange)}</strong></div>
            </div> : <form className="profile-form renter-profile-form" onSubmit={handleRenterProfileSubmit}>
              <fieldset className="application-sharing-controls">
                <legend>{zh ? "新申请的分享默认" : "Default sharing for new applications"}</legend>
                <p>{zh ? "默认不分享可选资料。提交每一套房源时，你仍可以单独调整。" : "Optional details stay private by default. You can change these choices for each application."}</p>
                <label className="application-share-option"><input type="checkbox" checked={renterProfileDraft.shareCurrentCity} onChange={(event) => updateRenterProfile("shareCurrentCity", event.target.checked)} /><span><strong>{zh ? "目前所在城市" : "Current city"}</strong><small>{zh ? "只分享城市或行政区，不分享精确地址。" : "Share only a city or borough, never an exact address."}</small></span></label>
                <label className="application-share-option"><input type="checkbox" checked={renterProfileDraft.shareEmployment} onChange={(event) => updateRenterProfile("shareEmployment", event.target.checked)} /><span><strong>{zh ? "工作情况" : "Employment status"}</strong><small>{zh ? "房主可能用来了解基本申请背景。" : "May help the owner understand basic application context."}</small></span></label>
                <label className="application-share-option"><input type="checkbox" checked={renterProfileDraft.shareIncome} onChange={(event) => updateRenterProfile("shareIncome", event.target.checked)} /><span><strong>{zh ? "月收入范围" : "Monthly income range"}</strong><small>{zh ? "只分享你选择的范围，不上传收入证明。" : "Shares only the selected range; no income documents are uploaded."}</small></span></label>
              </fieldset>
              <div className="form-row"><label className="profile-field"><span className="profile-field-label">{zh ? "称呼" : "Preferred name"}</span><input value={renterProfileDraft.preferredName} onChange={(event) => updateRenterProfile("preferredName", event.target.value)} autoComplete="name" maxLength={100} required /></label><label className="profile-field"><span className="profile-field-label">{zh ? "联系电话" : "Phone"}</span><input value={renterProfileDraft.phone} onChange={(event) => updateRenterProfile("phone", event.target.value)} autoComplete="tel" maxLength={40} inputMode="tel" required /></label></div>
              <label className="profile-field"><span className="profile-field-label">{zh ? "目前所在城市（可选）" : "Current city (optional)"}</span><input value={renterProfileDraft.currentCity} onChange={(event) => updateRenterProfile("currentCity", event.target.value)} maxLength={100} placeholder={zh ? "例如：皇后区" : "Example: Queens"} /></label>
              <div className="form-row"><label className="profile-field"><span className="profile-field-label">{zh ? "预计入住" : "Move-in"}</span><select value={renterProfileDraft.moveIn} onChange={(event) => updateRenterProfile("moveIn", event.target.value)}><option value="immediate">{zh ? "立即入住" : "Move in immediately"}</option><option value="august">{zh ? "2026年8月" : "Aug 2026"}</option><option value="september">{zh ? "2026年9月" : "Sep 2026"}</option><option value="october">{zh ? "2026年10月" : "Oct 2026"}</option></select></label><label className="profile-field"><span className="profile-field-label">{zh ? "预计租期" : "Lease length"}</span><select value={renterProfileDraft.leaseLength} onChange={(event) => updateRenterProfile("leaseLength", event.target.value)}><option value="6">{zh ? "6个月" : "6 months"}</option><option value="12">{zh ? "12个月" : "12 months"}</option><option value="24">{zh ? "24个月以上" : "24+ months"}</option><option value="undefined">{zh ? "未确定" : "Undefined"}</option></select></label></div>
              <div className="form-row"><label className="profile-field"><span className="profile-field-label">{zh ? "居住人数" : "Occupants"}</span><select value={renterProfileDraft.householdSize} onChange={(event) => updateRenterProfile("householdSize", event.target.value)}>{OCCUPANT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="profile-field"><span className="profile-field-label">{zh ? "宠物" : "Pets"}</span><select value={renterProfileDraft.pets} onChange={(event) => updateRenterProfile("pets", event.target.value)}><option value="no">{zh ? "没有" : "No pets"}</option><option value="yes">{zh ? "有宠物" : "Pets"}</option></select></label></div>
              <div className="form-row"><label className="profile-field"><span className="profile-field-label">{zh ? "工作情况" : "Employment"}</span><select value={renterProfileDraft.employmentStatus} onChange={(event) => updateRenterProfile("employmentStatus", event.target.value)}><option value="employed">{zh ? "受雇工作" : "Employed"}</option><option value="selfEmployed">{zh ? "自雇" : "Self-employed"}</option><option value="student">{zh ? "学生" : "Student"}</option><option value="retired">{zh ? "退休" : "Retired"}</option><option value="betweenJobs">{zh ? "正在寻找工作" : "Between jobs"}</option><option value="preferNotToSay">{zh ? "不便说明" : "Prefer not to say"}</option></select></label><label className="profile-field"><span className="profile-field-label">{zh ? "月收入范围" : "Monthly income range"}</span><select value={renterProfileDraft.incomeRange} onChange={(event) => updateRenterProfile("incomeRange", event.target.value)}><option value="preferNotToSay">{zh ? "不便说明" : "Prefer not to say"}</option><option value="under2500">{zh ? "$2,500 以下" : "Under $2,500"}</option><option value="2500-3999">$2,500–$3,999</option><option value="4000-5999">$4,000–$5,999</option><option value="6000plus">{zh ? "$6,000 以上" : "$6,000+"}</option></select></label></div>
              <label className="profile-field"><span className="profile-field-label">{zh ? "给房主的通用备注（可选）" : "Reusable note (optional)"}</span><textarea value={renterProfileDraft.note} onChange={(event) => updateRenterProfile("note", event.target.value)} maxLength={1_000} rows={3} placeholder={zh ? "例如：希望安排周末看房。" : "Example: I prefer a weekend tour."} /></label>
              <div className="profile-form-actions"><button className="outline-button" type="button" onClick={() => { setRenterProfileDraft(renterProfile); setRenterProfileError(""); setRenterProfileEditing(false); }} disabled={renterProfileSaving}>{zh ? "取消" : "Cancel"}</button><button className="primary-button" type="submit" disabled={renterProfileSaving}>{renterProfileSaving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存申请资料" : "Save application profile")}</button></div>
            </form>}
          </section>
          {user.accountType === "user" && <section className="agent-verification-panel" aria-labelledby="agent-application-title">
            <div className="account-profile-heading"><div><span className="section-label">AGENT PATH</span><h3 id="agent-application-title">{zh ? "申请成为房产经纪" : "Apply as a real-estate agent"}</h3><p>{zh ? "你仍然可以继续以房主身份发布自己的房源。开始申请后，提交执照资料，管理员核验通过后才会开放经纪身份和更高发布额度。" : "You can keep posting your own rentals as an owner. Start the application, submit your license details, and receive higher capacity only after admin approval."}</p></div><span className="status-chip unpublished">{zh ? "尚未申请" : "Not started"}</span></div>
            {!user.emailVerified ? <p className="profile-privacy-note"><strong>{zh ? "请先验证邮箱" : "Verify your email first"}</strong><span>{zh ? "验证邮箱后即可开始经纪身份申请。" : "Agent applications open after your email is verified."}</span></p> : <>
              {agentApplicationError && <p className="form-error" role="alert">{agentApplicationError}</p>}
              <button className="outline-button" type="button" onClick={() => { void handleAgentApplication(); }} disabled={agentApplicationLoading}>{agentApplicationLoading ? (zh ? "准备中…" : "Starting…") : (zh ? "开始经纪申请" : "Start agent application")}</button>
            </>}
          </section>}
           <section className="account-quota-panel" aria-label={zh ? "房源发布额度" : "Listing publishing capacity"}>
            <div><span className="section-label">{zh ? "发布额度" : "POSTING CAPACITY"}</span><strong>{unlimitedListingAccess ? (zh ? "管理员无限额度" : "Admin unlimited capacity") : user.agentVerified ? (zh ? "已核验经纪额度" : "Verified agent capacity") : (zh ? "普通账户额度" : "Regular account capacity")}</strong><p>{unlimitedListingAccess ? (zh ? "管理员账户不受有效房源数量限制。" : "Admin accounts are not limited by the active listing quota.") : user.agentVerified ? (zh ? "执照核验通过后，可发布更多房源。" : "Your approved license gives this account a higher listing limit.") : (zh ? "经纪账户完成执照核验后，额度会自动提高。" : "Agent accounts receive the higher limit after license verification.")}</p></div><span className="quota-count">{activeListingCount} / {unlimitedListingAccess ? (zh ? "无限" : "Unlimited") : listingLimit}</span>
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
            <button className={tab === "applications" ? "active" : ""} type="button" role="tab" aria-selected={tab === "applications"} onClick={() => onTabChange("applications")}>{zh ? "租赁申请" : "Applications"}<span>{applications.length + receivedApplications.filter((application) => application.status !== "declined" && application.status !== "withdrawn").length}</span></button>
            {canManageAgentRequests && <button className={tab === "agentRequests" ? "active" : ""} type="button" role="tab" aria-selected={tab === "agentRequests"} onClick={() => onTabChange("agentRequests")}>{zh ? "经纪请求" : "Agent requests"}<span>{agentRequests.filter((request) => request.status === "pending").length}</span></button>}
            <button className={tab === "safety" ? "active" : ""} type="button" role="tab" aria-selected={tab === "safety"} onClick={() => onTabChange("safety")}>{zh ? "安全设置" : "Safety"}<span>{blockedPublishers.length}</span></button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {loading ? <div className="dashboard-loading" aria-live="polite"><span /><span /><span /></div> : tab === "listings" ? (
            <>
            <OwnerOperationsPanel
              locale={locale}
              listings={listings.map((listing) => ({ id: listing.id, titleZh: listing.titleZh, titleEn: listing.titleEn, status: listing.status }))}
              inquiries={inquiries.map((inquiry) => ({ id: inquiry.id, listingTitle: inquiry.listingTitle, requesterName: inquiry.requesterName, requesterEmail: inquiry.requesterEmail }))}
              onListingOperationalChange={onListingOperationalChange}
            />
            {listings.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有房源" : "No listings yet"}</h3><p>{zh ? "发布第一套房源后，它会在这里显示。" : "Publish your first listing and it will appear here."}</p></div> :
              <div className="dashboard-list">
                {listings.map((listing) => {
                  const published = listing.status === "published";
                  const expired = Boolean(listing.expiresOn && listing.expiresOn < new Date().toISOString().slice(0, 10));
                  const lifecycleClass = expired ? "expired" : published ? "published" : "unpublished";
                  const lifecycleLabel = expired ? (zh ? "已过期" : "Expired") : published ? (zh ? "已发布" : "Published") : (zh ? "已暂停" : "Paused");
                  const moderationStatus = listing.moderationStatus || "approved";
                  const moderationLabel = moderationStatus === "under_review" ? (zh ? "审核中" : "Under review") : moderationStatus === "hidden" ? (zh ? "已隐藏" : "Hidden") : moderationStatus === "rejected" ? (zh ? "未通过" : "Not approved") : "";
                  const moderationClass = moderationStatus === "approved" ? "published" : moderationStatus === "under_review" ? "pending" : "expired";
                  const moderationNote = listing.moderationNote || "";
                  const expiryDate = listing.expiresOn ? new Date(`${listing.expiresOn}T00:00:00`).toLocaleDateString(zh ? "zh-CN" : "en-US") : "";
                  return <article className="dashboard-row" key={listing.id}>
                    <div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{zh ? listing.titleZh : listing.titleEn}</h3><span className={`status-chip ${lifecycleClass}`}>{lifecycleLabel}</span>{moderationLabel && <span className={`status-chip ${moderationClass}`}>{moderationLabel}</span>}</div><p>{zh ? toChineseLocationLabel(listing.areaZh || listing.areaEn) : listing.areaEn || listing.areaZh} · ${listing.price.toLocaleString("en-US")} / {zh ? "月" : "mo"}</p><small>{zh ? "精确地址" : "Exact address"}: {listing.privateAddress} · {labelDate(listing.createdAt)}</small>{moderationNote && <small className="moderation-note">{zh ? "审核说明：" : "Moderation note: "}{listing.moderationNote}</small>}{listing.expiresOn && <small className={`listing-expiry-note ${expired ? "expired" : ""}`}>{expired ? (zh ? "公开期限已过：" : "Public until passed: ") : (zh ? "公开至：" : "Public until: ")}{expiryDate}</small>}{listing.agentService === "agentMatch" && <><small className="agent-status-note">{listing.agentProfileId ? (zh ? `指定经纪：${listing.agentProfileNameZh || "已选择"}` : `Selected agent: ${listing.agentProfileNameEn || "Selected"}`) : (zh ? "经纪协助：等待匹配" : "Agent assistance: matching requested")} · {requestStatusLabel(listing.agentRequestStatus || "pending")}</small><small>{zh ? "费用意向：" : "Fee preference: "}{agentFeeLabel(listing)}</small>{listing.agentRequestNote && <small>{zh ? "经纪留言：" : "Agent note: "}{listing.agentRequestNote}</small>}</>}</div>
                    <div className="dashboard-row-actions"><button className="link-button" type="button" onClick={() => onViewListing(listing.id)}>{zh ? "查看" : "View"}</button><button className="text-button" type="button" onClick={() => onEditListing(listing.id)}>{zh ? "编辑" : "Edit"}</button>{expired ? <button className="text-button" type="button" onClick={() => onRenewListing(listing.id)}>{zh ? "续期 30 天" : "Renew 30 days"}</button> : <button className="text-button" type="button" onClick={() => onSetListingStatus(listing.id, published ? "paused" : "published")}>{published ? (zh ? "暂停" : "Pause") : (zh ? "重新发布" : "Republish")}</button>}</div>
                  </article>;
                })}
              </div>
            }
            </>
          ) : tab === "inquiries" ? (
            inquiries.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有咨询" : "No inquiries yet"}</h3><p>{zh ? "租客发送咨询后，内容会在这里显示。" : "Renter inquiries will appear here when someone contacts you."}</p></div> :
              <div className="dashboard-list inquiry-list">
                {inquiries.map((inquiry) => {
                  const inquiryStatus = inquiry.status || "sent";
                  const isBusy = inquiryActionId === inquiry.id;
                  return <article className="dashboard-row inquiry-row" key={inquiry.id}>
                    <div className="dashboard-row-main">
                      <div className="dashboard-row-heading"><h3>{inquiry.listingTitle}</h3><span className={`status-chip ${inquiryStatusClass(inquiryStatus)}`}>{inquiryStatusLabel(inquiryStatus)}</span></div>
                      <p>{inquiry.requesterName || (zh ? "租客" : "Renter")} · {inquiry.requesterEmail}</p>
                      <small>{zh ? "入住" : "Move-in"}: {inquiry.moveIn} · {zh ? "租期" : "Lease"}: {inquiry.leaseLength} · {zh ? "人数" : "Occupants"}: {inquiry.occupants}</small>
                      {inquiry.tourPreference && <small>{zh ? "看房偏好" : "Tour preference"}: {inquiry.tourPreference}</small>}
                      {(inquiry.tourRequestedDate || (inquiry.tourRequestedWindow && inquiry.tourRequestedWindow !== "any")) && <small className="inquiry-tour-request">{zh ? "租客希望" : "Renter requested"}: {inquiry.tourRequestedDate || (zh ? "日期未定" : "Date flexible")} · {inquiry.tourRequestedWindow === "weekdayDay" ? (zh ? "工作日白天" : "Weekday daytime") : inquiry.tourRequestedWindow === "weekdayEvening" ? (zh ? "工作日晚上" : "Weekday evening") : inquiry.tourRequestedWindow === "weekendDay" ? (zh ? "周末白天" : "Weekend daytime") : inquiry.tourRequestedWindow === "weekendEvening" ? (zh ? "周末晚上" : "Weekend evening") : (zh ? "时间不限" : "Any time")}</small>}
                      {inquiry.pets && <small>{zh ? "宠物" : "Pets"}: {inquiry.pets}</small>}
                      {inquiry.message && <blockquote>{inquiry.message}</blockquote>}
                      {inquiry.tourScheduledAt && <small className="inquiry-tour-details">{zh ? "看房时间" : "Tour"}: {inquiryTourDateLabel(inquiry.tourScheduledAt, inquiry.tourTimeZone)}{inquiry.tourTimeZone ? ` · ${inquiry.tourTimeZone}` : ""}{inquiry.tourNote ? ` · ${inquiry.tourNote}` : ""}</small>}
                      {inquiry.addressRevealStatus === "revealed" && <small className="inquiry-address-state revealed">{zh ? "精确地址已分享给租客" : "Exact address shared with renter"}</small>}
                    </div>
                    <div className="dashboard-row-actions">
                      <a className="link-button" href={`mailto:${inquiry.requesterEmail || ""}`}>{zh ? "回复" : "Reply"}</a>
                      {inquiryStatus === "sent" && <button className="text-button" type="button" onClick={() => { void handleInquiryStatusChange(inquiry.id, "contacted"); }} disabled={isBusy}>{zh ? "标记已联系" : "Mark contacted"}</button>}
                      {inquiryStatus !== "closed" && <button className="outline-button" type="button" onClick={() => openSchedule(inquiry)} disabled={isBusy}>{inquiry.tourScheduledAt ? (zh ? "修改看房" : "Edit tour") : (zh ? "安排看房" : "Schedule tour")}</button>}
                      {inquiry.tourScheduledAt && inquiry.addressRevealStatus !== "revealed" && <button className="outline-button address-reveal-action" type="button" onClick={() => { void handleRevealAddress(inquiry); }} disabled={isBusy}>{isBusy ? (zh ? "处理中…" : "Working…") : (zh ? "分享精确地址" : "Share exact address")}</button>}
                      {inquiryStatus !== "closed" && <button className="text-button" type="button" onClick={() => { void handleInquiryStatusChange(inquiry.id, "closed"); }} disabled={isBusy}>{zh ? "完成咨询" : "Close inquiry"}</button>}
                    </div>
                    {schedulingInquiryId === inquiry.id && <form className="inquiry-schedule-form" onSubmit={handleScheduleSubmit}>
                      <div className="inquiry-schedule-heading"><strong>{zh ? "安排看房时间" : "Schedule a tour"}</strong><button className="text-button" type="button" onClick={() => { setSchedulingInquiryId(null); setScheduleError(""); }}>{zh ? "取消" : "Cancel"}</button></div>
                      <div className="form-row">
                        <label className="field-label"><span>{zh ? "日期" : "Date"}</span><input type="date" min={today} value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} required /></label>
                        <label className="field-label"><span>{zh ? "时间" : "Time"}</span><input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} required /></label>
                      </div>
                      <label className="field-label"><span>{zh ? "给租客的备注（可选）" : "Note for renter (optional)"}</span><textarea rows={2} maxLength={500} value={scheduleNote} onChange={(event) => setScheduleNote(event.target.value)} placeholder={zh ? "例如：请在大堂集合。" : "Example: Let’s meet in the lobby."} /></label>
                      {scheduleError && <p className="form-error" role="alert">{scheduleError}</p>}
                      <button className="primary-button" type="submit" disabled={isBusy}>{isBusy ? (zh ? "保存中…" : "Saving…") : (zh ? "确认看房时间" : "Confirm tour")}</button>
                    </form>}
                  </article>;
                })}
              </div>
          ) : tab === "applications" ? (
            applications.length === 0 && receivedApplications.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有租赁申请" : "No rental applications yet"}</h3><p>{zh ? "你提交的申请，以及别人申请你房源的记录，会在这里显示。" : "Your submitted applications and applications received for your listings will appear here."}</p></div> :
              <div className="application-dashboard">
                <section className="application-dashboard-section" aria-labelledby="my-applications-heading">
                  <div className="application-section-heading"><div><span className="section-label">{zh ? "租客端" : "RENTER SIDE"}</span><h3 id="my-applications-heading">{zh ? "我的申请" : "My applications"}</h3></div><span>{applications.length}</span></div>
                  {applications.length === 0 ? <p className="application-empty-line">{zh ? "你还没有提交过租赁申请。" : "You have not submitted a rental application yet."}</p> : <div className="dashboard-list application-list">
                    {applications.map((application) => {
                      const isBusy = applicationActionLoadingId === application.id;
                      return <article className="dashboard-row application-row" key={application.id}>
                        <div className="dashboard-row-main"><div className="dashboard-row-heading"><h4>{application.listingTitle}</h4><span className={`status-chip ${applicationStatusClass(application.status)}`}>{applicationStatusLabel(application.status)}</span>{applicationIsUnread(application) && <span className="application-unread-chip">{zh ? "有更新" : "New update"}</span>}</div><p>{application.listingArea}</p><small>{zh ? "提交" : "Submitted"}: {applicationDateLabel(application.submittedAt)} · {zh ? "入住" : "Move-in"}: {application.moveIn} · {zh ? "租期" : "Lease"}: {application.leaseLength}</small><small>{zh ? "房主" : "Owner"}: {application.ownerName || "—"}{application.ownerEmail ? ` · ${application.ownerEmail}` : ""}</small>{application.ownerNote && <blockquote>{zh ? "房主备注：" : "Owner note: "}{application.ownerNote}</blockquote>}{applicationEventsLabel(application).length > 0 && <ol className="application-status-timeline" aria-label={zh ? "申请状态记录" : "Application status history"}>{applicationEventsLabel(application).map((event) => <li key={event.id} className={event.status === application.status ? "current" : ""}><div><strong>{applicationStatusLabel(event.status)}</strong><span>{applicationEventActorLabel(event.actorRole)} · {applicationDateLabel(event.createdAt)}</span></div>{event.note && <p>{event.note}</p>}</li>)}</ol>}</div>
                        <div className="dashboard-row-actions">{application.status !== "withdrawn" && application.status !== "declined" && <button className="text-button" type="button" onClick={() => { void onApplicationStatusChange(application.id, "withdrawn", ""); }} disabled={isBusy}>{isBusy ? (zh ? "处理中…" : "Working…") : (zh ? "撤回申请" : "Withdraw")}</button>}</div>
                      </article>;
                    })}
                  </div>}
                </section>
                {receivedApplications.length > 0 && <section className="application-dashboard-section" aria-labelledby="received-applications-heading">
                  <div className="application-section-heading"><div><span className="section-label">{zh ? "房源端" : "LISTING SIDE"}</span><h3 id="received-applications-heading">{zh ? "收到的申请" : "Received applications"}</h3></div><span>{receivedApplications.length}</span></div>
                  <div className="dashboard-list application-list">
                    {receivedApplications.map((application) => {
                      const isBusy = applicationActionLoadingId === application.id;
                      const note = applicationNotes[application.id] ?? application.ownerNote;
                      return <article className="dashboard-row application-row application-review-row" key={application.id}>
                        <div className="dashboard-row-main"><div className="dashboard-row-heading"><h4>{application.listingTitle}</h4><span className={`status-chip ${applicationStatusClass(application.status)}`}>{applicationStatusLabel(application.status)}</span>{applicationIsUnread(application) && <span className="application-unread-chip">{zh ? "新申请" : "New"}</span>}</div><p>{application.applicantName || application.preferredName} · {application.applicantEmail || "—"}</p><small>{zh ? "入住" : "Move-in"}: {application.moveIn} · {zh ? "租期" : "Lease"}: {application.leaseLength} · {zh ? "人数" : "Occupants"}: {application.occupants} · {zh ? "宠物" : "Pets"}: {application.pets}</small>{application.currentCity && <small>{zh ? "目前所在城市" : "Current city"}: {application.currentCity}</small>}<small>{zh ? "工作情况" : "Employment"}: {application.employmentStatus || (zh ? "未提供" : "Not provided")} · {zh ? "收入范围" : "Income range"}: {application.incomeRange || (zh ? "未提供" : "Not provided")}</small>{application.message && <blockquote>{application.message}</blockquote>}{applicationEventsLabel(application).length > 0 && <ol className="application-status-timeline" aria-label={zh ? "申请状态记录" : "Application status history"}>{applicationEventsLabel(application).map((event) => <li key={event.id} className={event.status === application.status ? "current" : ""}><div><strong>{applicationStatusLabel(event.status)}</strong><span>{applicationEventActorLabel(event.actorRole)} · {applicationDateLabel(event.createdAt)}</span></div>{event.note && <p>{event.note}</p>}</li>)}</ol>}<label className="application-note-field"><span>{zh ? "给租客的备注（可选）" : "Note for renter (optional)"}</span><textarea rows={2} maxLength={1_000} value={note} onChange={(event) => setApplicationNotes((current) => ({ ...current, [application.id]: event.target.value }))} placeholder={zh ? "例如：可以安排周末看房。" : "Example: We can arrange a weekend tour."} /></label></div>
                        <div className="dashboard-row-actions"><button className="text-button" type="button" onClick={() => { void onApplicationStatusChange(application.id, "reviewing", note); }} disabled={isBusy || application.status === "reviewing" || application.status === "approved" || application.status === "declined"}>{zh ? "标记审核中" : "Mark reviewing"}</button><button className="outline-button" type="button" onClick={() => { void onApplicationStatusChange(application.id, "approved", note); }} disabled={isBusy || application.status === "approved" || application.status === "declined"}>{zh ? "通过" : "Approve"}</button><button className="text-button" type="button" onClick={() => { void onApplicationStatusChange(application.id, "declined", note); }} disabled={isBusy || application.status === "declined"}>{zh ? "不通过" : "Decline"}</button></div>
                      </article>;
                    })}
                  </div>
                </section>}
              </div>
          ) : tab === "safety" ? (
            <section className="account-safety-panel" aria-labelledby="account-safety-title">
              <div className="account-profile-heading"><div><span className="section-label">{zh ? "可控的安全" : "SAFETY CONTROLS"}</span><h3 id="account-safety-title">{zh ? "已屏蔽的发布者" : "Blocked publishers"}</h3><p>{zh ? "屏蔽会影响你之后的公开搜索，不会向对方发送通知。你可以随时取消屏蔽。" : "Blocking removes a publisher’s listings from your future public searches. They are not notified, and you can reverse it anytime."}</p></div></div>
              {blockedPublishers.length === 0 ? <div className="drawer-empty account-safety-empty"><h3>{zh ? "暂时没有屏蔽对象" : "No blocked publishers"}</h3><p>{zh ? "如果房源或沟通让你不舒服，可以在房源详情的安全提示中屏蔽发布者。" : "If a listing or conversation feels unsafe, use the safety checklist in the listing detail to block its publisher."}</p></div> : <div className="blocked-publisher-list">
                {blockedPublishers.map((publisher) => <article className="blocked-publisher-row" key={publisher.id}><div><strong>{publisher.displayName}</strong><small>{publisher.accountType === "agent" ? (zh ? "经纪账号" : "Agent account") : (zh ? "用户账号" : "User account")} · {publisher.blockedAt ? new Date(publisher.blockedAt).toLocaleDateString(zh ? "zh-CN" : "en-US") : ""}</small></div><button className="text-button" type="button" onClick={() => onUnblockPublisher(publisher.id)} disabled={blockLoadingId === publisher.id}>{blockLoadingId === publisher.id ? (zh ? "处理中…" : "Working…") : (zh ? "取消屏蔽" : "Unblock")}</button></article>)}
              </div>}
            </section>
          ) : (
            agentRequests.length === 0 ? <div className="drawer-empty"><h3>{zh ? "还没有经纪请求" : "No agent requests"}</h3><p>{zh ? "房主请求你的经纪协助后，内容会在这里显示。" : "Owner requests for your assistance will appear here."}</p></div> :
              <div className="dashboard-list agent-request-list">
                {agentRequests.map((request) => <article className="dashboard-row agent-request-row" key={request.id}>
                  <div className="dashboard-row-main"><div className="dashboard-row-heading"><h3>{zh ? request.listingTitleZh : request.listingTitleEn}</h3><span className={`status-chip ${request.status === "accepted" ? "published" : "unpublished"}`}>{requestStatusLabel(request.status)}</span></div><p>{zh ? request.listingAreaZh : request.listingAreaEn}</p><small>{zh ? "房主" : "Owner"}: {request.ownerName} · {request.ownerEmail}</small><small>{zh ? "费用意向" : "Fee preference"}: {requestFeeLabel(request)}</small>{request.ownerNote && <blockquote>{request.ownerNote}</blockquote>}{request.agentNote && <small className="agent-status-note">{zh ? "你的留言" : "Your note"}: {request.agentNote}</small>}</div>
                  <div className="dashboard-row-actions">{request.status === "pending" ? <><button className="outline-button" type="button" onClick={() => onAgentRequestDecision(request.id, "accepted")} disabled={agentRequestLoadingId === request.id}>{agentRequestLoadingId === request.id ? (zh ? "处理中…" : "Working…") : (zh ? "接受" : "Accept")}</button><button className="text-button" type="button" onClick={() => onAgentRequestDecision(request.id, "declined")} disabled={agentRequestLoadingId === request.id}>{zh ? "拒绝" : "Decline"}</button></> : <span className="status-chip">{requestStatusLabel(request.status)}</span>}</div>
                </article>)}
              </div>
          )}
          <div className="account-footer"><p>{zh ? "账户权限只允许你管理自己的房源和收到的咨询。" : "Your account can manage only its own listings and received inquiries."}</p><div className="account-footer-actions"><Link className="text-button" href="/delete-account" onClick={onClose}>{zh ? "删除账户" : "Delete account"}</Link><button className="outline-button" type="button" onClick={onLogout}>{zh ? "退出登录" : "Sign out"}</button></div></div>
        </div>
      </aside>
    </div>
  );
}

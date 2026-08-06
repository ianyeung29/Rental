"use client";

import { useEffect, useState, type FormEvent } from "react";
import { exactOccupantOrDefault, OCCUPANT_OPTIONS } from "../lib/renter-options";

type Locale = "zh" | "en";

export type ApplicationFormValues = {
  preferredName: string;
  phone: string;
  currentCity: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  employmentStatus: string;
  incomeRange: string;
  message: string;
};

type ApplicationDrawerProps = {
  locale: Locale;
  listingTitle: string;
  listingArea: string;
  profileDefaults: { displayName: string; phone: string };
  loading: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: ApplicationFormValues) => Promise<void>;
};

const defaultValues = (profileDefaults: ApplicationDrawerProps["profileDefaults"]): ApplicationFormValues => ({
  preferredName: profileDefaults.displayName,
  phone: profileDefaults.phone,
  currentCity: "",
  moveIn: "immediate",
  leaseLength: "12",
  occupants: "1",
  pets: "no",
  employmentStatus: "employed",
  incomeRange: "preferNotToSay",
  message: "",
});

function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" /></svg>;
}

function ShieldIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-2.7 7.9-7 10-4.3-2.1-7-5.4-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.8" /><path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function ApplicationDrawer({ locale, listingTitle, listingArea, profileDefaults, loading, error, onClose, onSubmit }: ApplicationDrawerProps) {
  const zh = locale === "zh";
  const [values, setValues] = useState<ApplicationFormValues>(() => defaultValues(profileDefaults));
  const [localError, setLocalError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/renter-profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { profile?: Partial<ApplicationFormValues> & { householdSize?: string } };
        if (!cancelled && result.profile) {
          const savedOccupants = result.profile.occupants ?? result.profile.householdSize;
          setValues((current) => ({ ...current, ...result.profile, occupants: exactOccupantOrDefault(savedOccupants ?? current.occupants) }));
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [profileDefaults.displayName, profileDefaults.phone]);

  const setValue = <K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setLocalError("");
    setProfileSaveMessage("");
  };

  const saveProfileForReuse = async () => {
    setProfileSaving(true);
    setLocalError("");
    setProfileSaveMessage("");
    try {
      const response = await fetch("/api/renter-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredName: values.preferredName,
          phone: values.phone,
          currentCity: values.currentCity,
          employmentStatus: values.employmentStatus,
          incomeRange: values.incomeRange,
          householdSize: values.occupants,
          pets: values.pets,
          moveIn: values.moveIn,
          leaseLength: values.leaseLength,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || (zh ? "申请资料暂时无法保存。" : "The application profile could not be saved."));
      setProfileSaveMessage(zh ? "已保存，下次申请会自动带入。" : "Saved for your next application.");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : (zh ? "申请资料暂时无法保存。" : "The application profile could not be saved."));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.preferredName.trim() || !values.phone.trim()) {
      setLocalError(zh ? "请填写称呼和联系电话。" : "Add your name and phone number.");
      return;
    }
    try {
      await onSubmit(values);
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : (zh ? "申请暂时无法提交。" : "The application could not be submitted."));
    }
  };

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer form-drawer application-drawer" role="dialog" aria-modal="true" aria-labelledby="application-title">
        <div className="drawer-content">
          <div className="drawer-heading"><span className="section-label">{zh ? "租客申请" : "RENTER APPLICATION"}</span><button className="drawer-close" type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><CloseIcon /></button></div>
          <h2 id="application-title">{zh ? "提交租赁申请" : "Submit a rental application"}</h2>
          <p className="drawer-intro">{listingTitle}{listingArea ? ` · ${listingArea}` : ""}</p>
          <div className="application-privacy"><span className="application-privacy-icon"><ShieldIcon /></span><div><strong>{zh ? "仅发送给房源发布者" : "Shared only with the listing owner"}</strong><p>{zh ? "这些资料会保存在你的私密账户中，提交后只会发送给这套房源的房主或经纪。我们目前不收集身份证件、信用文件或收入证明。" : "These details stay in your private account and are sent only to this listing’s owner or agent. We do not collect identity, credit, or income documents in this step."}</p></div></div>
          {(error || localError) && <p className="form-error" role="alert">{error || localError}</p>}
          <form className="application-form" onSubmit={handleSubmit}>
            <div className="application-form-intro"><strong>{zh ? "基本资料" : "Your details"}</strong>{profileLoading ? <span>{zh ? "正在读取已保存资料…" : "Loading saved profile…"}</span> : <span>{zh ? "下次申请可直接复用" : "Reusable for your next application"}</span>}</div>
            <div className="application-profile-save-row"><span>{zh ? "想稍后再申请？可以先保存这些资料。" : "Applying later? Save these details now."}</span><button className="outline-button" type="button" onClick={() => { void saveProfileForReuse(); }} disabled={profileSaving || loading}>{profileSaving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存申请资料" : "Save profile")}</button></div>
            {profileSaveMessage && <p className="verification-success application-profile-save-message" role="status">{profileSaveMessage}</p>}
            <div className="form-row"><label className="field-label"><span>{zh ? "称呼" : "Preferred name"}</span><input value={values.preferredName} onChange={(event) => setValue("preferredName", event.target.value)} maxLength={100} required /></label><label className="field-label"><span>{zh ? "联系电话" : "Phone"}</span><input value={values.phone} onChange={(event) => setValue("phone", event.target.value)} maxLength={40} required /></label></div>
            <label className="field-label"><span>{zh ? "目前所在城市（可选）" : "Current city (optional)"}</span><input value={values.currentCity} onChange={(event) => setValue("currentCity", event.target.value)} maxLength={100} placeholder={zh ? "例如：皇后区" : "Example: Queens"} /></label>
            <div className="form-row"><label className="field-label"><span>{zh ? "预计入住" : "Move-in"}</span><select value={values.moveIn} onChange={(event) => setValue("moveIn", event.target.value)}><option value="immediate">{zh ? "立即入住" : "Move in immediately"}</option><option value="august">{zh ? "2026年8月" : "Aug 2026"}</option><option value="september">{zh ? "2026年9月" : "Sep 2026"}</option><option value="october">{zh ? "2026年10月" : "Oct 2026"}</option></select></label><label className="field-label"><span>{zh ? "预计租期" : "Lease length"}</span><select value={values.leaseLength} onChange={(event) => setValue("leaseLength", event.target.value)}><option value="6">{zh ? "6个月" : "6 months"}</option><option value="12">{zh ? "12个月" : "12 months"}</option><option value="24">{zh ? "24个月以上" : "24+ months"}</option><option value="undefined">{zh ? "未确定" : "Undefined"}</option></select></label></div>
            <div className="form-row"><label className="field-label"><span>{zh ? "居住人数" : "Occupants"}</span><select value={values.occupants} onChange={(event) => setValue("occupants", event.target.value)}>{OCCUPANT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="field-label"><span>{zh ? "是否有宠物" : "Pets"}</span><select value={values.pets} onChange={(event) => setValue("pets", event.target.value)}><option value="no">{zh ? "没有" : "No pets"}</option><option value="yes">{zh ? "有宠物" : "Yes"}</option></select></label></div>
            <div className="form-row"><label className="field-label"><span>{zh ? "工作情况" : "Employment"}</span><select value={values.employmentStatus} onChange={(event) => setValue("employmentStatus", event.target.value)}><option value="employed">{zh ? "受雇工作" : "Employed"}</option><option value="selfEmployed">{zh ? "自雇" : "Self-employed"}</option><option value="student">{zh ? "学生" : "Student"}</option><option value="retired">{zh ? "退休" : "Retired"}</option><option value="betweenJobs">{zh ? "正在寻找工作" : "Between jobs"}</option><option value="preferNotToSay">{zh ? "不便说明" : "Prefer not to say"}</option></select></label><label className="field-label"><span>{zh ? "月收入范围" : "Monthly income range"}</span><select value={values.incomeRange} onChange={(event) => setValue("incomeRange", event.target.value)}><option value="preferNotToSay">{zh ? "不便说明" : "Prefer not to say"}</option><option value="under2500">{zh ? "$2,500 以下" : "Under $2,500"}</option><option value="2500-3999">$2,500–$3,999</option><option value="4000-5999">$4,000–$5,999</option><option value="6000plus">{zh ? "$6,000 以上" : "$6,000+"}</option></select></label></div>
            <label className="field-label"><span>{zh ? "给房主的补充说明（可选）" : "Note for the owner (optional)"}</span><textarea value={values.message} onChange={(event) => setValue("message", event.target.value)} rows={4} maxLength={1_000} placeholder={zh ? "例如：希望尽快看房，或有具体入住安排。" : "Example: I would like to see the home soon, or have a specific move-in plan."} /></label>
            <button className="primary-button full-button" type="submit" disabled={loading}>{loading ? (zh ? "提交中…" : "Submitting…") : (zh ? "提交申请" : "Submit application")}</button>
          </form>
        </div>
      </aside>
    </div>
  );
}

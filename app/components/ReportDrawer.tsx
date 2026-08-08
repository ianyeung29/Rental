"use client";

import { FormEvent } from "react";
import { useDialogA11y } from "../lib/use-dialog-a11y";

type Locale = "zh" | "en";

type ReportDrawerProps = {
  locale: Locale;
  listingTitle: string;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function ReportDrawer({ locale, listingTitle, loading, error, onClose, onSubmit }: ReportDrawerProps) {
  const zh = locale === "zh";
  const dialogRef = useDialogA11y(true, onClose);
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} className="drawer form-drawer report-drawer" role="dialog" aria-modal="true" aria-labelledby="report-title" tabIndex={-1}>
        <div className="drawer-content">
          <div className="drawer-heading">
            <span className="section-label">{zh ? "安全反馈" : "SAFETY REPORT"}</span>
            <button className="drawer-close" type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><CloseIcon /></button>
          </div>
          <h2 id="report-title">{zh ? "举报此房源" : "Report this listing"}</h2>
          <p className="drawer-intro">{zh ? `告诉我们 ${listingTitle} 可能存在的问题。我们会把反馈交给审核人员。` : `Tell us what may be wrong with ${listingTitle}. Your report will go to the moderation queue.`}</p>
          <form className="report-form" onSubmit={onSubmit}>
            <label className="field-label" htmlFor="report-reason">{zh ? "问题类型" : "Reason"}
              <select id="report-reason" name="reason" defaultValue="" required>
                <option value="" disabled>{zh ? "请选择" : "Choose a reason"}</option>
                <option value="misleading">{zh ? "信息可能不实" : "Misleading information"}</option>
                <option value="scam">{zh ? "疑似诈骗" : "Possible scam"}</option>
                <option value="discriminatory">{zh ? "歧视性内容" : "Discriminatory content"}</option>
                <option value="privacy">{zh ? "隐私或地址问题" : "Privacy or address concern"}</option>
                <option value="other">{zh ? "其他问题" : "Other"}</option>
              </select>
            </label>
            <label className="field-label" htmlFor="report-details">{zh ? "补充说明（可选）" : "Details (optional)"}
              <textarea id="report-details" name="details" rows={5} maxLength={1000} placeholder={zh ? "请描述你看到的问题" : "Describe what you noticed"} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="form-safety">{zh ? "请只提交与房源安全、真实性或隐私有关的反馈。" : "Please use reports for safety, accuracy, or privacy concerns."}</p>
            <button className="primary-button full-button" type="submit" disabled={loading}>{loading ? (zh ? "提交中…" : "Submitting…") : (zh ? "提交举报" : "Submit report")}</button>
          </form>
        </div>
      </aside>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "sending" | "success" | "error";

const FEEDBACK_TYPES = [
  { value: "experience", label: "使用体验 · User experience" },
  { value: "bug", label: "错误或故障 · Bug or error" },
  { value: "search", label: "搜索与区域 · Search or location" },
  { value: "listing", label: "发布房源 · Listing workflow" },
  { value: "other", label: "其他建议 · Other" },
];

export default function FeedbackForm() {
  const [status, setStatus] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", type: "experience", message: "", website: "" });

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (status !== "idle") {
      setStatus("idle");
      setError("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, pageUrl: window.location.href }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "暂时无法发送，请稍后重试。 / Please try again later.");
      setStatus("success");
      setForm({ name: "", email: "", type: "experience", message: "", website: "" });
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "暂时无法发送，请稍后重试。 / Please try again later.");
    }
  };

  return (
    <form className="public-form" onSubmit={submit}>
      <div className="public-form-heading">
        <div>
          <span className="section-label">FEEDBACK DESK</span>
          <h2>把体验告诉我们</h2>
        </div>
        <span className="public-form-required">邮箱可选</span>
      </div>

      <div className="public-field-grid">
        <label className="public-field">
          <span>姓名 / Name</span>
          <input value={form.name} onChange={(event) => update("name", event.target.value)} name="name" maxLength={80} autoComplete="name" />
        </label>
        <label className="public-field">
          <span>邮箱 / Email</span>
          <input value={form.email} onChange={(event) => update("email", event.target.value)} name="email" type="email" maxLength={240} autoComplete="email" />
        </label>
      </div>

      <label className="public-field">
        <span>反馈类型 / Type</span>
        <select value={form.type} onChange={(event) => update("type", event.target.value)} name="type">
          {FEEDBACK_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
        </select>
      </label>

      <label className="public-field">
        <span>反馈内容 / Feedback *</span>
        <textarea value={form.message} onChange={(event) => update("message", event.target.value)} name="message" required maxLength={3000} rows={8} placeholder="哪一步让你卡住了？什么会让找房或发布更容易？ / What got in your way?" />
      </label>

      <div className="public-honeypot" aria-hidden="true">
        <label>Website<input value={form.website} onChange={(event) => update("website", event.target.value)} name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <p className="public-form-safety">我们会把反馈发送给安居运营邮箱，仅用于改进产品和回复你。 / Feedback goes to the Anjurentals operations inbox for product improvement and replies.</p>

      {status === "success" && <p className="public-form-status success" role="status">谢谢你的反馈。 / Thanks for helping us improve.</p>}
      {status === "error" && <p className="public-form-status error" role="alert">{error}</p>}

      <button className="primary-button public-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "发送中… / Sending…" : "提交反馈 / Send feedback"}
      </button>
    </form>
  );
}

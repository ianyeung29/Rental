"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "sending" | "success" | "error";

const TOPICS = [
  { value: "renter", label: "租客帮助 · Renter help" },
  { value: "owner-agent", label: "房东 / 经纪帮助 · Owner or agent help" },
  { value: "safety-privacy", label: "安全、隐私或房源问题 · Safety, privacy, or listing" },
  { value: "partnership", label: "合作建议 · Partnership" },
  { value: "general", label: "其他问题 · General question" },
];

export default function ContactForm() {
  const [status, setStatus] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", topic: "renter", message: "" });

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
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "暂时无法发送，请稍后重试。 / Please try again later.");
      setStatus("success");
      setForm({ name: "", email: "", topic: "renter", message: "" });
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "暂时无法发送，请稍后重试。 / Please try again later.");
    }
  };

  return (
    <form className="public-form" onSubmit={submit}>
      <div className="public-form-heading">
        <div>
          <span className="section-label">CONTACT DESK</span>
          <h2>给我们留言</h2>
        </div>
        <span className="public-form-required">带 * 为必填</span>
      </div>

      <div className="public-field-grid">
        <label className="public-field">
          <span>姓名 / Name *</span>
          <input value={form.name} onChange={(event) => update("name", event.target.value)} name="name" required maxLength={80} autoComplete="name" />
        </label>
        <label className="public-field">
          <span>邮箱 / Email *</span>
          <input value={form.email} onChange={(event) => update("email", event.target.value)} name="email" type="email" required maxLength={240} autoComplete="email" />
        </label>
      </div>

      <label className="public-field">
        <span>问题类型 / Topic</span>
        <select value={form.topic} onChange={(event) => update("topic", event.target.value)} name="topic">
          {TOPICS.map((topic) => <option value={topic.value} key={topic.value}>{topic.label}</option>)}
        </select>
      </label>

      <label className="public-field">
        <span>留言内容 / Message *</span>
        <textarea value={form.message} onChange={(event) => update("message", event.target.value)} name="message" required maxLength={3000} rows={7} placeholder="请告诉我们你遇到的情况，或想要改进的地方。 / Tell us what happened or what you would improve." />
      </label>

      <p className="public-form-safety">请不要填写密码、社会安全号码、银行卡信息或房屋精确地址。 / Please do not include passwords, SSNs, payment details, or an exact home address.</p>

      {status === "success" && <p className="public-form-status success" role="status">已收到，我们会通过邮箱回复你。 / Received — we will reply by email.</p>}
      {status === "error" && <p className="public-form-status error" role="alert">{error}</p>}

      <button className="primary-button public-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "发送中… / Sending…" : "发送留言 / Send message"}
      </button>
    </form>
  );
}

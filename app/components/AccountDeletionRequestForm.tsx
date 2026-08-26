"use client";

import { useState, type FormEvent } from "react";

export default function AccountDeletionRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/account-deletion/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: String(formData.get("website") || "") }),
      });
      const result = await response.json().catch(() => ({})) as { accepted?: boolean; error?: string };
      if (!response.ok || !result.accepted) throw new Error(result.error || "The deletion email could not be sent right now.");
      setStatus("sent");
      setMessage("如果该邮箱对应安居账户，我们已发送确认邮件。请在一小时内打开邮件中的链接完成删除。 / If this email belongs to an Anjurentals account, we sent a confirmation email. Open its link within one hour to finish.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The deletion email could not be sent right now.");
    }
  }

  return (
    <form className="account-deletion-form public-form" onSubmit={submit} noValidate>
      <label className="public-field" htmlFor="deletion-email">
        <span>注册邮箱 / Account email</span>
        <input id="deletion-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required disabled={status === "sending"} />
      </label>
      <label className="public-honeypot" aria-hidden="true">
        <span>Website</span>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className="public-form-safety">我们不会显示该邮箱是否有账户。确认邮件只会发送到该账户的登录邮箱。</p>
      <button className="primary-button public-submit" type="submit" disabled={status === "sending"}>{status === "sending" ? "发送中… / Sending…" : "发送删除确认邮件 / Send confirmation"}</button>
      {message && <p className={`public-form-status ${status === "sent" ? "success" : "error"}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
    </form>
  );
}

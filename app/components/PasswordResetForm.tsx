"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function PasswordResetForm({ token = "" }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const resetMode = Boolean(token);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      if (!resetMode) {
        const response = await fetch("/api/auth/request-password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Password reset is unavailable right now.");
      } else {
        if (password !== confirmation) throw new Error("The passwords do not match.");
        const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Password reset is unavailable right now.");
      }
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password reset is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="public-page reset-page"><div className="public-page-inner"><Link className="public-back-link" href="/">← 安居 / Anjurentals</Link><section className="reset-panel"><span className="section-label">ACCOUNT ACCESS</span><h1>{resetMode ? "Choose a new password" : "Reset your password"}</h1><p>{resetMode ? "Create a new password for your Anjurentals account. / 为安居账户设置新密码。" : "Enter your account email and we will send a one-hour reset link if the account exists. / 输入账户邮箱；如果账户存在，我们会发送一小时有效的重置链接。"}</p>{success ? <div className="reset-success" role="status"><strong>{resetMode ? "Password updated" : "Check your email"}</strong><span>{resetMode ? "Your password has been changed. You can sign in again." : "If an account matches that email, the reset instructions are on their way."}</span><Link className="primary-button" href="/">Return to Anjurentals</Link></div> : <form className="reset-form" onSubmit={submit}>{resetMode ? <><label className="field-label" htmlFor="reset-password">New password<input id="reset-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label><label className="field-label" htmlFor="reset-confirmation">Confirm password<input id="reset-confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repeat your password" /></label></> : <label className="field-label" htmlFor="reset-email">Account email<input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={loading}>{loading ? "Working…" : (resetMode ? "Update password" : "Send reset link")}</button></form>}<p className="reset-footnote"><Link href="/">Return to the marketplace</Link></p></section></div></main>;
}

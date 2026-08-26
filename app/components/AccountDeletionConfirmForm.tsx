"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function AccountDeletionConfirmForm({ token }: { token: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "deleting" | "deleted" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    setStatus("deleting");
    setMessage("");
    try {
      const response = await fetch("/api/account-deletion/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json().catch(() => ({})) as { deleted?: boolean; error?: string };
      if (!response.ok || !result.deleted) throw new Error(result.error || "Your account could not be deleted right now.");
      setStatus("deleted");
      setMessage("你的账户、公开房源、私密资料、会话、保存内容和通知订阅已删除。少量安全或法律保留记录可能在适用期限内保留。 / Your account, public listings, private profile, sessions, saved content, and notifications have been deleted. Limited security or legal records may remain for the applicable retention period.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Your account could not be deleted right now.");
    }
  }

  if (status === "deleted") return <div className="account-deletion-result" role="status"><strong>账户已删除 / Account deleted</strong><p>{message}</p><Link className="outline-button" href="/">返回安居首页 / Return home</Link></div>;

  return (
    <form className="account-deletion-form public-form" onSubmit={submit}>
      <label className="account-deletion-check">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>我明白此操作不可撤销，并会删除我的安居账户、房源、资料、收藏、申请和通知订阅。 / I understand that this permanently deletes my Anjurentals account, listings, profile, saved items, applications, and notification subscriptions.</span>
      </label>
      <button className="danger-button public-submit" type="submit" disabled={!confirmed || status === "deleting"}>{status === "deleting" ? "正在删除… / Deleting…" : "永久删除账户 / Permanently delete account"}</button>
      {message && <p className="public-form-status error" role="alert">{message}</p>}
    </form>
  );
}

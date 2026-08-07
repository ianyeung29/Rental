"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/monitoring/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "react-global",
        route: typeof window === "undefined" ? "" : window.location.pathname,
        message: error.message,
        errorName: error.name,
        stack: error.stack,
        digest: error.digest,
      }),
    }).catch(() => undefined);
  }, [error]);

  return <html lang="zh-CN"><body style={{ margin: 0, background: "#f6f4ef", color: "#142a44", fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif" }}><main style={{ maxWidth: 620, margin: "0 auto", padding: "15vh 24px" }}><p style={{ color: "#617080", fontSize: 12, fontWeight: 700, letterSpacing: ".14em" }}>ANJURENTALS · 安居</p><h1 style={{ fontSize: 34, lineHeight: 1.1 }}>页面暂时无法显示</h1><p style={{ color: "#617080", lineHeight: 1.7 }}>发生了一个技术问题。请重试；如果问题持续，管理员会在监控台看到这次错误。</p><button style={{ minHeight: 44, padding: "0 14px", border: 0, color: "#fff", background: "#2768f0", fontWeight: 700 }} type="button" onClick={() => reset()}>重试 / Try again</button></main></body></html>;
}

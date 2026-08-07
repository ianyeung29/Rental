"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/monitoring/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "react-route",
        route: window.location.pathname,
        message: error.message,
        errorName: error.name,
        stack: error.stack,
        digest: error.digest,
      }),
    }).catch(() => undefined);
  }, [error]);

  return <main className="status-panel status-panel-error" role="alert"><div className="status-panel-icon" aria-hidden="true">!</div><h1>页面暂时无法显示</h1><p>发生了一个技术问题。请重试；如果问题持续，管理员会在监控台看到这次错误。</p><button className="primary-button" type="button" onClick={() => reset()}>重试 / Try again</button></main>;
}

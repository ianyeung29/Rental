import type { ReactNode } from "react";

type StatusPanelProps = {
  kind?: "empty" | "error" | "success";
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
};

export default function StatusPanel({ kind = "empty", icon, title, body, action }: StatusPanelProps) {
  return (
    <div className={`status-panel status-panel-${kind}`} role={kind === "error" ? "alert" : undefined}>
      <div className="status-panel-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

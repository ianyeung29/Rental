"use client";

import type { ReactNode } from "react";

type MobileNavItem = "find" | "saved" | "post" | "messages";

type MobileBottomNavProps = {
  locale: "zh" | "en";
  activeItem?: MobileNavItem;
  savedCount?: number;
  messageCount?: number;
  hidden?: boolean;
  icons: {
    find: ReactNode;
    saved: ReactNode;
    post: ReactNode;
    messages: ReactNode;
  };
  onFind: () => void;
  onSaved: () => void;
  onPost: () => void;
  onMessages: () => void;
};

export default function MobileBottomNav({ locale, activeItem = "find", savedCount = 0, messageCount = 0, hidden = false, icons, onFind, onSaved, onPost, onMessages }: MobileBottomNavProps) {
  const labels = locale === "zh"
    ? { find: "找房", saved: "收藏", post: "发布", messages: "消息" }
    : { find: "Find", saved: "Saved", post: "Post", messages: "Messages" };

  const items: Array<{ id: MobileNavItem; label: string; count?: number; icon: ReactNode; onClick: () => void }> = [
    { id: "find", label: labels.find, icon: icons.find, onClick: onFind },
    { id: "saved", label: labels.saved, count: savedCount, icon: icons.saved, onClick: onSaved },
    { id: "post", label: labels.post, icon: icons.post, onClick: onPost },
    { id: "messages", label: labels.messages, count: messageCount, icon: icons.messages, onClick: onMessages },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label={locale === "zh" ? "安居主要导航" : "Anjurentals navigation"} hidden={hidden}>
      {items.map((item) => (
        <button className={`mobile-bottom-nav-item ${item.id === activeItem ? "is-active" : ""} ${item.id === "post" ? "is-post" : ""}`} type="button" key={item.id} onClick={item.onClick} aria-current={item.id === activeItem ? "page" : undefined}>
          <span className="mobile-bottom-nav-icon" aria-hidden="true">{item.icon}</span>
          <span className="mobile-bottom-nav-label">{item.label}</span>
          {item.count ? <span className="mobile-bottom-nav-badge" aria-label={`${item.count}`}>{item.count > 9 ? "9+" : item.count}</span> : null}
        </button>
      ))}
    </nav>
  );
}

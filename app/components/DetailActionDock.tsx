import type { ReactNode } from "react";

type DetailActionDockProps = {
  contactLabel: string;
  compareLabel: string;
  shareLabel: string;
  comparing: boolean;
  icons: {
    chat: (options?: { size?: number }) => ReactNode;
    compare: (options?: { size?: number }) => ReactNode;
    share: (options?: { size?: number }) => ReactNode;
  };
  onContact: () => void;
  onCompare: () => void;
  onShare: () => void;
};

export default function DetailActionDock({ contactLabel, compareLabel, shareLabel, comparing, icons, onContact, onCompare, onShare }: DetailActionDockProps) {
  return (
    <div className="detail-action-dock">
      <div className="detail-action-row">
        <button className="primary-button full-button detail-contact-button" type="button" onClick={onContact}>{icons.chat({ size: 17 })}{contactLabel}</button>
        <button className={`outline-button full-button detail-compare-button ${comparing ? "is-active" : ""}`} type="button" onClick={onCompare} aria-pressed={comparing}>{icons.compare({ size: 16 })}{comparing ? `${compareLabel} ✓` : compareLabel}</button>
        <button className="outline-button full-button detail-share-button" type="button" onClick={onShare}>{icons.share({ size: 16 })}{shareLabel}</button>
      </div>
    </div>
  );
}

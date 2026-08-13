"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type DetailActionDockProps = {
  contactLabel: string;
  applyLabel: string;
  compareLabel: string;
  shareLabel: string;
  saveLabel: string;
  removeSavedLabel: string;
  moreLabel: string;
  moreActionsLabel: string;
  saved: boolean;
  comparing: boolean;
  icons: {
    chat: (options?: { size?: number }) => ReactNode;
    compare: (options?: { size?: number }) => ReactNode;
    share: (options?: { size?: number }) => ReactNode;
    heart: (options?: { size?: number; filled?: boolean }) => ReactNode;
  };
  onContact: () => void;
  onApply: () => void;
  onCompare: () => void;
  onShare: () => void;
  onSave: () => void;
};

function MoreIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>;
}

export default function DetailActionDock({ contactLabel, applyLabel, compareLabel, shareLabel, saveLabel, removeSavedLabel, moreLabel, moreActionsLabel, saved, comparing, icons, onContact, onApply, onCompare, onShare, onSave }: DetailActionDockProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="detail-action-dock">
      <div className="detail-action-row detail-desktop-actions">
        <button className="primary-button full-button detail-contact-button" type="button" onClick={onContact}>{icons.chat({ size: 17 })}{contactLabel}</button>
        <button className={`outline-button full-button detail-compare-button ${comparing ? "is-active" : ""}`} type="button" onClick={onCompare} aria-pressed={comparing}>{icons.compare({ size: 16 })}{comparing ? `${compareLabel} ✓` : compareLabel}</button>
        <button className="outline-button full-button detail-share-button" type="button" onClick={onShare}>{icons.share({ size: 16 })}{shareLabel}</button>
      </div>
      <div className="detail-action-row detail-mobile-actions">
        <button className="primary-button full-button detail-contact-button" type="button" onClick={onContact}>{icons.chat({ size: 17 })}{contactLabel}</button>
        <button className={`outline-button full-button detail-save-button ${saved ? "is-active" : ""}`} type="button" onClick={onSave} aria-pressed={saved}>{icons.heart({ size: 16, filled: saved })}{saved ? removeSavedLabel : saveLabel}</button>
        <button className="outline-button full-button detail-more-button" type="button" onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen} aria-haspopup="menu"><MoreIcon />{moreLabel}</button>
        {moreOpen && <div className="detail-more-menu" role="menu" aria-label={moreActionsLabel}>
          <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onCompare(); }}>{icons.compare({ size: 15 })}{comparing ? `${compareLabel} ✓` : compareLabel}</button>
          <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onShare(); }}>{icons.share({ size: 15 })}{shareLabel}</button>
          <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onApply(); }}>{applyLabel}</button>
        </div>}
      </div>
      <button className="outline-button full-button detail-apply-button detail-desktop-apply" type="button" onClick={onApply}>{applyLabel}</button>
    </div>
  );
}

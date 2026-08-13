"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { useDialogA11y } from "../lib/use-dialog-a11y";

type ListingGalleryProps = {
  title: string;
  photos: string[];
  selectedIndex: number;
  approximateLabel: string;
  photoLabel: string;
  previousLabel: string;
  nextLabel: string;
  closeLabel: string;
  expandLabel: string;
  lockIcon: (options?: { size?: number }) => ReactNode;
  closeIcon: (options?: { size?: number }) => ReactNode;
  onSelect: (index: number) => void;
  onClose: () => void;
};

function GalleryArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "m14.5 5-7 7 7 7" : "m9.5 5 7 7-7 7"} />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
      <path d="m3 8 5-5M16 3l5 5M21 16l-5 5M8 21l-5-5" />
    </svg>
  );
}

export default function ListingGallery({
  title,
  photos,
  selectedIndex,
  approximateLabel,
  photoLabel,
  previousLabel,
  nextLabel,
  closeLabel,
  expandLabel,
  lockIcon,
  closeIcon,
  onSelect,
  onClose,
}: ListingGalleryProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const fullscreenRef = useDialogA11y<HTMLDivElement>(fullscreen, () => setFullscreen(false));
  const selectedPhoto = photos[selectedIndex] || photos[0] || "";

  const move = (direction: -1 | 1) => {
    if (photos.length < 2) return;
    onSelect((selectedIndex + direction + photos.length) % photos.length);
  };

  useEffect(() => {
    if (!fullscreen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleSwipe = (event: TouchEvent<HTMLDivElement>, startX: number) => {
    const delta = event.changedTouches[0]?.clientX - startX;
    if (Math.abs(delta) > 45) move(delta > 0 ? -1 : 1);
  };

  const gallery = (large: boolean) => (
    <div className={`gallery-stage ${large ? "gallery-stage-fullscreen" : ""}`}>
      {selectedPhoto ? <Image key={selectedPhoto} className="gallery-photo" src={selectedPhoto} alt={title} fill sizes={large ? "100vw" : "620px"} priority={!large} /> : <div className="image-fallback" aria-hidden="true" />}
      {photos.length > 1 && <>
        <button className="gallery-control gallery-prev" type="button" onClick={() => move(-1)} aria-label={previousLabel}><GalleryArrowIcon direction="left" /></button>
        <button className="gallery-control gallery-next" type="button" onClick={() => move(1)} aria-label={nextLabel}><GalleryArrowIcon direction="right" /></button>
        <span className="gallery-count">{selectedIndex + 1} / {photos.length}</span>
      </>}
      {!large && <button className="gallery-expand" type="button" onClick={() => setFullscreen(true)} aria-label={expandLabel}><ExpandIcon /><span>{expandLabel}</span></button>}
      {!large && <span className="drawer-image-note">{lockIcon({ size: 13 })}{approximateLabel}</span>}
      {large && <button className="drawer-close image-close" type="button" onClick={() => setFullscreen(false)} aria-label={closeLabel}>{closeIcon({ size: 18 })}</button>}
    </div>
  );

  return (
    <>
      <div className="drawer-image-wrap" onTouchStart={(event) => { event.currentTarget.dataset.touchStartX = String(event.touches[0]?.clientX || 0); }} onTouchEnd={(event) => handleSwipe(event, Number(event.currentTarget.dataset.touchStartX || 0))}>
        {gallery(false)}
        <button className="drawer-close image-close" type="button" onClick={onClose} aria-label={closeLabel}>{closeIcon({ size: 18 })}</button>
      </div>
      {photos.length > 1 && <>
        <button className="gallery-thumbnails-toggle" type="button" onClick={() => setThumbnailsOpen((current) => !current)} aria-expanded={thumbnailsOpen} aria-controls="listing-gallery-thumbnails">{photoLabel}<span>{selectedIndex + 1} / {photos.length}</span><span aria-hidden="true">{thumbnailsOpen ? "−" : "+"}</span></button>
        <div className={`gallery-thumbnails ${thumbnailsOpen ? "is-open" : ""}`} id="listing-gallery-thumbnails" aria-label={photoLabel}>{photos.map((photo, index) => <button className={`gallery-thumbnail ${index === selectedIndex ? "active" : ""}`} type="button" key={`${photo}-${index}`} onClick={() => { onSelect(index); setThumbnailsOpen(false); }} aria-label={`${photoLabel} ${index + 1}`} aria-pressed={index === selectedIndex}><Image src={photo} alt="" fill sizes="86px" loading="lazy" /></button>)}</div>
      </>}
      {fullscreen && <div ref={fullscreenRef} className="gallery-fullscreen" role="dialog" aria-modal="true" aria-label={photoLabel} tabIndex={-1} onMouseDown={(event) => { if (event.target === event.currentTarget) setFullscreen(false); }}>
        {gallery(true)}
      </div>}
    </>
  );
}

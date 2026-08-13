"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";

export type ListingCardListing = {
  id: string;
  titleZh: string;
  titleEn: string;
  areaZh: string;
  areaEn: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet?: number | null;
  lease: string;
  price: number;
  image: string;
  photos?: string[];
  source?: "sample" | "local" | "remote" | "demo";
  posterVerified?: boolean;
};

type IconRenderer = (options?: { size?: number; filled?: boolean }) => ReactNode;

export type ListingCardLabels = {
  bed: string;
  bath: string;
  squareFeet: string;
  moveIn: string;
  lease: string;
  locationChecked: string;
  availability: string;
  verifiedEmail: string;
  photoCount: string;
  approximate: string;
  view: string;
  share: string;
  compare: string;
  comparing: string;
  contact: string;
  more: string;
  moreActions: string;
  save: string;
  removeSaved: string;
  listingBasics: string;
};

type ListingCardProps = {
  listing: ListingCardListing;
  featured?: boolean;
  locale: "zh" | "en";
  saved: boolean;
  comparing: boolean;
  labels: ListingCardLabels;
  title: string;
  area: string;
  type: string;
  freshness: string;
  poster: string;
  privacy: string;
  moveInValue: string;
  leaseValue: string;
  price: string;
  tags: string[];
  photos: string[];
  thumbnailPhotos?: string[];
  icons: {
    pin: IconRenderer;
    gallery: IconRenderer;
    heart: IconRenderer;
    share: IconRenderer;
    check: IconRenderer;
    chat: IconRenderer;
    lock: IconRenderer;
    arrow: IconRenderer;
  };
  onOpen: () => void;
  onSave: () => void;
  onShare: () => void;
  onCompare: () => void;
  onContact: () => void;
};

function CardGalleryArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "m14.5 5-7 7 7 7" : "m9.5 5 7 7-7 7"} />
    </svg>
  );
}

export default function ListingCard({
  listing,
  featured = false,
  locale,
  saved,
  comparing,
  labels,
  title,
  area,
  type,
  freshness,
  poster,
  privacy,
  moveInValue,
  leaseValue,
  price,
  tags,
  photos,
  thumbnailPhotos,
  icons,
  onOpen,
  onSave,
  onShare,
  onCompare,
  onContact,
}: ListingCardProps) {
  const photoCount = photos.length;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const ignoreNextClick = useRef(false);
  const safePhotoIndex = photoCount > 0 ? Math.min(photoIndex, photoCount - 1) : 0;
  const currentPhoto = thumbnailPhotos?.[safePhotoIndex] || thumbnailPhotos?.[0] || photos[safePhotoIndex] || photos[0] || listing.image;

  const movePhoto = (direction: -1 | 1) => {
    if (photoCount < 2) return;
    setPhotoIndex((current) => (current + direction + photoCount) % photoCount);
  };

  const handleImageTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleImageTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null || photoCount < 2) return;
    const delta = (event.changedTouches[0]?.clientX ?? startX) - startX;
    if (Math.abs(delta) <= 45) return;
    ignoreNextClick.current = true;
    movePhoto(delta > 0 ? -1 : 1);
  };

  const openFromImage = () => {
    if (ignoreNextClick.current) {
      ignoreNextClick.current = false;
      return;
    }
    onOpen();
  };

  return (
    <article className={`listing-card ${featured ? "listing-card-featured" : ""}`}>
      <div
        className="listing-image-wrap listing-image-browse"
        onTouchStart={handleImageTouchStart}
        onTouchEnd={handleImageTouchEnd}
      >
        <Image
          src={currentPhoto}
          alt={locale === "zh" ? `${title} 房源照片` : `${title} listing photo`}
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 1080px) 40vw, 31vw"
          priority={featured}
          loading={featured ? "eager" : "lazy"}
        />
        <button className="listing-image-open" type="button" onClick={openFromImage} aria-label={locale === "zh" ? `查看${title}的房源照片` : `Browse photos for ${title}`} />
        <span className="image-label"><span className="image-label-dot" aria-hidden="true" />{freshness}</span>
        {photoCount > 1 && <span className="image-photo-count"><span aria-hidden="true">{icons.gallery({ size: 13 })}</span>{photoCount} {labels.photoCount}</span>}
        {photoCount > 1 && <>
          <button className="listing-gallery-control listing-gallery-prev" type="button" onClick={(event) => { event.stopPropagation(); movePhoto(-1); }} aria-label={locale === "zh" ? "上一张房源照片" : "Previous listing photo"}><CardGalleryArrowIcon direction="left" /></button>
          <button className="listing-gallery-control listing-gallery-next" type="button" onClick={(event) => { event.stopPropagation(); movePhoto(1); }} aria-label={locale === "zh" ? "下一张房源照片" : "Next listing photo"}><CardGalleryArrowIcon direction="right" /></button>
          <span className="listing-gallery-count" aria-live="polite">{safePhotoIndex + 1} / {photoCount}</span>
        </>}
        <button className={`save-button ${saved ? "is-saved" : ""}`} type="button" onClick={(event) => { event.stopPropagation(); onSave(); }} aria-label={saved ? labels.removeSaved : labels.save} aria-pressed={saved}>
          {icons.heart({ filled: saved })}
        </button>
      </div>

      <div className="listing-body">
        <div className="listing-topline">
          <span className="listing-type">{type}</span>
          <span className="listing-source">{poster}</span>
        </div>
        <h3>{title}</h3>
        <p className="listing-area"><span aria-hidden="true">{icons.pin({ size: 15 })}</span>{area}</p>
        <div className="price-line">
          <strong>{price}</strong>
          <span>{locale === "zh" ? "月" : "/ month"}</span>
          <span className="cost-badge"><span aria-hidden="true">{icons.check({ size: 11 })}</span>{locale === "zh" ? "费用明细" : "Clear costs"}</span>
        </div>
        <div className="listing-facts" aria-label={labels.listingBasics}>
          <span><b>{listing.bedrooms}</b> {labels.bed}</span>
          <span><b>{listing.bathrooms}</b> {labels.bath}</span>
          {typeof listing.squareFeet === "number" && Number.isFinite(listing.squareFeet) && listing.squareFeet > 0 && <span><b>{listing.squareFeet.toLocaleString("en-US")}</b> {labels.squareFeet}</span>}
          <span><b>{moveInValue}</b> {labels.moveIn}</span>
          <span><b>{leaseValue}</b> {labels.lease}</span>
        </div>
        <div className="tag-row listing-card-tags" aria-label={locale === "zh" ? "房源特点" : "Listing features"}>
          {tags.slice(0, 2).map((tag, index) => <span className={`listing-tag listing-tag-${index === 0 ? "primary" : "supporting"}`} key={tag}>{tag}</span>)}
          {tags.length > 2 && <span className="listing-tag listing-tag-more">+{tags.length - 2}</span>}
        </div>
        <div className="trust-row">
          <span><span className="trust-icon blue">{icons.pin({ size: 12 })}</span>{labels.locationChecked}</span>
          <span><span className="trust-icon lime">{icons.check({ size: 12 })}</span>{labels.availability}</span>
          {listing.posterVerified && <span><span className="trust-icon verified">{icons.check({ size: 12 })}</span>{labels.verifiedEmail}</span>}
          <span><span className="trust-icon photo">{icons.gallery({ size: 12 })}</span>{photoCount} {labels.photoCount}</span>
          <span className="privacy-signal">{icons.lock({ size: 12 })}{privacy || labels.approximate}</span>
        </div>
        <div className="listing-actions">
          <button className="link-button" type="button" onClick={onOpen}>{labels.view}{icons.arrow({ size: 15 })}</button>
          <div className="action-group">
            <div className="listing-secondary-actions">
              <button className="share-button" type="button" onClick={onShare}>{icons.share({ size: 14 })}{labels.share}</button>
              <button className={`compare-button ${comparing ? "active" : ""}`} type="button" onClick={onCompare} aria-pressed={comparing}>{comparing ? icons.check({ size: 13 }) : null}{comparing ? labels.comparing : labels.compare}</button>
            </div>
            <button className="contact-button" type="button" onClick={onContact}>{icons.chat({ size: 15 })}{labels.contact}</button>
            <button className="listing-more-button" type="button" onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen} aria-haspopup="menu">{labels.more}<span aria-hidden="true">+</span></button>
            {moreOpen && <div className="listing-more-menu" role="menu" aria-label={labels.moreActions}>
              <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onShare(); }}>{icons.share({ size: 14 })}{labels.share}</button>
              <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onCompare(); }}>{comparing ? icons.check({ size: 13 }) : null}{comparing ? labels.comparing : labels.compare}</button>
            </div>}
          </div>
        </div>
      </div>
    </article>
  );
}

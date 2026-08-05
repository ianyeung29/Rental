import Image from "next/image";
import type { ReactNode } from "react";

export type ListingCardListing = {
  id: string;
  titleZh: string;
  titleEn: string;
  areaZh: string;
  areaEn: string;
  bedrooms: string;
  bathrooms: string;
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
  price: string;
  tags: string[];
  photos: string[];
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
  price,
  tags,
  photos,
  icons,
  onOpen,
  onSave,
  onShare,
  onCompare,
  onContact,
}: ListingCardProps) {
  const photoCount = photos.length;

  return (
    <article className={`listing-card ${featured ? "listing-card-featured" : ""}`}>
      <div className="listing-image-wrap">
        <Image
          src={listing.image}
          alt={locale === "zh" ? `${title} 房源照片` : `${title} listing photo`}
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 1080px) 40vw, 31vw"
          priority={featured}
          loading={featured ? "eager" : "lazy"}
          unoptimized={listing.source !== "sample"}
        />
        <span className="image-label"><span className="image-label-dot" aria-hidden="true" />{freshness}</span>
        {photoCount > 1 && <span className="image-photo-count"><span aria-hidden="true">{icons.gallery({ size: 13 })}</span>{photoCount} {labels.photoCount}</span>}
        <button className={`save-button ${saved ? "is-saved" : ""}`} type="button" onClick={onSave} aria-label={saved ? labels.removeSaved : labels.save} aria-pressed={saved}>
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
          <span><b>{moveInValue}</b> {labels.moveIn}</span>
          <span><b>{listing.lease}</b> {labels.lease}</span>
        </div>
        <div className="tag-row listing-card-tags" aria-label={locale === "zh" ? "房源特点" : "Listing features"}>
          {tags.slice(0, 3).map((tag, index) => <span className={`listing-tag listing-tag-${index === 0 ? "primary" : "supporting"}`} key={tag}>{tag}</span>)}
          {tags.length > 3 && <span className="listing-tag listing-tag-more">+{tags.length - 3}</span>}
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
            <button className="share-button" type="button" onClick={onShare}>{icons.share({ size: 14 })}{labels.share}</button>
            <button className={`compare-button ${comparing ? "active" : ""}`} type="button" onClick={onCompare} aria-pressed={comparing}>{comparing ? icons.check({ size: 13 }) : null}{comparing ? labels.comparing : labels.compare}</button>
            <button className="contact-button" type="button" onClick={onContact}>{icons.chat({ size: 15 })}{labels.contact}</button>
          </div>
        </div>
      </div>
    </article>
  );
}

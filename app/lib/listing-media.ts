import { publicUrlForKey } from "./r2";
import { MAX_LISTING_PHOTOS } from "./listing-constants";

const IMAGE_CONTENT_TYPE = /^image\/(jpeg|png|webp)$/;

export type NormalizedListingMedia = {
  key: string;
  contentType: string;
  publicUrl: string;
  thumbnailKey?: string;
  thumbnailContentType?: string;
  thumbnailPublicUrl?: string;
  width?: number;
  height?: number;
  sortOrder: number;
};

function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dimension(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20_000 ? parsed : undefined;
}

function validKey(key: string, prefix: string) {
  return key.startsWith(prefix) && /^[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(key);
}

export function normalizeListingMedia(value: unknown): NormalizedListingMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as {
      key?: unknown;
      contentType?: unknown;
      thumbnailKey?: unknown;
      thumbnailContentType?: unknown;
      width?: unknown;
      height?: unknown;
    };
    const key = text(record.key);
    const contentType = text(record.contentType, 80);
    if (!validKey(key, "listings/") || !IMAGE_CONTENT_TYPE.test(contentType)) return [];
    const thumbnailKey = text(record.thumbnailKey);
    const thumbnailContentType = text(record.thumbnailContentType, 80);
    const hasThumbnail = Boolean(thumbnailKey && validKey(thumbnailKey, "listings/") && IMAGE_CONTENT_TYPE.test(thumbnailContentType));
    const width = dimension(record.width);
    const height = dimension(record.height);
    return [{
      key,
      contentType,
      publicUrl: publicUrlForKey(key),
      ...(hasThumbnail ? { thumbnailKey, thumbnailContentType, thumbnailPublicUrl: publicUrlForKey(thumbnailKey) } : {}),
      ...(width && height ? { width, height } : {}),
      sortOrder: index,
    }];
  }).slice(0, MAX_LISTING_PHOTOS);
}

export function listingMediaFromDatabase(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const key = text(record.key);
    const url = text(record.url, 1_000);
    if (!key || !url) return [];
    const thumbnailKey = text(record.thumbnailKey);
    const thumbnailUrl = text(record.thumbnailUrl, 1_000);
    const contentType = text(record.contentType, 80) || "image/jpeg";
    const thumbnailContentType = text(record.thumbnailContentType, 80);
    const width = dimension(record.width);
    const height = dimension(record.height);
    return [{
      key,
      url,
      contentType,
      ...(thumbnailKey && thumbnailUrl ? { thumbnailKey, thumbnailUrl, ...(thumbnailContentType ? { thumbnailContentType } : {}) } : {}),
      ...(width && height ? { width, height } : {}),
    }];
  }).slice(0, MAX_LISTING_PHOTOS);
}

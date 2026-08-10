"use client";

import { ChangeEvent, FormEvent, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import AccountDrawer from "./components/AccountDrawer";
import ApplicationDrawer, { type ApplicationFormValues } from "./components/ApplicationDrawer";
import AreaContextPanel from "./components/AreaContextPanel";
import AuthDrawer from "./components/AuthDrawer";
import CommuteEstimator from "./components/CommuteEstimator";
import DetailActionDock from "./components/DetailActionDock";
import ListingCard from "./components/ListingCard";
import ListingGallery from "./components/ListingGallery";
import ListingAnalyticsPanel from "./components/ListingAnalyticsPanel";
import NotificationCenter from "./components/NotificationCenter";
import NativeMediaActions from "./components/NativeMediaActions";
import ReportDrawer from "./components/ReportDrawer";
import SafetyNotice from "./components/SafetyNotice";
import SiteFooter from "./components/SiteFooter";
import StatusPanel from "./components/StatusPanel";
import { AccountType, AgentVerificationStatus } from "./lib/account-types";
import { demoModeEnabled } from "./lib/demo";
import { toChineseLocationLabel } from "./lib/location-labels";
import { configureWeChatShare, isWeChatBrowser, toAbsoluteUrl } from "./lib/wechat-client";
import { buildLocalCompareSummary, CompareListingFacts, CompareSummaryContent } from "./lib/compare-summary";
import { DEFAULT_LOCATION_LOOKUP_OPTIONS, LOCATION_LOOKUP_OPTIONS, MAX_LOCATION_LOOKUP_OPTIONS } from "./lib/location-context";
import type { LocationContext, LocationContextTransit, LocationContextTransitLine, LocationLookupOption } from "./lib/location-context";
import { OCCUPANT_OPTIONS } from "./lib/renter-options";
import { TOUR_REQUEST_WINDOWS } from "./lib/inquiry-options";
import { reviewListingSafety } from "./lib/safety";
import { compareListingsForSearch, type SearchRankingListing, type SearchRankingSnapshot } from "./lib/search-ranking";
import { analyzeListingQuality, type ListingQualityTarget } from "./lib/listing-quality";
import { useDialogA11y } from "./lib/use-dialog-a11y";
import { optimizeImageFile } from "./lib/image-optimizer";
import portraitStyles from "./components/AgentPortrait.module.css";

type Locale = "zh" | "en";
type RentalType = "all" | "entire" | "privateRoom" | "sublet";
type SortMode = "fit" | "price" | "fresh" | "moveIn" | "verified" | "popular";
type WeChatShareStatus = "idle" | "outside" | "loading" | "ready" | "error";
type WeChatShareResolution = { key: string; status: Exclude<WeChatShareStatus, "idle" | "outside">; error: "" | "not-configured" | "unavailable" };
type CompareSummary = CompareSummaryContent & { key: string; locale: Locale; source: "openai" | "local" };

type ListingMedia = {
  key: string;
  url: string;
  contentType: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  thumbnailContentType?: string;
  width?: number;
  height?: number;
  fingerprint?: string;
};

const MOBILE_VIEWPORT_QUERY = "(max-width: 600px)";

function subscribeToMobileViewport(callback: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

function getMobileViewportServerSnapshot() {
  return false;
}

type Listing = {
  id: string;
  titleZh: string;
  titleEn: string;
  areaZh: string;
  areaEn: string;
  type: Exclude<RentalType, "all">;
  typeZh: string;
  typeEn: string;
  price: number;
  currency: "USD";
  bedrooms: string;
  bathrooms: string;
  squareFeet?: number | null;
  moveIn: string;
  lease: string;
  image: string;
  features: string[];
  tagsZh: string[];
  tagsEn: string[];
  freshnessZh: string;
  freshnessEn: string;
  posterZh: string;
  posterEn: string;
  posterVerified?: boolean;
  posterVerificationScope?: "email" | "agent_license" | "sample" | "none";
  privacyZh: string;
  privacyEn: string;
  source?: "sample" | "local" | "remote" | "demo";
  posterRole?: "owner" | "agent";
  descriptionZh?: string;
  descriptionEn?: string;
  privateAddress?: string;
  photos?: string[];
  photoThumbnails?: string[];
  photoKeys?: string[];
  media?: ListingMedia[];
  moderationStatus?: "approved" | "under_review" | "hidden" | "rejected";
  moderationNote?: string;
  expiresOn?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  popularityScore?: number;
};

type SearchSnapshot = {
  location: string;
  minPrice: string;
  maxPrice: string;
  minSqft: string;
  maxSqft: string;
  bedrooms: string;
  bathrooms: string;
  rentalType: RentalType;
  moveIn: string;
  activeFeatures: string[];
  sortMode: SortMode;
};

type Inquiry = {
  id: string;
  listingId: string;
  listingTitle: string;
  sentAt: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  tourPreference: string;
  tourRequestedDate?: string | null;
  tourRequestedWindow?: string;
  tourScheduledAt?: string | null;
  tourTimeZone?: string;
  tourNote?: string;
  addressRevealStatus?: "hidden" | "revealed";
  addressRevealedAt?: string | null;
  revealedAddress?: string;
  message: string;
  status: string;
  readAt?: string | null;
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  role: string;
  accountType: AccountType;
  agentVerificationStatus: AgentVerificationStatus;
  agentVerified: boolean;
  emailVerified: boolean;
};

type AgentService = "selfManaged" | "agentMatch";
type AgentFeePlan = "agentQuote" | "firstMonthRent" | "flatFee";

type AgentProfile = {
  id: string;
  displayNameZh: string;
  displayNameEn: string;
  portraitUrl: string;
  brokerage: string;
  licenseState: string;
  serviceAreas: string[];
  languages: string[];
  feeSummaryZh: string;
  feeSummaryEn: string;
  isVerified: boolean;
  isSample: boolean;
};

type BlockedPublisher = {
  id: string;
  displayName: string;
  accountType: string;
  blockedAt: string;
};

type AgentRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

type AgentRequest = {
  id: string;
  listingId: string;
  listingTitleZh: string;
  listingTitleEn: string;
  listingAreaZh: string;
  listingAreaEn: string;
  ownerName: string;
  ownerEmail: string;
  agentProfileId: string | null;
  agentProfileNameZh: string | null;
  agentProfileNameEn: string | null;
  feePlan: AgentFeePlan;
  feeAmount: number | null;
  status: AgentRequestStatus;
  ownerNote: string;
  agentNote: string;
  createdAt: string;
  updatedAt: string;
};

type DashboardListing = Listing & {
  privateAddress: string;
  contactName: string;
  contactEmail: string;
  tourPreference: string;
  agentService: AgentService;
  agentFeePlan: AgentFeePlan;
  agentFeeAmount: number | null;
  agentProfileId: string | null;
  agentProfileNameZh: string | null;
  agentProfileNameEn: string | null;
  agentRequestId: string | null;
  agentRequestStatus: AgentRequestStatus | null;
  agentRequestNote: string;
  status: string;
  expiresOn: string | null;
  publishedAt: string | null;
  availabilityConfirmedAt?: string | null;
  createdAt: string;
};

type DashboardInquiry = Inquiry & {
  requesterName?: string;
  requesterEmail?: string;
};

type ApplicationStatus = "submitted" | "reviewing" | "approved" | "declined" | "withdrawn";

type DashboardApplication = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingTitleEn?: string;
  listingArea: string;
  listingAreaEn?: string;
  currentCity?: string;
  preferredName: string;
  phone: string;
  moveIn: string;
  leaseLength: string;
  occupants: string;
  pets: string;
  employmentStatus: string;
  incomeRange: string;
  message: string;
  status: ApplicationStatus;
  ownerNote: string;
  requesterNote: string;
  submittedAt: string;
  updatedAt: string;
  ownerReadAt?: string;
  requesterReadAt?: string;
  unread?: boolean;
  events?: Array<{ id: string; status: ApplicationStatus; note: string; actorRole: "renter" | "owner"; createdAt: string }>;
  applicantName?: string;
  applicantEmail?: string;
  ownerName?: string;
  ownerEmail?: string;
};

type ListingDraft = {
  titleEn: string;
  titleZh: string;
  areaEn: string;
  areaZh: string;
  areaGroupId: string;
  areaLocationId: string;
  privateAddress: string;
  posterRole: "owner" | "agent";
  rentalType: Exclude<RentalType, "all">;
  price: string;
  currency: "USD";
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  moveInMode: "immediate" | "date";
  moveInDate: string;
  lease: string;
  features: string[];
  descriptionEn: string;
  descriptionZh: string;
  locationLookupOptions: LocationLookupOption[];
  photos: string[];
  photoThumbnails: string[];
  photoKeys: string[];
  media: ListingMedia[];
  contactName: string;
  contactEmail: string;
  tourPreference: string;
  agentService: AgentService;
  agentFeePlan: AgentFeePlan;
  agentFeeAmount: string;
  agentProfileId: string;
  expiresOn: string;
};

type PostStep = 1 | 2 | 3 | 4 | 5;
type DraftSaveState = "idle" | "saving" | "savedLocal" | "savedAccount" | "offline";

const EMPTY_DRAFT: ListingDraft = {
  titleEn: "",
  titleZh: "",
  areaEn: "",
  areaZh: "",
  areaGroupId: "",
  areaLocationId: "",
  privateAddress: "",
  posterRole: "owner",
  rentalType: "entire",
  price: "",
  currency: "USD",
  bedrooms: "1",
  bathrooms: "1",
  squareFeet: "",
  moveInMode: "immediate",
  moveInDate: "",
  lease: "12",
  features: [],
  descriptionEn: "",
  descriptionZh: "",
  locationLookupOptions: [...DEFAULT_LOCATION_LOOKUP_OPTIONS],
  photos: [],
  photoThumbnails: [],
  photoKeys: [],
  media: [],
  contactName: "",
  contactEmail: "",
  tourPreference: "flexible",
  agentService: "selfManaged",
  agentFeePlan: "agentQuote",
  agentFeeAmount: "",
  agentProfileId: "",
  expiresOn: "",
};

function draftHasContent(value: ListingDraft) {
  const photos = Array.isArray(value?.photos) ? value.photos : [];
  const media = Array.isArray(value?.media) ? value.media : [];
  const photoKeys = Array.isArray(value?.photoKeys) ? value.photoKeys : [];
  const features = Array.isArray(value?.features) ? value.features : [];
  return Boolean(
    value.titleEn || value.titleZh || value.areaEn || value.areaZh || value.privateAddress || value.price ||
      value.moveInDate || value.lease !== EMPTY_DRAFT.lease || value.squareFeet || value.descriptionEn || value.descriptionZh ||
      photos.length || media.length || photoKeys.length || value.contactName || value.contactEmail || value.agentProfileId || value.expiresOn ||
      features.length || value.agentService !== EMPTY_DRAFT.agentService || value.agentFeePlan !== EMPTY_DRAFT.agentFeePlan || value.agentFeeAmount,
  );
}

function normalizeClientMedia(value: unknown): ListingMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : "";
    const url = typeof record.url === "string" ? record.url : "";
    if (!key || !url) return [];
    const contentType = typeof record.contentType === "string" ? record.contentType : "image/jpeg";
    const thumbnailKey = typeof record.thumbnailKey === "string" ? record.thumbnailKey : "";
    const thumbnailUrl = typeof record.thumbnailUrl === "string" ? record.thumbnailUrl : "";
    const thumbnailContentType = typeof record.thumbnailContentType === "string" ? record.thumbnailContentType : "";
    const width = Number(record.width);
    const height = Number(record.height);
    const fingerprint = typeof record.fingerprint === "string" ? record.fingerprint : "";
    return [{
      key,
      url,
      contentType,
      ...(thumbnailKey && thumbnailUrl ? { thumbnailKey, thumbnailUrl, ...(thumbnailContentType ? { thumbnailContentType } : {}) } : {}),
      ...(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? { width, height } : {}),
      ...(fingerprint ? { fingerprint } : {}),
    }];
  }).slice(0, 4);
}

function mediaFromDraft(draft: ListingDraft): ListingMedia[] {
  if (draft.media.length > 0) return draft.media;
  return draft.photos.flatMap((url, index) => {
    const key = draft.photoKeys[index] || "";
    if (!url || !key) return [];
    return [{ key, url, contentType: "image/jpeg", ...(draft.photoThumbnails[index] ? { thumbnailUrl: draft.photoThumbnails[index] } : {}) }];
  });
}

function draftArraysFromMedia(media: ListingMedia[]) {
  return {
    media,
    photos: media.map((item) => item.url),
    photoThumbnails: media.map((item) => item.thumbnailUrl || item.url),
    photoKeys: media.map((item) => item.key),
  };
}

const STORAGE_KEYS = {
  locale: "rental-marketplace.locale",
  savedIds: "rental-marketplace.saved-ids",
  savedSearch: "rental-marketplace.saved-search",
  savedSearchSnapshot: "rental-marketplace.saved-search-snapshot",
  customListings: "rental-marketplace.custom-listings",
  inquiries: "rental-marketplace.inquiries",
  draft: "rental-marketplace.listing-draft",
  draftMeta: "rental-marketplace.listing-draft-meta",
  editingListingId: "rental-marketplace.editing-listing-id",
};

const POST_FEATURE_KEYS = [
  "furnished",
  "utilities",
  "parking",
  "pets",
  "laundry",
  "inUnitLaundry",
  "airConditioning",
  "dishwasher",
  "balcony",
  "elevator",
  "gym",
  "doorman",
  "storage",
  "naturalLight",
  "privateEntrance",
  "privateBathroom",
  "walkInCloset",
  "hardwoodFloors",
  "packageRoom",
  "roofDeck",
  "nearTransit",
  "shortTerm",
] as const;

type PopularArea = {
  id: string;
  zh: string;
  en: string;
  value: string;
};

type PopularAreaGroup = PopularArea & {
  locations: readonly PopularArea[];
};

// Keep this response-shaped so curated records can later be replaced by
// database-ranked boroughs and areas without changing the picker UI.
const POPULAR_AREA_GROUPS: readonly PopularAreaGroup[] = [
  {
    id: "manhattan",
    zh: "曼哈顿",
    en: "Manhattan",
    value: "Manhattan",
    locations: [
      { id: "midtown", zh: "中城", en: "Midtown", value: "Midtown" },
      { id: "lower-manhattan", zh: "下城 / 金融区", en: "Lower Manhattan", value: "Lower Manhattan" },
      { id: "upper-east-side", zh: "上东区", en: "Upper East Side", value: "Upper East Side" },
      { id: "upper-west-side", zh: "上西区", en: "Upper West Side", value: "Upper West Side" },
      { id: "chelsea", zh: "切尔西", en: "Chelsea", value: "Chelsea" },
      { id: "chinatown", zh: "唐人街 / 华埠", en: "Chinatown", value: "Chinatown" },
      { id: "two-bridges", zh: "双桥", en: "Two Bridges", value: "Two Bridges" },
      { id: "lower-east-side", zh: "下东区", en: "Lower East Side", value: "Lower East Side" },
      { id: "harlem", zh: "哈莱姆", en: "Harlem", value: "Harlem" },
    ],
  },
  {
    id: "brooklyn",
    zh: "布鲁克林",
    en: "Brooklyn",
    value: "Brooklyn",
    locations: [
      { id: "brooklyn-8th-avenue", zh: "八大道", en: "8th Avenue", value: "Brooklyn 8th Avenue" },
      { id: "sunset-park", zh: "日落公园", en: "Sunset Park", value: "Sunset Park" },
      { id: "bensonhurst", zh: "本森赫斯特", en: "Bensonhurst", value: "Bensonhurst" },
      { id: "homecrest", zh: "霍姆克雷斯特", en: "Homecrest", value: "Homecrest" },
      { id: "sheepshead-bay", zh: "羊头湾", en: "Sheepshead Bay", value: "Sheepshead Bay" },
      { id: "gravesend", zh: "格雷夫森德", en: "Gravesend", value: "Gravesend" },
      { id: "bath-beach", zh: "巴斯海滩", en: "Bath Beach", value: "Bath Beach" },
      { id: "bay-ridge", zh: "海湾岭", en: "Bay Ridge", value: "Bay Ridge" },
      { id: "dyker-heights", zh: "戴克高地", en: "Dyker Heights", value: "Dyker Heights" },
      { id: "brighton-beach", zh: "布莱顿海滩", en: "Brighton Beach", value: "Brighton Beach" },
      { id: "midwood", zh: "中木区", en: "Midwood", value: "Midwood" },
      { id: "downtown-brooklyn", zh: "布鲁克林市中心", en: "Downtown Brooklyn", value: "Downtown Brooklyn" },
      { id: "brooklyn-heights", zh: "布鲁克林高地", en: "Brooklyn Heights", value: "Brooklyn Heights" },
      { id: "williamsburg", zh: "威廉斯堡", en: "Williamsburg", value: "Williamsburg" },
      { id: "greenpoint", zh: "绿点", en: "Greenpoint", value: "Greenpoint" },
      { id: "bushwick", zh: "布什维克", en: "Bushwick", value: "Bushwick" },
      { id: "park-slope", zh: "公园坡", en: "Park Slope", value: "Park Slope" },
    ],
  },
  {
    id: "queens",
    zh: "皇后区",
    en: "Queens",
    value: "Queens",
    locations: [
      { id: "flushing", zh: "法拉盛", en: "Flushing", value: "Flushing" },
      { id: "elmhurst", zh: "艾姆赫斯特", en: "Elmhurst", value: "Elmhurst" },
      { id: "rego-park", zh: "雷哥公园", en: "Rego Park", value: "Rego Park" },
      { id: "forest-hills", zh: "森林小丘", en: "Forest Hills", value: "Forest Hills" },
      { id: "maspeth", zh: "马斯佩斯", en: "Maspeth", value: "Maspeth" },
      { id: "whitestone", zh: "白石", en: "Whitestone", value: "Whitestone" },
      { id: "bayside", zh: "贝赛德", en: "Bayside", value: "Bayside" },
      { id: "fresh-meadows", zh: "新鲜草原", en: "Fresh Meadows", value: "Fresh Meadows" },
      { id: "college-point", zh: "学院点", en: "College Point", value: "College Point" },
      { id: "jackson-heights", zh: "杰克逊高地", en: "Jackson Heights", value: "Jackson Heights" },
      { id: "woodside", zh: "木边", en: "Woodside", value: "Woodside" },
      { id: "long-island-city", zh: "长岛市", en: "Long Island City", value: "Long Island City" },
      { id: "murray-hill-queens", zh: "法拉盛梅里山", en: "Murray Hill", value: "Murray Hill" },
      { id: "astoria", zh: "阿斯托里亚", en: "Astoria", value: "Astoria" },
    ],
  },
  {
    id: "bronx",
    zh: "布朗克斯",
    en: "The Bronx",
    value: "Bronx",
    locations: [
      { id: "fordham", zh: "福德姆", en: "Fordham", value: "Fordham" },
      { id: "riverdale", zh: "河谷区", en: "Riverdale", value: "Riverdale" },
      { id: "kingsbridge", zh: "金斯布里奇", en: "Kingsbridge", value: "Kingsbridge" },
      { id: "pelham-bay", zh: "佩勒姆湾", en: "Pelham Bay", value: "Pelham Bay" },
      { id: "belmont", zh: "贝尔蒙特", en: "Belmont", value: "Belmont" },
      { id: "throgs-neck", zh: "特罗格斯颈", en: "Throgs Neck", value: "Throgs Neck" },
    ],
  },
  {
    id: "staten-island",
    zh: "史泰登岛",
    en: "Staten Island",
    value: "Staten Island",
    locations: [
      { id: "st-george", zh: "圣乔治", en: "St. George", value: "St. George" },
      { id: "new-dorp", zh: "新多普", en: "New Dorp", value: "New Dorp" },
      { id: "tottenville", zh: "托滕维尔", en: "Tottenville", value: "Tottenville" },
      { id: "great-kills", zh: "大基尔斯", en: "Great Kills", value: "Great Kills" },
      { id: "stapleton", zh: "斯台普顿", en: "Stapleton", value: "Stapleton" },
    ],
  },
  {
    id: "long-island",
    zh: "长岛",
    en: "Long Island",
    value: "Long Island",
    locations: [
      { id: "great-neck", zh: "大颈", en: "Great Neck", value: "Great Neck" },
      { id: "jericho", zh: "杰里科", en: "Jericho", value: "Jericho" },
      { id: "syosset", zh: "西奥塞特", en: "Syosset", value: "Syosset" },
      { id: "hicksville", zh: "希克斯维尔", en: "Hicksville", value: "Hicksville" },
      { id: "plainview", zh: "普莱恩维尤", en: "Plainview", value: "Plainview" },
      { id: "east-meadow", zh: "东草原", en: "East Meadow", value: "East Meadow" },
      { id: "new-hyde-park", zh: "新海德公园", en: "New Hyde Park", value: "New Hyde Park" },
      { id: "garden-city", zh: "花园城", en: "Garden City", value: "Garden City" },
      { id: "westbury", zh: "西伯里", en: "Westbury", value: "Westbury" },
      { id: "mineola", zh: "米尼奥拉", en: "Mineola", value: "Mineola" },
      { id: "manhasset", zh: "曼哈塞特", en: "Manhasset", value: "Manhasset" },
      { id: "nassau", zh: "拿骚县", en: "Nassau County", value: "Nassau" },
      { id: "suffolk", zh: "萨福克县", en: "Suffolk County", value: "Suffolk" },
      { id: "huntington", zh: "亨廷顿", en: "Huntington", value: "Huntington" },
      { id: "commack", zh: "科马克", en: "Commack", value: "Commack" },
      { id: "stony-brook", zh: "石溪", en: "Stony Brook", value: "Stony Brook" },
      { id: "patchogue", zh: "帕奇奥格", en: "Patchogue", value: "Patchogue" },
    ],
  },
  {
    id: "upstate-new-york",
    zh: "纽约上州",
    en: "Upstate New York",
    value: "Upstate New York",
    locations: [
      { id: "albany", zh: "奥尔巴尼", en: "Albany", value: "Albany" },
      { id: "colonie", zh: "科勒尼", en: "Colonie", value: "Colonie" },
      { id: "buffalo", zh: "水牛城", en: "Buffalo", value: "Buffalo" },
      { id: "williamsville", zh: "威廉斯维尔", en: "Williamsville", value: "Williamsville" },
      { id: "rochester", zh: "罗切斯特", en: "Rochester", value: "Rochester" },
      { id: "brighton-ny", zh: "布莱顿", en: "Brighton", value: "Brighton" },
      { id: "pittsford", zh: "匹兹福德", en: "Pittsford", value: "Pittsford" },
      { id: "syracuse", zh: "锡拉丘兹", en: "Syracuse", value: "Syracuse" },
      { id: "ithaca", zh: "伊萨卡", en: "Ithaca", value: "Ithaca" },
      { id: "cayuga-heights", zh: "卡尤加高地", en: "Cayuga Heights", value: "Cayuga Heights" },
      { id: "saratoga-springs", zh: "萨拉托加泉", en: "Saratoga Springs", value: "Saratoga Springs" },
      { id: "kingston", zh: "金斯顿", en: "Kingston", value: "Kingston" },
    ],
  },
] as const;

const LOCATION_LOOKUP_OPTION_COPY: Record<LocationLookupOption, { zh: string; en: string }> = {
  community: { zh: "华人生活圈", en: "Chinese community areas" },
  grocery: { zh: "中文超市 / 亚洲超市", en: "Chinese / Asian supermarkets" },
  park: { zh: "公园", en: "Parks" },
  library: { zh: "图书馆", en: "Libraries" },
  pharmacy: { zh: "药房", en: "Pharmacies" },
  school: { zh: "学校", en: "Schools" },
  restaurant: { zh: "餐饮", en: "Restaurants" },
  transit: { zh: "地铁 / 火车 / 公交", en: "Subway / train / bus" },
};

function transitLineLabel(line: LocationContextTransitLine, locale: Locale) {
  const vehicleType = line.vehicleType?.toLocaleUpperCase();
  const vehicle = vehicleType === "BUS" || vehicleType === "INTERCITY_BUS" || vehicleType === "TROLLEYBUS" ? (locale === "zh" ? "公交" : "Bus") : vehicleType === "SUBWAY" || vehicleType === "METRO_RAIL" ? (locale === "zh" ? "地铁" : "Subway") : vehicleType === "TRAIN" || vehicleType === "RAIL" || vehicleType === "HEAVY_RAIL" || vehicleType === "COMMUTER_TRAIN" ? (locale === "zh" ? "铁路" : "Rail") : "";
  const name = line.shortName || line.name;
  return vehicle ? `${vehicle} ${name}` : name;
}

function renderTransitContextItem(station: LocationContextTransit, locale: Locale) {
  return <li key={`transit-${station.name}`}>
    <span>{station.mode}</span>
    <strong>{station.name}</strong>
    <small>{station.driveMinutes ? (locale === "zh" ? `约 ${station.driveMinutes} 分钟车程` : `About ${station.driveMinutes} minutes by car`) : station.walkMinutes ? (locale === "zh" ? `约 ${station.walkMinutes} 分钟步行` : `About ${station.walkMinutes} minutes walking`) : (locale === "zh" ? "路线时间暂不可用" : "Travel time unavailable")}</small>
    {station.lines?.length ? <div className="location-transit-lines"><span className="location-transit-lines-label">{locale === "zh" ? "经停线路" : "Lines serving stop"}</span>{station.lines.map((line) => <span className="location-transit-line" key={`${station.name}-${line.shortName || line.name}`}>{transitLineLabel(line, locale)}</span>)}</div> : null}
  </li>;
}

function locationCheckedAtLabel(value: string | undefined, locale: Locale) {
  if (!value) return locale === "zh" ? "时间暂不可用" : "Time unavailable";
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function findPopularAreaSelection(areaEn: string, areaZh: string) {
  const matches = (value: string, candidate: string) => {
    const normalizedValue = value.trim().toLocaleLowerCase();
    const normalizedCandidate = candidate.trim().toLocaleLowerCase();
    return Boolean(normalizedValue && normalizedCandidate && (normalizedValue === normalizedCandidate || normalizedValue.includes(normalizedCandidate)));
  };
  const group = POPULAR_AREA_GROUPS.find((item) => matches(areaEn, item.en) || matches(areaZh, item.zh));
  const location = group?.locations.find((item) => matches(areaEn, item.en) || matches(areaZh, item.zh));
  return { areaGroupId: group?.id || "", areaLocationId: location?.id || "" };
}

const POPULAR_LOCATION_SHORTCUTS = POPULAR_AREA_GROUPS.flatMap((group) => [
  { zh: `${group.zh} / ${group.en}`, en: group.en, value: group.value },
  ...group.locations.map((area) => ({ zh: `${area.zh} / ${area.en}`, en: area.en, value: area.value })),
]);

const INQUIRY_COMMENT_OPTIONS = [
  { value: "details", zh: "想进一步了解房屋详情", en: "I'd like to understand more about the house" },
  { value: "asap", zh: "希望尽快看房", en: "I'd like to see the house as soon as possible" },
  { value: "costs", zh: "想确认租金、押金及其他费用", en: "I'd like to confirm rent, deposits, and other fees" },
  { value: "location", zh: "想了解具体位置和周边环境", en: "I'd like to learn more about the location and neighborhood" },
  { value: "terms", zh: "想确认入住日期和租期", en: "I'd like to confirm the move-in date and lease length" },
  { value: "furniture", zh: "想确认家具和家电配置", en: "I'd like to confirm the furniture and appliances" },
  { value: "pets", zh: "我有宠物，想确认是否可以", en: "I have a pet and would like to confirm the policy" },
  { value: "weekend", zh: "希望安排周末看房", en: "I'd prefer to tour on a weekend" },
  { value: "utilities", zh: "想确认水电网等费用是否包含", en: "I'd like to confirm whether utilities are included" },
  { value: "requirements", zh: "想了解申请条件和所需材料", en: "I'd like to learn about the application requirements" },
] as const;

// Common NYC and Long Island search aliases. Exact listing text remains searchable too.
const LOCATION_ALIAS_GROUPS = [
  ["纽约", "紐約", "纽约市", "紐約市", "new york", "new york city", "nyc", "n y c"],
  ["曼哈顿", "曼哈頓", "曼哈顿区", "曼哈頓區", "manhattan", "new york county"],
  ["布鲁克林", "布魯克林", "布鲁克林区", "布魯克林區", "brooklyn", "kings county"],
  ["皇后区", "皇后區", "皇后", "queens", "queens county"],
  ["布朗克斯", "布朗克斯区", "布朗克斯區", "the bronx", "bronx", "bronx county"],
  ["史泰登岛", "史泰登島", "斯塔滕岛", "斯塔滕島", "staten island", "richmond county"],
  ["长岛", "長島", "长岛地区", "長島地區", "long island"],
  ["拿骚县", "拿騷縣", "nassau", "nassau county"],
  ["萨福克县", "薩福克縣", "suffolk", "suffolk county"],
  ["纽约州", "紐約州", "new york state", "ny state"],
  ["纽约上州", "紐約上州", "纽约州北部", "紐約州北部", "纽约州北部地区", "紐約州北部地區", "upstate new york", "upstate ny", "upstate"],
  ["奥尔巴尼", "奧爾巴尼", "albany"],
  ["水牛城", "buffalo"],
  ["罗切斯特", "羅切斯特", "rochester"],
  ["锡拉丘兹", "錫拉丘茲", "syracuse"],
  ["伊萨卡", "伊薩卡", "ithaca"],
  ["萨拉托加泉", "薩拉托加泉", "saratoga springs"],
  ["金斯顿", "金斯頓", "kingston"],
  ["科勒尼", "科勒尼镇", "科勒尼鎮", "colonie", "colonie ny"],
  ["威廉斯维尔", "威廉斯維爾", "williamsville"],
  ["布莱顿", "布萊頓", "brighton", "brighton ny"],
  ["匹兹福德", "匹茲福德", "pittsford"],
  ["卡尤加高地", "卡尤加高地", "cayuga heights"],

  ["曼哈顿中城", "曼哈頓中城", "中城", "midtown", "midtown manhattan"],
  ["曼哈顿下城", "曼哈頓下城", "下城", "downtown manhattan", "lower manhattan"],
  ["上东区", "上東區", "upper east side", "ues"],
  ["上西区", "上西區", "upper west side", "uws"],
  ["下东区", "下東區", "lower east side", "les"],
  ["东村", "東村", "east village"],
  ["西村", "西村", "west village"],
  ["格林尼治村", "格林尼治村", "格林威治村", "greenwich village"],
  ["苏活", "蘇活", "苏荷", "蘇荷", "soho", "so ho"],
  ["诺霍", "諾霍", "诺荷", "諾荷", "noho", "no ho"],
  ["翠贝卡", "翠貝卡", "tribeca", "tri beca"],
  ["切尔西", "切爾西", "chelsea"],
  ["地狱厨房", "地獄廚房", "克林顿", "克林頓", "hell's kitchen", "hells kitchen", "clinton"],
  ["哈德逊广场", "哈德遜廣場", "哈德逊园区", "哈德遜園區", "hudson yards"],
  ["金融区", "金融區", "financial district", "fidi"],
  ["唐人街", "唐人街", "华埠", "華埠", "chinatown"],
  ["双桥", "雙橋", "two bridges"],
  ["小意大利", "小意大利", "little italy"],
  ["哈莱姆", "哈萊姆", "哈林", "harlem"],
  ["华盛顿高地", "華盛頓高地", "washington heights"],
  ["英伍德", "因伍德", "inwood"],
  ["晨边高地", "晨邊高地", "莫宁赛德高地", "莫寧賽德高地", "morningside heights"],
  ["格拉梅西", "格拉梅西", "gramercy", "gramercy park"],
  ["穆雷山", "默里山", "法拉盛梅里山", "murray hill", "murray hill queens"],
  ["基普斯湾", "基普斯灣", "kips bay"],
  ["熨斗区", "熨斗區", "扁铁区", "扁鐵區", "flatiron", "flatiron district"],
  ["联合广场", "聯合廣場", "union square"],
  ["炮台公园城", "炮台公園城", "电池公园城", "電池公園城", "battery park city"],
  ["卡内基山", "卡內基山", "carnegie hill"],
  ["萨顿广场", "薩頓廣場", "sutton place"],
  ["斯图文森特镇", "斯圖文森特鎮", "stuyvesant town", "stuy town"],
  ["罗斯福岛", "羅斯福島", "roosevelt island"],
  ["肉库区", "肉庫區", "肉类加工区", "肉類加工區", "meatpacking district", "meatpacking"],

  ["八大道", "第八大道", "布鲁克林八大道", "布魯克林八大道", "8th avenue", "8th ave", "eighth avenue", "brooklyn 8th avenue", "8 avenue"],
  ["布鲁克林市中心", "布魯克林市中心", "downtown brooklyn"],
  ["布鲁克林高地", "布魯克林高地", "brooklyn heights"],
  ["曼哈顿桥下", "曼哈頓橋下", "dum​​bo", "dumbo", "down under the manhattan bridge overpass"],
  ["威廉斯堡", "威廉斯堡", "williamsburg"],
  ["绿点", "綠點", "greenpoint"],
  ["布什维克", "布什維克", "bushwick"],
  ["贝德福德斯图文森特", "貝德福德斯圖文森特", "bedford stuyvesant", "bed stuy", "bed-stuy"],
  ["格林堡", "格林堡", "fort greene"],
  ["克林顿山", "克林頓山", "clinton hill"],
  ["展望高地", "展望高地", "prospect heights"],
  ["皇冠高地", "皇冠高地", "crown heights"],
  ["公园坡", "公園坡", "公园斜坡", "公園斜坡", "park slope"],
  ["卡罗尔花园", "卡羅爾花園", "carroll gardens"],
  ["圆石山", "圓石山", "鹅卵石山", "鵝卵石山", "cobble hill"],
  ["博鲁姆山", "博魯姆山", "boerum hill"],
  ["日落公园", "日落公園", "sunset park"],
  ["海湾岭", "海灣嶺", "bay ridge"],
  ["本森赫斯特", "本森赫斯特", "bensonhurst"],
  ["羊头湾", "羊頭灣", "sheepshead bay"],
  ["格雷夫森德", "格雷夫森德", "gravesend"],
  ["巴斯海滩", "巴斯海灘", "bath beach"],
  ["霍姆克雷斯特", "霍姆克雷斯特", "homecrest"],
  ["布莱顿海滩", "布萊頓海灘", "brighton beach"],
  ["康尼岛", "康尼島", "coney island"],
  ["戴克高地", "戴克高地", "dyker heights"],
  ["中木区", "中木區", "midwood"],
  ["坎纳西", "坎納西", "canarsie"],
  ["红钩", "紅鉤", "red hook"],
  ["戈瓦努斯", "戈瓦努斯", "gowanus"],
  ["展望莱弗茨花园", "展望萊弗茨花園", "prospect lefferts gardens", "plg"],

  ["长岛市", "長島市", "长岛城", "長島城", "long island city", "lic"],
  ["阿斯托里亚", "阿斯托里亞", "astoria"],
  ["阳光边", "陽光邊", "sunnyside"],
  ["伍德赛德", "伍德賽德", "woodside"],
  ["学院点", "學院點", "college point"],
  ["杰克逊高地", "傑克遜高地", "jackson heights"],
  ["艾姆赫斯特", "艾姆赫斯特", "elmhurst"],
  ["科罗娜", "科羅娜", "corona"],
  ["法拉盛", "法拉盛", "flushing"],
  ["新鲜草原", "新鮮草原", "fresh meadows"],
  ["森林小丘", "森林小丘", "森林山", "森林山", "forest hills"],
  ["雷哥公园", "雷哥公園", "rego park"],
  ["凯尤花园", "凱尤花園", "奇尤花园", "奇尤花園", "kew gardens"],
  ["里士满山", "里士滿山", "里士满丘", "里士滿丘", "richmond hill"],
  ["牙买加", "牙買加", "j​​amaica", "jamaica"],
  ["牙买加庄园", "牙買加莊園", "jamaica estates"],
  ["布里亚伍德", "布里亞伍德", "briarwood"],
  ["贝赛德", "貝賽德", "贝赛", "貝賽", "bayside"],
  ["道格拉斯顿", "道格拉斯頓", "douglaston"],
  ["小颈", "小頸", "little neck"],
  ["白石", "白石", "whitestone"],
  ["里奇伍德", "里奇伍德", "ridgewood"],
  ["马斯佩斯", "馬斯佩斯", "maspeth"],
  ["臭氧公园", "臭氧公園", "臭氧园", "臭氧園", "ozone park"],
  ["霍华德海滩", "霍華德海灘", "howard beach"],
  ["洛克威", "洛克威", "洛克威海滩", "洛克威海灘", "rockaway", "rockaway beach"],
  ["中村", "中村", "middle village"],
  ["劳雷尔顿", "勞雷爾頓", "laurelton"],
  ["圣奥尔本斯", "聖奧爾本斯", "st. albans", "st albans"],
  ["坎布里亚高地", "坎布里亞高地", "cambria heights"],

  ["河代尔", "河代爾", "河谷", "riverdale"],
  ["金斯布里奇", "金斯布里奇", "kingsbridge"],
  ["福特汉姆", "福特漢姆", "fordham"],
  ["贝尔蒙特", "貝爾蒙特", "belmont"],
  ["大学高地", "大學高地", "university heights"],
  ["莫里斯公园", "莫里斯公園", "morris park"],
  ["佩勒姆湾", "佩勒姆灣", "pelham bay"],
  ["索罗格斯颈", "索羅格斯頸", "索罗格颈", "索羅格頸", "throggs neck", "throgs neck"],
  ["莫特黑文", "莫特黑文", "mott haven"],
  ["康科斯", "康科斯", "the concourse", "concourse"],
  ["诺伍德", "諾伍德", "norwood"],
  ["城市岛", "城市島", "city island"],
  ["桑德维尤", "桑德維尤", "soundview"],

  ["圣乔治", "聖喬治", "st. george", "st george"],
  ["斯台普顿", "斯台普頓", "stapleton"],
  ["汤普金斯维尔", "湯普金斯維爾", "tompkinsville"],
  ["新斯普林维尔", "新斯普林維爾", "new springville"],
  ["新多普", "新多普", "new dorp"],
  ["大基尔斯", "大基爾斯", "great kills"],
  ["南海滩", "南海灘", "south beach"],
  ["托滕维尔", "托滕維爾", "tottenville"],
  ["休格诺", "休格諾", "huguenot"],

  ["大颈", "大頸", "great neck"],
  ["曼哈塞特", "曼哈塞特", "manhasset"],
  ["华盛顿港", "華盛頓港", "port washington"],
  ["米尼奥拉", "米尼奧拉", "mineola"],
  ["花园城", "花園城", "garden city"],
  ["亨普斯特德", "亨普斯特德", "hempstead"],
  ["尤宁代尔", "尤寧代爾", "uniondale"],
  ["西伯里", "西伯里", "westbury"],
  ["新海德公园", "新海德公園", "new hyde park"],
  ["花卉公园", "花卉公園", "floral park"],
  ["埃尔蒙特", "埃爾蒙特", "elmont"],
  ["富兰克林广场", "富蘭克林廣場", "franklin square"],
  ["谷溪", "谷溪", "山谷溪", "山谷溪", "valley stream"],
  ["洛克维尔中心", "洛克維爾中心", "rockville centre", "rockville center"],
  ["长滩", "長灘", "long beach"],
  ["海滨", "海濱", "奥申赛德", "奧申賽德", "oceanside"],
  ["林布鲁克", "林布魯克", "lynbrook"],
  ["弗里波特", "弗里波特", "freeport"],
  ["梅里克", "梅里克", "merrick"],
  ["贝尔莫", "貝爾莫", "bellmore"],
  ["旺塔", "旺塔", "wantagh"],
  ["马萨佩夸", "馬薩佩夸", "massapequa"],
  ["莱维敦", "萊維敦", "levittown"],
  ["希克斯维尔", "希克斯維爾", "hicksville"],
  ["普莱恩维尤", "普萊恩維尤", "plainview"],
  ["西奥塞特", "西奧塞特", "syosset"],
  ["杰里科", "傑里科", "jericho"],
  ["罗斯林", "羅斯林", "roslyn"],
  ["格伦科夫", "格倫科夫", "glen cove"],
  ["牡蛎湾", "牡蠣灣", "oyster bay"],
  ["贝思佩奇", "貝思佩奇", "bethpage"],
  ["东草原", "東草原", "east meadow"],
  ["西亨普斯特德", "西亨普斯特德", "west hempstead"],

  ["亨廷顿", "亨廷頓", "huntington"],
  ["亨廷顿站", "亨廷頓站", "huntington station"],
  ["冷泉港", "冷泉港", "cold spring harbor"],
  ["北港", "北港", "northport"],
  ["康马克", "康馬克", "commack"],
  ["史密斯敦", "史密斯敦", "smithtown"],
  ["霍波格", "霍波格", "hauppauge"],
  ["石溪", "石溪", "stony brook"],
  ["塞托基特", "塞托基特", "setauket"],
  ["杰斐逊港", "傑斐遜港", "port jefferson"],
  ["朗康科马", "朗康科馬", "ronkonkoma"],
  ["朗康科马湖", "朗康科馬湖", "lake ronkonkoma"],
  ["伊斯利普", "伊斯利普", "艾斯利普", "is​​lip", "islip"],
  ["湾岸", "灣岸", "bay shore"],
  ["巴比伦", "巴比倫", "babylon"],
  ["林登赫斯特", "林登赫斯特", "lindenhurst"],
  ["法明代尔", "法明代爾", "farmingdale"],
  ["梅尔维尔", "梅爾維爾", "melville"],
  ["布伦特伍德", "布倫特伍德", "brentwood"],
  ["中央伊斯利普", "中央伊斯利普", "central islip"],
  ["河头", "河頭", "riverhead"],
  ["帕乔格", "帕喬格", "patchogue"],
  ["东汉普顿", "東漢普頓", "east hampton"],
  ["南安普顿", "南安普頓", "southampton"],
  ["萨格港", "薩格港", "sag harbor"],
  ["谢尔特岛", "謝爾特島", "shelter island"],
  ["蒙托克", "蒙托克", "montauk"],
  ["阿马甘塞特", "阿馬甘塞特", "amagansett"],
  ["西汉普顿", "西漢普頓", "westhampton"],
  ["梅德福", "梅德福", "medford"],
  ["贝波特", "貝波特", "bayport"],
  ["鹿园", "鹿園", "deer park"],
  ["雪莉", "雪莉", "shirley"],
  ["马斯蒂克", "馬斯蒂克", "mastic"],
  ["塞尔登", "塞爾登", "selden"],
  ["森特里奇", "森特里奇", "centereach"],
  ["金斯公园", "金斯公園", "kings park"],
  ["肖勒姆", "肖勒姆", "shoreham"],
  ["韦丁河", "韋丁河", "wading river"],
] as const;

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const NORMALIZED_LOCATION_ALIAS_GROUPS = LOCATION_ALIAS_GROUPS.map((group) => group.map(normalizeSearchText));

const BEDROOM_FILTER_VALUES = new Set(["", "0", "1", "2", "3", "4"]);
const EXACT_BATHROOM_VALUES = ["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"] as const;
const BATHROOM_FILTER_VALUES = new Set(["", ...EXACT_BATHROOM_VALUES]);

function normalizePriceFilter(value: unknown) {
  const candidate = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return candidate && Number.isFinite(Number(candidate)) && Number(candidate) > 0 ? candidate : "";
}

function normalizeSquareFeetFilter(value: unknown) {
  const candidate = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return candidate && Number.isInteger(Number(candidate)) && Number(candidate) > 0 ? candidate : "";
}

function normalizeCountFilter(value: unknown, allowedValues: Set<string>) {
  const candidate = typeof value === "string" ? value : "";
  return allowedValues.has(candidate) ? candidate : "";
}

function matchesCountFilter(value: string, selected: string) {
  if (!selected) return true;
  const target = Number(selected.replace("+", ""));
  const actual = Number(value.replace("+", ""));
  if (!Number.isFinite(target) || !Number.isFinite(actual)) return value === selected;
  if (value.endsWith("+") && !selected.endsWith("+")) return false;
  return selected.endsWith("+") ? actual >= target : actual === target;
}

function locationSearchVariants(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  NORMALIZED_LOCATION_ALIAS_GROUPS.forEach((group) => {
    if (group.some((alias) => normalized.includes(alias))) group.forEach((alias) => variants.add(alias));
  });
  return [...variants];
}

function listingLocationSearchText(listing: Listing) {
  return locationSearchVariants([listing.titleZh, listing.titleEn, listing.areaZh, listing.areaEn].join(" ")).join(" ");
}

async function photoFingerprint(blob: Blob) {
  try {
    const bytes = await blob.arrayBuffer();
    if (typeof globalThis.crypto?.subtle?.digest === "function") {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // Fall through to the lightweight signature for browsers without Web Crypto.
  }
  const fileName = "name" in blob && typeof (blob as File).name === "string" ? (blob as File).name : "";
  return `${blob.type}:${blob.size}:${fileName}`;
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("The file could not be read."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(",", 2)[1] || "";
}

type PhotoUploadErrorCode = "unsupported" | "decode" | "prepare" | "presign" | "auth" | "size" | "storage" | "network";

class PhotoUploadError extends Error {
  code: PhotoUploadErrorCode;

  constructor(code: PhotoUploadErrorCode, message = "") {
    super(message || code);
    this.name = "PhotoUploadError";
    this.code = code;
  }
}

function isSupportedPhoto(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

async function uploadPhotoToR2(file: File) {
  if (!isSupportedPhoto(file)) throw new PhotoUploadError("unsupported");
  const fingerprint = await photoFingerprint(file);
  let display: Awaited<ReturnType<typeof optimizeImageFile>>;
  let thumbnail: Awaited<ReturnType<typeof optimizeImageFile>>;
  try {
    [display, thumbnail] = await Promise.all([
      optimizeImageFile(file, "listingDisplay"),
      optimizeImageFile(file, "listingThumbnail"),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    throw new PhotoUploadError(message.toLowerCase().includes("decode") ? "decode" : "prepare", message);
  }

  let presignResponse: Response;
  try {
    presignResponse = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        variants: [
          { variant: "display", contentType: display.contentType, size: display.blob.size },
          { variant: "thumbnail", contentType: thumbnail.contentType, size: thumbnail.blob.size },
        ],
      }),
    });
  } catch {
    throw new PhotoUploadError("network");
  }
  const presignResult = await presignResponse.json() as {
    uploads?: Array<{ variant?: string; key?: string; uploadUrl?: string; publicUrl?: string; contentType?: string; cacheControl?: string }>;
    error?: string;
  };
  const displayUpload = presignResult.uploads?.find((item) => item.variant === "display");
  const thumbnailUpload = presignResult.uploads?.find((item) => item.variant === "thumbnail");
  if (!presignResponse.ok || !displayUpload?.key || !displayUpload.uploadUrl || !displayUpload.publicUrl || !thumbnailUpload?.key || !thumbnailUpload.uploadUrl || !thumbnailUpload.publicUrl) {
    const errorCode = presignResponse.status === 401 || presignResponse.status === 403
      ? "auth"
      : presignResponse.status === 413 || presignResponse.status === 400 && presignResult.error?.includes("8 MB")
        ? "size"
        : "presign";
    throw new PhotoUploadError(errorCode, presignResult.error || "The image upload service is unavailable right now.");
  }

  try {
    const responses = await Promise.all([
      fetch(displayUpload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": display.contentType, "Cache-Control": displayUpload.cacheControl || "public, max-age=31536000, immutable" },
        body: display.blob,
      }),
      fetch(thumbnailUpload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": thumbnail.contentType, "Cache-Control": thumbnailUpload.cacheControl || "public, max-age=31536000, immutable" },
        body: thumbnail.blob,
      }),
    ]);
    if (responses.some((response) => !response.ok)) throw new Error("R2 upload failed.");
  } catch {
    throw new PhotoUploadError("storage");
  }
  return {
    key: displayUpload.key,
    url: displayUpload.publicUrl,
    contentType: display.contentType,
    thumbnailKey: thumbnailUpload.key,
    thumbnailUrl: thumbnailUpload.publicUrl,
    thumbnailContentType: thumbnail.contentType,
    width: display.width,
    height: display.height,
    fingerprint,
  };
}

function photoUploadMessage(error: unknown, locale: Locale) {
  const code = error instanceof PhotoUploadError ? error.code : "network";
  if (locale === "zh") {
    if (code === "unsupported") return "目前支持 JPG、PNG 或 WebP 图片；iPhone 的 HEIC/HEIF 请先转换为 JPG。";
    if (code === "decode") return "图片无法读取，可能是格式不受支持或文件已损坏。请换用 JPG、PNG 或 WebP。";
    if (code === "auth") return "请先登录并验证邮箱，然后再上传房源照片。";
    if (code === "size") return "图片文件太大，请换一张较小的图片后重试。";
    if (code === "presign") return "云端图片服务暂时不可用，请检查 R2 配置。";
    if (code === "storage") return "图片上传到 R2 失败，请检查 R2 的 CORS 和公开访问设置。";
    return "图片上传失败，请检查网络连接后重试。";
  }
  if (code === "unsupported") return "JPG, PNG, and WebP are supported. Convert iPhone HEIC/HEIF photos to JPG first.";
  if (code === "decode") return "This image could not be decoded. Try a JPG, PNG, or WebP file.";
  if (code === "auth") return "Sign in and verify your email before uploading listing photos.";
  if (code === "size") return "This image is too large. Choose a smaller file and try again.";
  if (code === "presign") return "Cloud image storage is unavailable. Check the R2 configuration.";
  if (code === "storage") return "The image could not be uploaded to R2. Check R2 CORS and public access settings.";
  return "The image upload failed. Check your network connection and try again.";
}

// The production UI starts empty and waits for live listings from the API.
const LISTINGS: Listing[] = []; /*
  {
    id: "elmwood-light",
    titleZh: "树影公园旁的两居",
    titleEn: "Two bedrooms beside Elmwood Park",
    areaZh: "皇后区 · 森林小丘一带",
    areaEn: "Queens · around Forest Hills",
    type: "entire",
    typeZh: "整套住房",
    typeEn: "Entire home",
    price: 3200,
    currency: "USD",
    bedrooms: "2",
    bathrooms: "1",
    squareFeet: 1100,
    moveIn: "Sep 01",
    lease: "12 months",
    image: "/listings/elmwood-light.png",
    features: ["furnished", "utilities", "laundry"],
    tagsZh: ["家具齐全", "包水费", "楼内洗衣房"],
    tagsEn: ["Furnished", "Water included", "Laundry in building"],
    freshnessZh: "今天更新",
    freshnessEn: "Updated today",
    posterZh: "房主 · 身份已核验",
    posterEn: "Owner · identity checked",
    privacyZh: "只显示大致区域",
    privacyEn: "Approximate area only",
  },
  {
    id: "harbor-window",
    titleZh: "带早餐角的明亮一居",
    titleEn: "Bright one-bedroom with a breakfast nook",
    areaZh: "泽西市 · 高地一带",
    areaEn: "Jersey City · around the Heights",
    type: "entire",
    typeZh: "整套住房",
    typeEn: "Entire home",
    price: 2680,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
    squareFeet: 720,
    moveIn: "Aug 15",
    lease: "12 months",
    image: "/listings/harbor-window.png",
    features: ["utilities", "parking", "pets"],
    tagsZh: ["采光好", "可养宠物", "停车位可询"],
    tagsEn: ["Daylight", "Pets considered", "Parking available"],
    freshnessZh: "2 小时前更新",
    freshnessEn: "Updated 2 hours ago",
    posterZh: "房产经纪 · 角色已核验",
    posterEn: "Agent · role checked",
    privacyZh: "接受看房后透露地址",
    privacyEn: "Address after tour acceptance",
  },
  {
    id: "cedar-room",
    titleZh: "近通勤线的独立房间",
    titleEn: "Private room near a commuter line",
    areaZh: "北约克 · 柳树谷一带",
    areaEn: "North York · around Willowdale",
    type: "privateRoom",
    typeZh: "独立房间",
    typeEn: "Private room",
    price: 1450,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
    squareFeet: 520,
    moveIn: "Sep 01",
    lease: "6 months",
    image: "/listings/cedar-room.png",
    features: ["furnished", "utilities", "laundry", "pets"],
    tagsZh: ["家具齐全", "水电网全包", "短租可询"],
    tagsEn: ["Furnished", "Utilities included", "Short lease possible"],
    freshnessZh: "昨天更新",
    freshnessEn: "Updated yesterday",
    posterZh: "房主 · 地点已核验",
    posterEn: "Owner · location checked",
    privacyZh: "精确地址由发布者决定",
    privacyEn: "Poster controls the exact address",
  },
  {
    id: "sunset-sublet",
    titleZh: "带露台的短租转租",
    titleEn: "A terrace sublet for the fall",
    areaZh: "布鲁克林 · 日落公园一带",
    areaEn: "Brooklyn · around Sunset Park",
    type: "sublet",
    typeZh: "转租",
    typeEn: "Sublet",
    price: 2350,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
    squareFeet: 850,
    moveIn: "Sep 15",
    lease: "4 months",
    image: "/listings/sunset-sublet.png",
    features: ["furnished", "utilities", "parking"],
    tagsZh: ["带家具", "露台", "租期灵活"],
    tagsEn: ["Furnished", "Terrace", "Flexible term"],
    freshnessZh: "3 天前更新",
    freshnessEn: "Updated 3 days ago",
    posterZh: "租客转租 · 房源资料待复核",
    posterEn: "Tenant sublet · listing review pending",
    privacyZh: "看房流程中透露地址",
    privacyEn: "Address revealed in the tour flow",
  },
] : []; */

const copy = {
  zh: {
    findRentals: "找房",
    saved: "收藏",
    messages: "消息",
    post: "发布房源",
    heading: "先把住处看明白",
    subheading:
      "比较租金、租期和房源信号。精确地址不会出现在公开页面，发布者会在合适的看房流程中决定是否透露。",
    saveSearch: "保存这组搜索",
    savedSearch: "搜索已保存",
    filters: "筛选条件",
    reset: "重置",
    location: "位置、大学或地标",
    locationPlaceholder: "例如 皇后区 / Queens",
    minPrice: "最低月租",
    maxPrice: "最高月租",
    minSqft: "最小面积（平方英尺）",
    maxSqft: "最大面积（平方英尺）",
    anyPrice: "不限",
    bedrooms: "卧室",
    anyBedrooms: "不限卧室",
    studio: "单间",
    bathrooms: "卫生间",
    anyBathrooms: "不限卫生间",
    type: "房源类型",
    allTypes: "全部类型",
    entire: "整套住房",
    privateRoom: "独立房间",
    sublet: "转租",
    moveIn: "入住时间",
    anytime: "随时可入住",
    more: "更多条件",
    less: "收起条件",
    furnished: "家具齐全",
    utilities: "包含部分费用",
    parking: "停车",
    pets: "宠物友好",
    laundry: "楼内洗衣房",
    inUnitLaundry: "室内洗衣机",
    airConditioning: "空调",
    dishwasher: "洗碗机",
    balcony: "阳台 / 露台",
    elevator: "电梯",
    gym: "健身房",
    doorman: "门卫 / 前台",
    storage: "储物空间",
    naturalLight: "采光好",
    privateEntrance: "独立出入口",
    privateBathroom: "独立卫生间",
    walkInCloset: "步入式衣帽间",
    hardwoodFloors: "木地板",
    packageRoom: "包裹室",
    roofDeck: "屋顶露台",
    nearTransit: "近公共交通",
    shortTerm: "短租可询",
    immediate: "立即入住",
    chooseDate: "指定入住日期",
    august: "2026年8月",
    september: "2026年9月",
    october: "2026年10月",
    search: "查找房源",
    approximate: "公开页面只显示大致区域",
    results: "符合条件的房源",
    syntheticNotice: "示例房源用于体验流程，不代表已上线库存或商业报价。",
    sort: "排序",
    bestFit: "最匹配",
    lowest: "租金从低到高",
    fresh: "最近更新",
    soonest: "最快入住",
    verifiedFirst: "优先已验证",
    popular: "最受关注",
    rankingExplanation: "排序说明",
    bestFitSummary: "综合位置、预算、房型、面积、入住时间和特点，并将近期更新、已验证和受关注的房源适度提前。",
    bestFitNoFiltersSummary: "尚未设置筛选条件；综合近期更新、已验证和受关注程度排序。",
    lowestSummary: "按月租从低到高排列；相同租金优先显示近期更新的房源。",
    freshSummary: "按最近更新时间排列；本周新发布和近期更新的房源会更容易找到。",
    soonestSummary: "优先显示可立即入住的房源，再按可入住日期排列。",
    verifiedSummary: "优先显示邮箱或经纪身份已验证的发布者。",
    popularSummary: "按浏览、收藏、联系、分享和比较等互动热度排列。",
    newThisWeek: "本周新发布",
    recentlyUpdated: "近期更新",
    popularAreas: "热门区域",
    popularBoroughs: "先选择行政区或地区",
    popularPlaces: "选择热门城市 / 社区",
    collapsePlaces: "收起",
    loadMore: "加载更多房源",
    loadingMore: "正在加载…",
    compare: "比较",
    comparing: "正在比较",
    view: "查看房源",
    contact: "开始联系",
    month: "/月",
    monthly: "月租",
    costBreakdown: "月租",
    costNote: "月租金额已标明；押金、水电和其他费用请向发布者确认",
    locationChecked: "地点已核验",
    availability: "近期确认有房",
    photoCount: "张照片",
    verifiedEmail: "邮箱已验证",
    verifiedAgent: "执照已核验",
    sampleSignal: "示例体验",
    localSignal: "本地预览",
    identity: "身份信号",
    addressPrivate: "精确地址暂不公开",
    detail: "房源详情",
    close: "关闭",
    detailsIntro: "公开信息先回答基本问题；精确地址要等到发布者接受合适的看房安排后再提供。",
    detailArea: "大致区域",
    detailMoveIn: "预计入住",
    detailLease: "最短租期",
    detailPoster: "发布者信号",
    detailAmenities: "房源特点",
    detailDescription: "房源介绍",
    requestTour: "联系并请求看房",
    privacyGuideTitle: "地址隐私是流程的一部分",
    privacyGuideBody: "我们公开大致区域和结构化房源信息；发布者可以在对话中确认需求，再决定是否给出精确地址。",
    trustTitle: "每一个信号都说明检查了什么",
    trustBody: "地点、身份和近期可用性分开显示，不用一个模糊的徽章代替解释。",
    conversationTitle: "先问清楚，再留下联系方式",
    conversationBody: "联系表单只询问入住时间、租期、居住人数和看房偏好，不收集社保号、信用资料或受保护特征。",
    contactTitle: "开始一次有用的对话",
    contactIntro: "这些结构化信息会随你的消息一起发送给发布者。",
    intendedMove: "预计入住",
    leaseLength: "期望租期",
    occupants: "居住人数",
    petsQuestion: "是否有宠物",
    noPets: "没有",
    yesPets: "有，稍后说明",
    message: "补充消息（可选）",
    messagePlaceholder: "例如：想了解周末看房时间……",
    sendInquiry: "发送咨询",
    inquirySent: "咨询草稿已准备好（示例模式）",
    postTitle: "发布一个完整房源",
    postIntro: "从地址和照片开始，逐步补充租期、费用、隐私和看房设置。",
    stageProperty: "房源与角色",
    stageTerms: "租赁条件",
    stageStory: "照片与介绍",
    stageContact: "联系与看房",
    stagePublish: "核验、预览、发布",
    polishTitle: "AI 润色房源文案",
    polishIntro: "根据你填写的事实和附近参考优化文案；精确地址只用于服务器端计算路线，不会发送给 AI 或显示在公开页面。",
    lookupTitle: "选择要查找的附近信息（可选）",
    lookupHelp: "只会查询你勾选的类别；最多选择 3 项。皇后区和布鲁克林先查附近公交，没有可验证公交时再查地铁；距离异常的站点不会显示，也不会用长岛铁路冒充。长岛会尽量补充 LIRR 和主要高速公路车程。路线会优先使用私密精确地址，发布前请复核。",
    lookupNone: "未选择附近查找；这次只润色房源文字，不产生 Google 地图查询。",
    lookupSelected: "已选择",
    lookupCached: "已使用缓存的附近参考，没有重复查询 Google。",
    lookupFresh: "已加入所选位置的附近参考；发布前请复核。",
    polishAction: "用 AI 润色",
    polishLoading: "正在润色…",
    polishApplied: "AI 文案已写入，请发布前复核",
    polishLocal: "已使用本地润色预览；配置 API Key 后可启用 AI",
    polishError: "AI 润色暂时不可用，请稍后重试。",
    startDraft: "开始草稿",
    draftStarted: "草稿已创建（示例模式）",
    clear: "清除条件",
    noResults: "没有找到符合这些条件的房源",
    noResultsBody: "试试放宽最高月租、位置或房源类型。",
    clearAndTry: "清除筛选并重试",
    notification: "提醒",
    language: "English",
    account: "账户",
  },
  en: {
    findRentals: "Find rentals",
    saved: "Saved",
    messages: "Messages",
    post: "Post a listing",
    heading: "Make the next move clear",
    subheading:
      "Compare rent, terms, and listing signals in one place. Exact addresses stay off public pages until the poster chooses to reveal one in the tour flow.",
    saveSearch: "Save this search",
    savedSearch: "Search saved",
    filters: "Filter desk",
    reset: "Reset",
    location: "Location, university, or landmark",
    locationPlaceholder: "Try 皇后区 / Queens",
    minPrice: "Minimum monthly rent",
    maxPrice: "Maximum monthly rent",
    minSqft: "Minimum size (sq ft)",
    maxSqft: "Maximum size (sq ft)",
    anyPrice: "Any price",
    bedrooms: "Bedrooms",
    anyBedrooms: "Any bedrooms",
    studio: "Studio",
    bathrooms: "Bathrooms",
    anyBathrooms: "Any bathrooms",
    type: "Rental type",
    allTypes: "All types",
    entire: "Entire home",
    privateRoom: "Private room",
    sublet: "Sublet",
    moveIn: "Move-in",
    anytime: "Any move-in date",
    more: "More filters",
    less: "Fewer filters",
    furnished: "Furnished",
    utilities: "Utilities included",
    parking: "Parking",
    pets: "Pet-friendly",
    laundry: "Laundry in building",
    inUnitLaundry: "In-unit laundry",
    airConditioning: "Air conditioning",
    dishwasher: "Dishwasher",
    balcony: "Balcony / terrace",
    elevator: "Elevator",
    gym: "Gym",
    doorman: "Doorman / front desk",
    storage: "Storage",
    naturalLight: "Great natural light",
    privateEntrance: "Private entrance",
    privateBathroom: "Private bathroom",
    walkInCloset: "Walk-in closet",
    hardwoodFloors: "Hardwood floors",
    packageRoom: "Package room",
    roofDeck: "Rooftop terrace",
    nearTransit: "Near public transit",
    shortTerm: "Short-term lease possible",
    immediate: "Move in immediately",
    chooseDate: "Choose a move-in date",
    august: "Aug 2026",
    september: "Sep 2026",
    october: "Oct 2026",
    search: "Search rentals",
    approximate: "Public pages show an approximate area only",
    results: "Matching rentals",
    syntheticNotice: "Sample listings demonstrate the workflow and are not live inventory or commercial offers.",
    sort: "Sort",
    bestFit: "Best fit",
    lowest: "Lowest rent",
    fresh: "Recently updated",
    soonest: "Soonest move-in",
    verifiedFirst: "Verified first",
    popular: "Most viewed",
    rankingExplanation: "How results are ordered",
    bestFitSummary: "Best fit weighs location, budget, home type, size, move-in timing, and features, then gives a modest lift to fresh, verified, and engaged listings.",
    bestFitNoFiltersSummary: "No filters are set yet; results balance freshness, verification, and engagement.",
    lowestSummary: "Listings are ordered from lowest monthly rent; recently updated homes break ties.",
    freshSummary: "Listings are ordered by their latest update, making new-this-week and recently updated homes easier to spot.",
    soonestSummary: "Listings available immediately come first, followed by the earliest available date.",
    verifiedSummary: "Listings from email- or agent-verified posters come first.",
    popularSummary: "Listings are ordered by engagement such as views, saves, contacts, shares, and comparisons.",
    newThisWeek: "New this week",
    recentlyUpdated: "Recently updated",
    popularAreas: "Popular areas",
    popularBoroughs: "Start with a borough or region",
    popularPlaces: "Choose a popular city or neighborhood",
    collapsePlaces: "Hide",
    loadMore: "Load more listings",
    loadingMore: "Loading more…",
    compare: "Compare",
    comparing: "Comparing",
    view: "View listing",
    contact: "Start a conversation",
    month: "/mo",
    monthly: "monthly",
    costBreakdown: "Monthly rent",
    costNote: "Monthly rent is shown; confirm deposits, utilities, and other fees with the poster",
    locationChecked: "Location checked",
    availability: "Availability recent",
    photoCount: "photos",
    verifiedEmail: "Verified email",
    verifiedAgent: "License checked",
    sampleSignal: "Sample preview",
    localSignal: "Local preview",
    identity: "Identity signal",
    addressPrivate: "Exact address stays private",
    detail: "Listing detail",
    close: "Close",
    detailsIntro: "Public facts answer the first questions. The exact address follows only after the poster accepts an appropriate tour arrangement.",
    detailArea: "Approximate area",
    detailMoveIn: "Move-in",
    detailLease: "Minimum lease",
    detailPoster: "Poster signals",
    detailAmenities: "Listing details",
    detailDescription: "About this home",
    requestTour: "Contact and request a tour",
    privacyGuideTitle: "Address privacy is part of the workflow",
    privacyGuideBody: "We publish an approximate area and structured rental facts. The poster can understand a renter's needs in conversation before choosing whether to share the exact address.",
    trustTitle: "Every signal says what was checked",
    trustBody: "Location, identity, and recent availability stay separate so one vague badge never stands in for an explanation.",
    conversationTitle: "Ask what matters before sharing contact details",
    conversationBody: "The inquiry form asks only for move-in timing, lease length, occupants, and tour preference—not SSN, credit files, or protected traits.",
    contactTitle: "Start a useful conversation",
    contactIntro: "These structured answers travel with your message to the poster.",
    intendedMove: "Intended move-in",
    leaseLength: "Lease length",
    occupants: "Occupants",
    petsQuestion: "Pets",
    noPets: "No pets",
    yesPets: "Yes, I can share details",
    message: "Optional message",
    messagePlaceholder: "For example: I would love to see it on a weekend…",
    sendInquiry: "Send inquiry",
    inquirySent: "Inquiry draft prepared (sample mode)",
    postTitle: "Publish a complete listing",
    postIntro: "Start with an address and photos, then add terms, fees, privacy, and tour settings step by step.",
    stageProperty: "Property and role",
    stageTerms: "Rental terms",
    stageStory: "Photos and story",
    stageContact: "Contact and tours",
    stagePublish: "Verify, preview, publish",
    polishTitle: "AI listing polish",
    polishIntro: "Polish the copy from your facts and nearby references. The exact address is used only on the server for route estimates; it is never sent to AI or shown publicly.",
    lookupTitle: "Choose nearby information to check (optional)",
    lookupHelp: "Only checked categories are queried; choose up to 3. Queens and Brooklyn check the nearest bus stop first, then try a subway station only when no verifiable bus result is available; implausibly distant stops are omitted and commuter rail is never substituted. Long Island adds LIRR and main-highway driving references when available. Routes use the private exact address on the server; review before publishing.",
    lookupNone: "No nearby lookup selected; this polish uses only your listing text and makes no Google Maps request.",
    lookupSelected: "selected",
    lookupCached: "Used cached nearby facts; Google was not queried again.",
    lookupFresh: "Added nearby facts for the selected location; review them before publishing.",
    polishAction: "Polish with AI",
    polishLoading: "Polishing…",
    polishApplied: "AI copy applied — review before publishing",
    polishLocal: "Local polish preview applied; add an API key to enable AI",
    polishError: "AI polishing is unavailable right now. Try again shortly.",
    startDraft: "Start a draft",
    draftStarted: "Draft created (sample mode)",
    clear: "Clear filters",
    noResults: "No rentals match those conditions",
    noResultsBody: "Try loosening the maximum rent, location, or rental type.",
    clearAndTry: "Clear filters and try again",
    notification: "Notifications",
    language: "中文",
    account: "Account",
  },
} as const;

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function GalleryIcon({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m5.5 17 4.2-4 3.1 2.7 2.1-2 3.6 3.3" />
    </svg>
  );
}

function HeartIcon({ size = 18, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 8.9c0 5.1-8.8 10.3-8.8 10.3S3.2 14 3.2 8.9A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.7Z" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 19 6v5c0 4.4-2.8 8-7 10-4.2-2-7-5.6-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function PinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

function SlidersIcon({ size = 17 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CompareIcon({ size = 17 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h5v14H5zM14 5h5v14h-5z" />
      <path d="M10 9h4M10 15h4" />
    </svg>
  );
}

function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ChevronIcon({ size = 14, direction }: { size?: number; direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "up" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"} />
    </svg>
  );
}

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ChatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4a3.5 3.5 0 0 1-3.5 3.5H11l-4.5 4v-4.8A3.5 3.5 0 0 1 5 10.5v-4Z" />
      <path d="M9 8h6M9 11h3" />
    </svg>
  );
}

function ShareIcon({ size = 17 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4" />
    </svg>
  );
}

function LinkIcon({ size = 17 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9.5 14.5 5-5" />
      <path d="M7.6 17.4H6a4 4 0 0 1 0-8h3" />
      <path d="M16.4 6.6H18a4 4 0 0 1 0 8h-3" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function formatPrice(listing: Listing) {
  return `$${listing.price.toLocaleString("en-US")}`;
}

function listingPhotos(listing: Listing) {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter((photo): photo is string => typeof photo === "string" && photo.length > 0) : [];
  return photos.length > 0 ? photos : listing.image ? [listing.image] : [];
}

function listingPhotoThumbnails(listing: Listing) {
  const thumbnails = Array.isArray(listing.photoThumbnails) ? listing.photoThumbnails.filter((photo): photo is string => typeof photo === "string" && photo.length > 0) : [];
  const photos = listingPhotos(listing);
  return thumbnails.length === photos.length ? thumbnails : photos;
}

function moveInMonth(value: string) {
  const isoMonth = value.match(/^\d{4}-(\d{2})-\d{2}$/)?.[1];
  if (isoMonth) return ({ "08": "august", "09": "september", "10": "october" } as Record<string, string>)[isoMonth] || "";
  const shortMonth = value.trim().slice(0, 3).toLowerCase();
  return ({ aug: "august", sep: "september", oct: "october" } as Record<string, string>)[shortMonth] || "";
}

function formatMoveIn(value: string, locale: Locale) {
  if (value === "immediate") return locale === "zh" ? "立即入住" : "Move in immediately";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return locale === "zh"
    ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function loadSharePosterImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The listing photo could not be loaded for the share poster."));
    image.src = source;
  });
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function wrapSharePosterLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let current = "";
  for (const character of Array.from(text || "")) {
    const candidate = current + character;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current.trim());
      current = character.trimStart();
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current.trim());
  if (lines.length === maxLines && Array.from(text || "").join("").length > lines.join("").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[。.!！?？,，;；:：\s]+$/u, "")}…`;
  }
  return lines.filter(Boolean);
}

function drawSharePosterText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const lines = wrapSharePosterLines(context, text, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

async function canvasToSharePosterBlob(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const response = await fetch(dataUrl);
  return response.blob();
}

async function renderSharePoster(options: {
  listing: Listing;
  locale: Locale;
  title: string;
  area: string;
  type: string;
  tags: string[];
  description: string;
  moveIn: string;
  price: string;
  url: string;
}) {
  const { listing, locale, title, area, type, tags, description, moveIn, price, url } = options;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  const photoHeight = 610;
  let posterImage: HTMLImageElement | null = null;
  const photoSource = listingPhotos(listing)[0];
  if (photoSource) {
    try {
      posterImage = await loadSharePosterImage(photoSource);
    } catch {
      posterImage = null;
    }
  }

  const paint = (includePhoto: boolean) => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#F6F4EF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#DEDFD9";
    context.fillRect(0, 0, canvas.width, photoHeight);
    if (includePhoto && posterImage) {
      drawCoverImage(context, posterImage, 0, 0, canvas.width, photoHeight);
    } else {
      context.fillStyle = "#EDF2F8";
      context.fillRect(0, 0, canvas.width, photoHeight);
      context.fillStyle = "#637384";
      context.font = "700 28px DM Sans, Noto Sans SC, sans-serif";
      context.fillText(locale === "zh" ? "房源分享卡" : "LISTING SHARE CARD", 64, 318);
      context.font = "400 20px DM Sans, Noto Sans SC, sans-serif";
      context.fillText(locale === "zh" ? "图片暂时无法嵌入，请打开链接查看照片" : "Open the link to view the listing photo", 64, 356);
    }

    context.fillStyle = "rgba(20, 42, 68, 0.82)";
    context.fillRect(0, 0, canvas.width, 84);
    context.fillStyle = "#FFFDF9";
    context.font = "700 22px DM Sans, Noto Sans SC, sans-serif";
    context.fillText("安居", 64, 52);
    context.fillStyle = "#D7E85D";
    context.fillRect(156, 27, 6, 30);
    context.fillStyle = "#FFFDF9";
    context.font = "700 15px DM Sans, Noto Sans SC, sans-serif";
    context.fillText("ANJURENTALS · MOMENTS SHARE", 180, 49);
    context.fillStyle = "#D7E85D";
    context.fillRect(0, photoHeight - 10, canvas.width, 10);

    const x = 64;
    const contentWidth = canvas.width - 128;
    let y = photoHeight + 76;
    context.fillStyle = "#637384";
    context.font = "700 17px DM Sans, Noto Sans SC, sans-serif";
    context.fillText(type.toUpperCase(), x, y);
    y += 55;
    context.fillStyle = "#142A44";
    context.font = "700 49px DM Sans, Noto Sans SC, sans-serif";
    y = drawSharePosterText(context, title || (locale === "zh" ? "未命名房源" : "Untitled listing"), x, y, contentWidth, 58, 2);
    y += 21;
    context.fillStyle = "#2768F0";
    context.font = "700 22px DM Sans, Noto Sans SC, sans-serif";
    context.fillText(area, x, y);
    y += 52;
    context.fillStyle = "#142A44";
    context.font = "700 38px DM Sans, Noto Sans SC, sans-serif";
    context.fillText(price, x, y);
    context.fillStyle = "#637384";
    context.font = "400 18px DM Sans, Noto Sans SC, sans-serif";
    context.fillText(locale === "zh" ? " / 月" : " / month", x + context.measureText(price).width + 10, y);
    y += 36;

    context.strokeStyle = "#DEDFD9";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(canvas.width - x, y);
    context.stroke();
    y += 42;

    const sizeFact = typeof listing.squareFeet === "number" && Number.isFinite(listing.squareFeet) && listing.squareFeet > 0
      ? `${listing.squareFeet.toLocaleString("en-US")} ${locale === "zh" ? "平方英尺" : "sq ft"}`
      : "";
    const facts = locale === "zh"
      ? [`${listing.bedrooms === "0" ? "单间" : `${listing.bedrooms} 卧`}`, `${listing.bathrooms} 卫`, ...(sizeFact ? [sizeFact] : []), moveIn]
      : [`${listing.bedrooms === "0" ? "Studio" : `${listing.bedrooms} bed`}`, `${listing.bathrooms} bath`, ...(sizeFact ? [sizeFact] : []), moveIn];
    const factWidth = contentWidth / facts.length;
    context.font = "700 21px DM Sans, Noto Sans SC, sans-serif";
    context.fillStyle = "#142A44";
    facts.forEach((fact, index) => context.fillText(fact, x + factWidth * index, y));
    y += 42;

    context.fillStyle = "#637384";
    context.font = "400 18px DM Sans, Noto Sans SC, sans-serif";
    y = drawSharePosterText(context, description || (locale === "zh" ? "打开链接查看完整房源详情。" : "Open the link for the full listing details."), x, y, contentWidth, 28, 2);
    y += 20;
    context.fillStyle = "#2768F0";
    context.font = "700 18px DM Sans, Noto Sans SC, sans-serif";
    const featureText = tags.length > 0 ? tags.slice(0, 4).join(" · ") : (locale === "zh" ? "房源详情已整理" : "Listing details available");
    drawSharePosterText(context, featureText, x, y, contentWidth, 28, 2);

    context.fillStyle = "#2768F0";
    context.fillRect(x, 1198, 260, 8);
    context.fillStyle = "#142A44";
    context.font = "700 20px DM Sans, Noto Sans SC, sans-serif";
    context.fillText(locale === "zh" ? "打开链接查看完整房源" : "Open the link for the full listing", x, 1246);
    context.fillStyle = "#637384";
    context.font = "400 16px DM Sans, Noto Sans SC, sans-serif";
    drawSharePosterText(context, url || (locale === "zh" ? "房源链接将在发布后显示" : "Listing link available after publishing"), x, 1281, contentWidth, 24, 2);
  };

  paint(Boolean(posterImage));
  try {
    return await canvasToSharePosterBlob(canvas);
  } catch (error) {
    if (!posterImage) throw error;
    paint(false);
    return canvasToSharePosterBlob(canvas);
  }
}

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function draftTimestamp() {
  return Date.now();
}

function addDaysToDateOnly(value: string, days: number) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export default function HomePage() {
  const demoMode = demoModeEnabled();
  const stableSessionId = useId();
  const [locale, setLocale] = useState<Locale>("zh");
  const [locationInput, setLocationInput] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [selectedPopularAreaId, setSelectedPopularAreaId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [rentalType, setRentalType] = useState<RentalType>("all");
  const [sortMode, setSortMode] = useState<SortMode>("fit");
  const [moveIn, setMoveIn] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedSearch, setSavedSearch] = useState(false);
  const [savedSearchSnapshot, setSavedSearchSnapshot] = useState<SearchSnapshot | null>(null);
  const [savedAlertFrequency, setSavedAlertFrequency] = useState<"off" | "daily" | "instant">("off");
  const [savedAlertLastSentAt, setSavedAlertLastSentAt] = useState<string | null>(null);
  const [accountSyncReady, setAccountSyncReady] = useState(false);
  const accountSyncUserIdRef = useRef<string | null>(null);
  const [customListings, setCustomListings] = useState<Listing[]>([]);
  const [remoteListings, setRemoteListings] = useState<Listing[]>([]);
  const [remoteHasMore, setRemoteHasMore] = useState(false);
  const [remoteListingsLoading, setRemoteListingsLoading] = useState(true);
  const [remoteListingsError, setRemoteListingsError] = useState("");
  const [remoteListingsRetry, setRemoteListingsRetry] = useState(0);
  const [remoteLoadingMore, setRemoteLoadingMore] = useState(false);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [agentProfilesLoading, setAgentProfilesLoading] = useState(false);
  const [agentProfilesError, setAgentProfilesError] = useState("");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [serverInquiries, setServerInquiries] = useState<DashboardInquiry[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"listings" | "inquiries" | "applications" | "agentRequests" | "safety">("listings");
  const [dashboardListings, setDashboardListings] = useState<DashboardListing[]>([]);
  const [receivedInquiries, setReceivedInquiries] = useState<DashboardInquiry[]>([]);
  const [renterApplications, setRenterApplications] = useState<DashboardApplication[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<DashboardApplication[]>([]);
  const [agentRequests, setAgentRequests] = useState<AgentRequest[]>([]);
  const [blockedPublishers, setBlockedPublishers] = useState<BlockedPublisher[]>([]);
  const [blockedListingIds, setBlockedListingIds] = useState<Set<string>>(new Set());
  const [blockLoadingId, setBlockLoadingId] = useState<string | null>(null);
  const [canManageAgentRequests, setCanManageAgentRequests] = useState(false);
  const [agentRequestLoadingId, setAgentRequestLoadingId] = useState<string | null>(null);
  const [applicationActionLoadingId, setApplicationActionLoadingId] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState("");
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState("");
  const [applicationListing, setApplicationListing] = useState<Listing | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [draft, setDraft] = useState<ListingDraft>(EMPTY_DRAFT);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>("idle");
  const [draftRecoveryNotice, setDraftRecoveryNotice] = useState<"local" | "account" | "offline" | null>(null);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [shareListing, setShareListing] = useState<Listing | null>(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const [sharePosterUrl, setSharePosterUrl] = useState("");
  const [sharePosterBlob, setSharePosterBlob] = useState<Blob | null>(null);
  const [sharePosterLoading, setSharePosterLoading] = useState(false);
  const [wechatShareResolution, setWechatShareResolution] = useState<WeChatShareResolution>({ key: "", status: "loading", error: "" });
  const [visibleResultCount, setVisibleResultCount] = useState(6);
  const [contactListing, setContactListing] = useState<Listing | null>(null);
  const [selectedInquiryComments, setSelectedInquiryComments] = useState<string[]>([]);
  const [inquiryTourPreference, setInquiryTourPreference] = useState("flexible");
  const [inquiryRequestedDate, setInquiryRequestedDate] = useState("");
  const [inquiryRequestedWindow, setInquiryRequestedWindow] = useState("any");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryTranslation, setInquiryTranslation] = useState("");
  const [inquiryAssistLoading, setInquiryAssistLoading] = useState(false);
  const [inquiryAssistError, setInquiryAssistError] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSummary, setCompareSummary] = useState<CompareSummary | null>(null);
  const [compareSummaryLoading, setCompareSummaryLoading] = useState(false);
  const [compareSummaryError, setCompareSummaryError] = useState("");
  const [postOpen, setPostOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [postStep, setPostStep] = useState<PostStep>(1);
  const [postError, setPostError] = useState("");
  const [aiPolishLoading, setAiPolishLoading] = useState(false);
  const [aiPolishError, setAiPolishError] = useState("");
  const [aiPolishSource, setAiPolishSource] = useState<"openai" | "local" | null>(null);
  const [aiPolishNotes, setAiPolishNotes] = useState<string[]>([]);
  const [locationContext, setLocationContext] = useState<LocationContext | null>(null);
  const [locationContextLoading, setLocationContextLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const wechatBrowser = isWeChatBrowser();
  const inquirySequence = useRef(0);
  const inquiryFormRef = useRef<HTMLFormElement>(null);
  const sharedListingIdRef = useRef<string | null>(null);
  const sessionKeyRef = useRef("");
  const isMobileViewport = useSyncExternalStore(subscribeToMobileViewport, getMobileViewportSnapshot, getMobileViewportServerSnapshot);
  const filterDialogRef = useDialogA11y(isMobileViewport && mobileFiltersOpen, () => setMobileFiltersOpen(false));
  const analyticsDialogRef = useDialogA11y(analyticsOpen && Boolean(currentUser), () => setAnalyticsOpen(false));
  const savedDialogRef = useDialogA11y(savedOpen, () => setSavedOpen(false));
  const messagesDialogRef = useDialogA11y(messagesOpen, () => setMessagesOpen(false));
  const compareDialogRef = useDialogA11y(compareOpen, () => setCompareOpen(false));
  const postDialogRef = useDialogA11y(postOpen, () => setPostOpen(false));
  const shareDialogRef = useDialogA11y(Boolean(shareListing), () => setShareListing(null));
  const detailDialogRef = useDialogA11y(Boolean(selectedListing), () => setSelectedListing(null));
  const contactDialogRef = useDialogA11y(Boolean(contactListing), () => { setContactListing(null); setInquiryError(""); });
  const t = copy[locale];
  const selectedPopularArea = POPULAR_AREA_GROUPS.find((group) => group.id === selectedPopularAreaId) || null;
  const selectedPostAreaGroup = POPULAR_AREA_GROUPS.find((group) => group.id === draft.areaGroupId) || null;
  const selectedAgentProfile = agentProfiles.find((profile) => profile.id === draft.agentProfileId) || null;
  const searchSnapshot = useMemo<SearchSnapshot>(() => ({
    location: appliedLocation,
    minPrice,
    maxPrice,
    minSqft,
    maxSqft,
    bedrooms,
    bathrooms,
    rentalType,
    moveIn,
    activeFeatures,
    sortMode,
  }), [activeFeatures, appliedLocation, bathrooms, bedrooms, maxPrice, maxSqft, minPrice, minSqft, moveIn, rentalType, sortMode]);
  const savedSearchIsCurrent = Boolean(savedSearch && savedSearchSnapshot && JSON.stringify(searchSnapshot) === JSON.stringify(savedSearchSnapshot));
  const savedSearchDescription = (snapshot: SearchSnapshot) => {
    const parts: string[] = [];
    if (snapshot.location) parts.push(snapshot.location);
    if (snapshot.minPrice || snapshot.maxPrice) {
      const minimum = snapshot.minPrice ? `$${Number(snapshot.minPrice).toLocaleString("en-US")}` : "—";
      const maximum = snapshot.maxPrice ? `$${Number(snapshot.maxPrice).toLocaleString("en-US")}` : "—";
      parts.push(`${minimum}–${maximum}`);
    }
    if (snapshot.bedrooms) parts.push(snapshot.bedrooms === "0" ? t.studio : `${snapshot.bedrooms} ${t.bedrooms.toLowerCase()}`);
    if (snapshot.bathrooms) parts.push(`${snapshot.bathrooms} ${t.bathrooms.toLowerCase()}`);
    if (snapshot.minSqft || snapshot.maxSqft) parts.push(`${snapshot.minSqft || "—"}–${snapshot.maxSqft || "—"} sq ft`);
    if (snapshot.rentalType !== "all") parts.push(snapshot.rentalType === "entire" ? t.entire : snapshot.rentalType === "privateRoom" ? t.privateRoom : t.sublet);
    if (snapshot.moveIn) parts.push(snapshot.moveIn === "august" ? t.august : snapshot.moveIn === "september" ? t.september : t.october);
    const featureLabels = snapshot.activeFeatures.map((key) => t[key as keyof typeof t]);
    if (featureLabels.length > 0) parts.push(featureLabels.slice(0, 2).join(" · ") + (featureLabels.length > 2 ? ` +${featureLabels.length - 2}` : ""));
    return parts.length > 0 ? parts.join(" · ") : (locale === "zh" ? "全部房源条件" : "All rental conditions");
  };
  const savedSearchLastAlertLabel = savedAlertLastSentAt
    ? new Date(savedAlertLastSentAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" })
    : (locale === "zh" ? "尚未发送" : "Not sent yet");
  const listingQuality = useMemo(() => {
    const qualityListings = [...remoteListings, ...customListings, ...(remoteListings.length > 0 ? [] : LISTINGS)];
    const draftArea = `${draft.areaZh} ${draft.areaEn}`.trim();
    const areaVariants = draftArea ? locationSearchVariants(draftArea) : [];
    const comparablePrices = areaVariants.length === 0 ? [] : qualityListings
      .filter((listing) => listing.id !== editingListingId && listing.source !== "sample" && listing.source !== "demo" && listing.price > 0 && areaVariants.some((variant) => listingLocationSearchText(listing).includes(variant)) && (!draft.bedrooms || listing.bedrooms === draft.bedrooms))
      .map((listing) => listing.price)
      .sort((a, b) => a - b);
    return analyzeListingQuality({ ...draft, media: mediaFromDraft(draft), comparablePrices });
  }, [customListings, draft, editingListingId, remoteListings]);
  const postSafetyReview = useMemo(() => reviewListingSafety({
    titleZh: draft.titleZh,
    titleEn: draft.titleEn,
    descriptionZh: draft.descriptionZh,
    descriptionEn: draft.descriptionEn,
  }), [draft]);

  useEffect(() => {
    if (!sharePosterUrl) return;
    return () => URL.revokeObjectURL(sharePosterUrl);
  }, [sharePosterUrl]);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const storedLocale = window.localStorage.getItem(STORAGE_KEYS.locale);
        const storedSavedIds = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedIds) || "[]");
        const storedInquiries = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.inquiries) || "[]");
        const storedDraft = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.draft) || "null");
        const storedDraftMeta = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.draftMeta) || "null");
        const storedSearchSnapshot = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedSearchSnapshot) || "null");
        const storedEditingListingId = window.localStorage.getItem(STORAGE_KEYS.editingListingId);
        const params = new URLSearchParams(window.location.search);
        const hasUrlSearch = ["location", "min", "max", "sqftMin", "sqftMax", "beds", "baths", "type", "move", "features", "sort"].some((key) => params.has(key));
        const urlMin = params.get("min");
        const urlMax = params.get("max");
        const urlMinSqft = params.get("sqftMin");
        const urlMaxSqft = params.get("sqftMax");
        const urlBedrooms = params.get("beds");
        const urlBathrooms = params.get("baths");
        const urlType = params.get("type");
        const urlSort = params.get("sort");
        const urlSnapshot: SearchSnapshot = {
          location: params.get("location") || "",
          minPrice: normalizePriceFilter(urlMin),
          maxPrice: normalizePriceFilter(urlMax),
          minSqft: normalizeSquareFeetFilter(urlMinSqft),
          maxSqft: normalizeSquareFeetFilter(urlMaxSqft),
          bedrooms: normalizeCountFilter(urlBedrooms, BEDROOM_FILTER_VALUES),
          bathrooms: normalizeCountFilter(urlBathrooms, BATHROOM_FILTER_VALUES),
          rentalType: urlType === "entire" || urlType === "privateRoom" || urlType === "sublet" ? urlType : "all",
          moveIn: params.get("move") === "august" || params.get("move") === "september" || params.get("move") === "october" ? params.get("move") || "" : "",
          activeFeatures: (params.get("features") || "").split(",").filter((feature): feature is string => POST_FEATURE_KEYS.includes(feature as typeof POST_FEATURE_KEYS[number])),
          sortMode: urlSort === "price" || urlSort === "fresh" || urlSort === "moveIn" || urlSort === "verified" || urlSort === "popular" ? urlSort : "fit",
        };
        const storedSnapshotRecord = storedSearchSnapshot && typeof storedSearchSnapshot === "object" ? storedSearchSnapshot as Partial<SearchSnapshot> : null;
        const localSnapshot: SearchSnapshot | null = storedSnapshotRecord ? {
          location: typeof storedSnapshotRecord.location === "string" ? storedSnapshotRecord.location : "",
          minPrice: normalizePriceFilter(storedSnapshotRecord.minPrice),
          maxPrice: normalizePriceFilter(storedSnapshotRecord.maxPrice),
          minSqft: normalizeSquareFeetFilter(storedSnapshotRecord.minSqft),
          maxSqft: normalizeSquareFeetFilter(storedSnapshotRecord.maxSqft),
          bedrooms: normalizeCountFilter(storedSnapshotRecord.bedrooms, BEDROOM_FILTER_VALUES),
          bathrooms: normalizeCountFilter(storedSnapshotRecord.bathrooms, BATHROOM_FILTER_VALUES),
          rentalType: storedSnapshotRecord.rentalType === "entire" || storedSnapshotRecord.rentalType === "privateRoom" || storedSnapshotRecord.rentalType === "sublet" ? storedSnapshotRecord.rentalType : "all",
          moveIn: storedSnapshotRecord.moveIn === "august" || storedSnapshotRecord.moveIn === "september" || storedSnapshotRecord.moveIn === "october" ? storedSnapshotRecord.moveIn : "",
          activeFeatures: Array.isArray(storedSnapshotRecord.activeFeatures) ? storedSnapshotRecord.activeFeatures.filter((feature): feature is string => typeof feature === "string" && POST_FEATURE_KEYS.includes(feature as typeof POST_FEATURE_KEYS[number])) : [],
          sortMode: storedSnapshotRecord.sortMode === "price" || storedSnapshotRecord.sortMode === "fresh" || storedSnapshotRecord.sortMode === "moveIn" || storedSnapshotRecord.sortMode === "verified" || storedSnapshotRecord.sortMode === "popular" ? storedSnapshotRecord.sortMode : "fit",
        } : null;
        const initialSearch = hasUrlSearch ? urlSnapshot : localSnapshot;
        if (storedLocale === "zh" || storedLocale === "en") setLocale(storedLocale);
        if (Array.isArray(storedSavedIds)) setSavedIds(new Set(storedSavedIds.filter((id): id is string => typeof id === "string")));
        if (Array.isArray(storedInquiries)) setInquiries(storedInquiries);
        if (storedEditingListingId) setEditingListingId(storedEditingListingId);
        if (storedDraft && typeof storedDraft === "object") {
          const storedDraftRecord = storedDraft as Partial<ListingDraft> & { moveIn?: unknown; photos?: unknown; photoKeys?: unknown; photoThumbnails?: unknown; media?: unknown };
          const legacyMoveIn = typeof storedDraftRecord.moveIn === "string" ? storedDraftRecord.moveIn : "";
          const storedPhotos = Array.isArray(storedDraftRecord.photos) ? storedDraftRecord.photos.filter((photo): photo is string => typeof photo === "string") : [];
          const storedPhotoKeys = Array.isArray(storedDraftRecord.photoKeys) ? storedDraftRecord.photoKeys.filter((key): key is string => typeof key === "string") : [];
          const storedPhotoThumbnails = Array.isArray(storedDraftRecord.photoThumbnails) ? storedDraftRecord.photoThumbnails.filter((url): url is string => typeof url === "string") : [];
          const storedMedia = normalizeClientMedia(storedDraftRecord.media);
          setDraft({
            ...EMPTY_DRAFT,
            ...storedDraftRecord,
            currency: "USD",
            agentService: storedDraftRecord.agentService === "agentMatch" ? "agentMatch" : "selfManaged",
            agentFeePlan: storedDraftRecord.agentFeePlan === "firstMonthRent" || storedDraftRecord.agentFeePlan === "flatFee" ? storedDraftRecord.agentFeePlan : "agentQuote",
            agentFeeAmount: typeof storedDraftRecord.agentFeeAmount === "string" ? storedDraftRecord.agentFeeAmount : "",
            agentProfileId: typeof storedDraftRecord.agentProfileId === "string" ? storedDraftRecord.agentProfileId : "",
            moveInMode: storedDraftRecord.moveInMode === "date" || (legacyMoveIn && legacyMoveIn !== "immediate") ? "date" : "immediate",
            moveInDate: typeof storedDraftRecord.moveInDate === "string" ? storedDraftRecord.moveInDate : legacyMoveIn !== "immediate" ? legacyMoveIn : "",
            locationLookupOptions: Array.isArray(storedDraftRecord.locationLookupOptions)
              ? storedDraftRecord.locationLookupOptions.filter((option): option is LocationLookupOption => typeof option === "string" && LOCATION_LOOKUP_OPTIONS.includes(option as LocationLookupOption)).slice(0, MAX_LOCATION_LOOKUP_OPTIONS)
              : [...DEFAULT_LOCATION_LOOKUP_OPTIONS],
            ...draftArraysFromMedia(storedMedia.length > 0 ? storedMedia : storedPhotos.map((url, index) => ({ key: storedPhotoKeys[index] || "", url, contentType: "image/jpeg", ...(storedPhotoThumbnails[index] ? { thumbnailUrl: storedPhotoThumbnails[index] } : {}) })).filter((item) => item.key)),
            photos: storedMedia.length > 0 || storedPhotos.length === 0 ? (storedMedia.length > 0 ? storedMedia.map((item) => item.url) : []) : storedPhotos,
            photoThumbnails: storedMedia.length > 0 ? storedMedia.map((item) => item.thumbnailUrl || item.url) : storedPhotoThumbnails,
            photoKeys: storedMedia.length > 0 ? storedMedia.map((item) => item.key) : storedPhotoKeys,
          });
          setDraftSavedAt(storedDraftMeta && typeof storedDraftMeta.updatedAt === "number" ? storedDraftMeta.updatedAt : Date.now());
          setDraftSaveState("savedLocal");
          setDraftRecoveryNotice("local");
        }
        if (initialSearch) {
          setLocationInput(initialSearch.location);
          setAppliedLocation(initialSearch.location);
          setMinPrice(initialSearch.minPrice);
          setMaxPrice(initialSearch.maxPrice);
          setMinSqft(initialSearch.minSqft);
          setMaxSqft(initialSearch.maxSqft);
          setBedrooms(initialSearch.bedrooms);
          setBathrooms(initialSearch.bathrooms);
          setRentalType(initialSearch.rentalType);
          setMoveIn(initialSearch.moveIn);
          setActiveFeatures(initialSearch.activeFeatures);
          setSortMode(initialSearch.sortMode);
        }
        setSavedSearch(window.localStorage.getItem(STORAGE_KEYS.savedSearch) === "true" || Boolean(localSnapshot));
        setSavedSearchSnapshot(localSnapshot);
      } catch {
        // Local storage is optional; the app remains usable in private browsing modes.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const verification = params.get("verified");
    const google = params.get("google");
    if (!verification && !google) return;
    const message = verification === "success"
      ? (locale === "zh" ? "邮箱已验证，请重新打开账户状态。" : "Email verified. Refresh your account status if needed.")
      : (locale === "zh" ? "验证链接无效或已过期。" : "That verification link is invalid or expired.");
    const authMessage = google === "success"
      ? (locale === "zh" ? "Google 登录成功" : "Google sign-in complete")
      : google
        ? (locale === "zh" ? "Google 登录未完成，请重试" : "Google sign-in was not completed")
        : message;
    params.delete("verified");
    params.delete("google");
    const remainingSearch = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}${window.location.hash}`);
    const showTimer = window.setTimeout(() => setVerificationNotice(authMessage), 0);
    const clearTimer = window.setTimeout(() => setVerificationNotice(""), 5200);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(clearTimer);
    };
  }, [hydrated, locale]);

  useEffect(() => {
    if (!hydrated) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { user?: AuthUser | null };
        setCurrentUser(result.user || null);
      })
      .catch(() => {
        // Anonymous browsing remains available when account services are offline.
      });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser?.emailVerified) {
      return;
    }
    if (accountSyncUserIdRef.current === currentUser.id) return;
    accountSyncUserIdRef.current = currentUser.id;
    let cancelled = false;
    const syncAccountState = async () => {
      let syncComplete = true;
      let localDraft: ListingDraft | null = null;
      let localEditingListingId: string | null = null;
      let localDraftUpdatedAt = Number.NaN;
      try {
        const storedDraft = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.draft) || "null");
        if (storedDraft && typeof storedDraft === "object") localDraft = storedDraft as ListingDraft;
        const storedDraftMeta = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.draftMeta) || "null") as { updatedAt?: unknown } | null;
        if (typeof storedDraftMeta?.updatedAt === "number") localDraftUpdatedAt = storedDraftMeta.updatedAt;
        if (!Number.isFinite(localDraftUpdatedAt) && localDraft && draftHasContent(localDraft) && draftSavedAt) localDraftUpdatedAt = draftSavedAt;
        localEditingListingId = window.localStorage.getItem(STORAGE_KEYS.editingListingId);
      } catch {
        // Local state is optional; the account state remains authoritative.
      }

      try {
        const [savedResponse, draftResponse, searchResponse, inquiryResponse] = await Promise.all([
          fetch("/api/saved-listings", { cache: "no-store" }),
          fetch("/api/my/draft", { cache: "no-store" }),
          fetch("/api/saved-search", { cache: "no-store" }),
          fetch("/api/inquiries", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        syncComplete = savedResponse.ok && draftResponse.ok && searchResponse.ok && inquiryResponse.ok;

        if (savedResponse.ok) {
          const savedResult = await savedResponse.json() as { listingIds?: unknown[] };
          const serverSavedIds = Array.isArray(savedResult.listingIds) ? savedResult.listingIds.filter((id): id is string => typeof id === "string") : [];
          if ([...savedIds].length > 0) {
            const migrationResponse = await fetch("/api/saved-listings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ listingIds: [...new Set([...serverSavedIds, ...savedIds])] }),
            });
            if (migrationResponse.ok) {
              const migrated = await migrationResponse.json() as { listingIds?: unknown[] };
              setSavedIds(new Set(Array.isArray(migrated.listingIds) ? migrated.listingIds.filter((id): id is string => typeof id === "string") : serverSavedIds));
            } else {
              syncComplete = false;
              setSavedIds(new Set([...serverSavedIds, ...savedIds]));
            }
          } else {
            setSavedIds(new Set(serverSavedIds));
          }
        }

        if (draftResponse.ok) {
          const draftResult = await draftResponse.json() as { draft?: unknown; editingListingId?: unknown; updatedAt?: unknown } | null;
          const draftPayload = draftResult?.draft && typeof draftResult.draft === "object" ? draftResult.draft : null;
          const serverDraftHasContent = Boolean(draftPayload && draftHasContent(draftPayload as ListingDraft));
          const serverDraftUpdatedAt = draftResult?.updatedAt ? Date.parse(String(draftResult.updatedAt)) : Number.NaN;
          const localDraftIsNewer = Boolean(localDraft && draftHasContent(localDraft) && Number.isFinite(localDraftUpdatedAt) && Number.isFinite(serverDraftUpdatedAt) && localDraftUpdatedAt > serverDraftUpdatedAt);
          if (serverDraftHasContent && !localDraftIsNewer && draftPayload) {
            setDraft({ ...EMPTY_DRAFT, ...(draftPayload as Partial<ListingDraft>), currency: "USD" });
            setEditingListingId(typeof draftResult?.editingListingId === "string" ? draftResult.editingListingId : null);
            setDraftSavedAt(Number.isFinite(serverDraftUpdatedAt) ? serverDraftUpdatedAt : Date.now());
            setDraftSaveState("savedAccount");
            setDraftRecoveryNotice("account");
          } else if (localDraft && draftHasContent(localDraft)) {
            const migrationResponse = await fetch("/api/my/draft", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ draft: localDraft, editingListingId: localEditingListingId }),
            });
            if (migrationResponse.ok) {
              const migrated = await migrationResponse.json() as { draft?: unknown; editingListingId?: unknown; updatedAt?: unknown };
              if (migrated.draft && typeof migrated.draft === "object") setDraft({ ...EMPTY_DRAFT, ...(migrated.draft as Partial<ListingDraft>), currency: "USD" });
              setEditingListingId(typeof migrated.editingListingId === "string" ? migrated.editingListingId : localEditingListingId);
              setDraftSavedAt(migrated.updatedAt ? Date.parse(String(migrated.updatedAt)) : Date.now());
              setDraftSaveState("savedAccount");
              setDraftRecoveryNotice("account");
            } else {
              syncComplete = false;
              setDraftSaveState("offline");
              setDraftRecoveryNotice("offline");
            }
          }
        } else if (localDraft && draftHasContent(localDraft)) {
          syncComplete = false;
          setDraftSaveState("offline");
          setDraftRecoveryNotice("offline");
        }

        if (inquiryResponse.ok) {
          const inquiryResult = await inquiryResponse.json();
          if (Array.isArray(inquiryResult)) setServerInquiries(inquiryResult as DashboardInquiry[]);
        }

        if (searchResponse.ok) {
          const searchResult = await searchResponse.json() as (SearchSnapshot & { updatedAt?: string; alertFrequency?: string; lastAlertAt?: string | null }) | null;
          if (searchResult) {
            const snapshot: SearchSnapshot = {
              location: searchResult.location || "",
              minPrice: normalizePriceFilter(searchResult.minPrice),
              maxPrice: normalizePriceFilter(searchResult.maxPrice),
              minSqft: normalizeSquareFeetFilter(searchResult.minSqft),
              maxSqft: normalizeSquareFeetFilter(searchResult.maxSqft),
              bedrooms: normalizeCountFilter(searchResult.bedrooms, BEDROOM_FILTER_VALUES),
              bathrooms: normalizeCountFilter(searchResult.bathrooms, BATHROOM_FILTER_VALUES),
              rentalType: searchResult.rentalType || "all",
              moveIn: searchResult.moveIn || "",
              activeFeatures: Array.isArray(searchResult.activeFeatures) ? searchResult.activeFeatures : [],
              sortMode: searchResult.sortMode || "fit",
            };
            setLocationInput(snapshot.location);
            setAppliedLocation(snapshot.location);
            setMinPrice(snapshot.minPrice);
            setMaxPrice(snapshot.maxPrice);
            setMinSqft(snapshot.minSqft);
            setMaxSqft(snapshot.maxSqft);
            setBedrooms(snapshot.bedrooms);
            setBathrooms(snapshot.bathrooms);
            setRentalType(snapshot.rentalType);
            setMoveIn(snapshot.moveIn);
            setActiveFeatures(snapshot.activeFeatures);
            setSortMode(snapshot.sortMode);
            setSavedSearchSnapshot(snapshot);
            setSavedAlertFrequency(searchResult.alertFrequency === "instant" ? "instant" : searchResult.alertFrequency === "daily" ? "daily" : "off");
            setSavedAlertLastSentAt(searchResult.lastAlertAt || null);
            setSavedSearch(true);
          } else if (savedSearch && savedSearchSnapshot) {
            const migrationResponse = await fetch("/api/saved-search", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(savedSearchSnapshot),
            });
            if (!migrationResponse.ok) syncComplete = false;
          }
        }
      } catch {
        // The browser remains usable if an account sync is temporarily unavailable.
        if (!cancelled && localDraft && draftHasContent(localDraft)) setDraftRecoveryNotice("offline");
      } finally {
        if (!cancelled) setAccountSyncReady(syncComplete);
      }
    };
    void syncAccountState();
    return () => {
      cancelled = true;
    };
  }, [currentUser, draftSavedAt, hydrated, savedIds, savedSearch, savedSearchSnapshot]);

  useEffect(() => {
    if (!postOpen || draft.agentService !== "agentMatch" || (!demoMode && !currentUser?.emailVerified)) {
      return;
    }
    let cancelled = false;
    const loadAgentProfiles = async () => {
      setAgentProfilesLoading(true);
      setAgentProfilesError("");
      try {
        const response = await fetch("/api/agents?purpose=selection", { cache: "no-store" });
        const result = await response.json() as AgentProfile[] | { error?: string };
        if (!response.ok) throw new Error((result as { error?: string }).error || "Agent profiles could not be loaded.");
        if (!cancelled) setAgentProfiles(Array.isArray(result) ? result : []);
      } catch (error) {
        if (!cancelled) setAgentProfilesError(error instanceof Error ? error.message : "Agent profiles could not be loaded.");
      } finally {
        if (!cancelled) setAgentProfilesLoading(false);
      }
    };
    void loadAgentProfiles();
    return () => {
      cancelled = true;
    };
  }, [currentUser, demoMode, draft.agentService, postOpen]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    if (!hydrated) return;
    try {
      const hasDraft = draftHasContent(draft) || Boolean(editingListingId);
      window.localStorage.setItem(STORAGE_KEYS.locale, locale);
      window.localStorage.removeItem(STORAGE_KEYS.customListings);
      if (!currentUser?.emailVerified || !accountSyncReady) {
        window.localStorage.setItem(STORAGE_KEYS.savedIds, JSON.stringify([...savedIds]));
        window.localStorage.setItem(STORAGE_KEYS.savedSearch, String(savedSearch));
        if (savedSearchSnapshot) window.localStorage.setItem(STORAGE_KEYS.savedSearchSnapshot, JSON.stringify(savedSearchSnapshot));
        else window.localStorage.removeItem(STORAGE_KEYS.savedSearchSnapshot);
        window.localStorage.setItem(STORAGE_KEYS.inquiries, JSON.stringify(inquiries));
        if (hasDraft) window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
        else window.localStorage.removeItem(STORAGE_KEYS.draft);
        if (hasDraft) window.localStorage.setItem(STORAGE_KEYS.draftMeta, JSON.stringify({ updatedAt: draftSavedAt || Date.now(), editingListingId }));
        else window.localStorage.removeItem(STORAGE_KEYS.draftMeta);
        if (editingListingId) window.localStorage.setItem(STORAGE_KEYS.editingListingId, editingListingId);
        else window.localStorage.removeItem(STORAGE_KEYS.editingListingId);
        window.setTimeout(() => setDraftSaveState(hasDraft ? "savedLocal" : "idle"), 0);
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.savedIds);
        window.localStorage.removeItem(STORAGE_KEYS.savedSearch);
        window.localStorage.removeItem(STORAGE_KEYS.savedSearchSnapshot);
        window.localStorage.removeItem(STORAGE_KEYS.inquiries);
        window.localStorage.removeItem(STORAGE_KEYS.draft);
        window.localStorage.removeItem(STORAGE_KEYS.draftMeta);
        window.localStorage.removeItem(STORAGE_KEYS.editingListingId);
      }
    } catch {
      // A full local storage quota should not block browsing or searching.
      if (draftHasContent(draft) || editingListingId) window.setTimeout(() => setDraftSaveState("offline"), 0);
    }
  }, [accountSyncReady, currentUser, draft, draftSavedAt, editingListingId, hydrated, inquiries, locale, savedIds, savedSearch, savedSearchSnapshot]);

  useEffect(() => {
    if (!accountSyncReady || !currentUser?.emailVerified || (!draftHasContent(draft) && !editingListingId)) return;
    const savingStateTimer = window.setTimeout(() => setDraftSaveState("saving"), 0);
    const saveTimer = window.setTimeout(() => {
      void fetch("/api/my/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, editingListingId }),
      }).then((response) => {
        if (response.ok) {
          setDraftSaveState("savedAccount");
          return;
        }
        setDraftSaveState("offline");
        setDraftRecoveryNotice("offline");
      }).catch(() => {
        setDraftSaveState("offline");
        setDraftRecoveryNotice("offline");
      });
    }, 700);
    return () => {
      window.clearTimeout(savingStateTimer);
      window.clearTimeout(saveTimer);
    };
  }, [accountSyncReady, currentUser, draft, editingListingId]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string, defaultValue = "") => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("location", searchSnapshot.location);
    setOrDelete("min", searchSnapshot.minPrice);
    setOrDelete("max", searchSnapshot.maxPrice);
    setOrDelete("sqftMin", searchSnapshot.minSqft);
    setOrDelete("sqftMax", searchSnapshot.maxSqft);
    setOrDelete("beds", searchSnapshot.bedrooms);
    setOrDelete("baths", searchSnapshot.bathrooms);
    setOrDelete("type", searchSnapshot.rentalType, "all");
    setOrDelete("move", searchSnapshot.moveIn);
    setOrDelete("features", searchSnapshot.activeFeatures.join(","));
    setOrDelete("sort", searchSnapshot.sortMode, "fit");
    const nextSearch = params.toString() ? `?${params.toString()}` : "";
    if (window.location.search !== nextSearch) window.history.replaceState({}, "", `${window.location.pathname}${nextSearch}${window.location.hash}`);
  }, [hydrated, searchSnapshot]);

  useEffect(() => {
    if (!hydrated || !currentUser || !currentUser.emailVerified || savedSearchSnapshot) return;
    const params = new URLSearchParams(window.location.search);
    if (["location", "min", "max", "sqftMin", "sqftMax", "beds", "baths", "type", "move", "features", "sort"].some((key) => params.has(key))) return;
    let cancelled = false;
    fetch("/api/saved-search", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as (SearchSnapshot & { updatedAt?: string; alertFrequency?: string; lastAlertAt?: string | null }) | null;
        if (!cancelled && result) {
          const snapshot: SearchSnapshot = {
            location: result.location || "",
            minPrice: normalizePriceFilter(result.minPrice),
            maxPrice: normalizePriceFilter(result.maxPrice),
            minSqft: normalizeSquareFeetFilter(result.minSqft),
            maxSqft: normalizeSquareFeetFilter(result.maxSqft),
            bedrooms: normalizeCountFilter(result.bedrooms, BEDROOM_FILTER_VALUES),
            bathrooms: normalizeCountFilter(result.bathrooms, BATHROOM_FILTER_VALUES),
            rentalType: result.rentalType || "all",
            moveIn: result.moveIn || "",
            activeFeatures: Array.isArray(result.activeFeatures) ? result.activeFeatures : [],
            sortMode: result.sortMode || "fit",
          };
          setLocationInput(snapshot.location);
          setAppliedLocation(snapshot.location);
          setMinPrice(snapshot.minPrice);
          setMaxPrice(snapshot.maxPrice);
          setMinSqft(snapshot.minSqft);
          setMaxSqft(snapshot.maxSqft);
          setBedrooms(snapshot.bedrooms);
          setBathrooms(snapshot.bathrooms);
          setRentalType(snapshot.rentalType);
          setMoveIn(snapshot.moveIn);
          setActiveFeatures(snapshot.activeFeatures);
          setSortMode(snapshot.sortMode);
          setSavedSearchSnapshot(snapshot);
          setSavedAlertFrequency(result.alertFrequency === "instant" ? "instant" : result.alertFrequency === "daily" ? "daily" : "off");
          setSavedAlertLastSentAt(result.lastAlertAt || null);
          setSavedSearch(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentUser, hydrated, savedSearchSnapshot]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let requestSettled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled && !requestSettled) {
        setRemoteListingsLoading(true);
        setRemoteListingsError("");
      }
    }, 0);
    fetch("/api/listings?limit=100&offset=0", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as unknown;
        if (!response.ok || !Array.isArray(result)) throw new Error("Live listings are unavailable right now.");
        if (!cancelled) {
          setRemoteListings(result as Listing[]);
          setRemoteHasMore(response.headers.get("X-Has-More") === "true");
          setRemoteListingsError("");
        }
      })
      .catch(() => {
        if (!cancelled) setRemoteListingsError(locale === "zh" ? "实时房源暂时无法加载。当前页面显示的是演示房源，请稍后重试。" : "Live listings are temporarily unavailable. This page is showing sample listings; please try again.");
      })
      .finally(() => {
        requestSettled = true;
        if (!cancelled) setRemoteListingsLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [hydrated, locale, remoteListingsRetry]);

  useEffect(() => {
    if (!accountOpen || !currentUser) return;
    let cancelled = false;
    const loadDashboard = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const [listingsResponse, inquiriesResponse, applicationsResponse, agentRequestsResponse, blocksResponse] = await Promise.all([
          fetch("/api/my/listings", { cache: "no-store" }),
          fetch("/api/inquiries?scope=received", { cache: "no-store" }),
          fetch("/api/applications", { cache: "no-store" }),
          fetch("/api/agent-requests?scope=incoming", { cache: "no-store" }),
          fetch("/api/blocks", { cache: "no-store" }),
        ]);
        if (!listingsResponse.ok || !inquiriesResponse.ok) throw new Error("Dashboard data is unavailable right now.");
        const [listings, inquiries, applicationPayload, agentRequestPayload, blockPayload] = await Promise.all([
          listingsResponse.json(),
          inquiriesResponse.json(),
          applicationsResponse.ok ? applicationsResponse.json() : Promise.resolve(null),
          agentRequestsResponse.ok ? agentRequestsResponse.json() : Promise.resolve(null),
          blocksResponse.ok ? blocksResponse.json() : Promise.resolve(null),
        ]);
        const applicationsResult = applicationPayload && typeof applicationPayload === "object" ? applicationPayload as { submitted?: unknown; received?: unknown } : null;
        const incomingAgentRequests = agentRequestPayload && typeof agentRequestPayload === "object" ? agentRequestPayload as { canManage?: unknown; requests?: unknown } : null;
        if (!cancelled) {
          setDashboardListings(Array.isArray(listings) ? listings as DashboardListing[] : []);
          setReceivedInquiries(Array.isArray(inquiries) ? inquiries as DashboardInquiry[] : []);
          setRenterApplications(Array.isArray(applicationsResult?.submitted) ? applicationsResult.submitted as DashboardApplication[] : []);
          setReceivedApplications(Array.isArray(applicationsResult?.received) ? applicationsResult.received as DashboardApplication[] : []);
          setCanManageAgentRequests(incomingAgentRequests?.canManage === true);
          setAgentRequests(Array.isArray(incomingAgentRequests?.requests) ? incomingAgentRequests.requests as AgentRequest[] : []);
          setBlockedPublishers(Array.isArray(blockPayload) ? blockPayload as BlockedPublisher[] : []);
          if (incomingAgentRequests?.canManage !== true) setDashboardTab((current) => current === "agentRequests" ? "listings" : current);
        }
      } catch (error) {
        if (!cancelled) setDashboardError(error instanceof Error ? error.message : "Dashboard data is unavailable right now.");
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [accountOpen, currentUser]);

  useEffect(() => {
    if (!messagesOpen || !currentUser) return;
    fetch("/api/inquiries", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result)) setServerInquiries(result as DashboardInquiry[]);
      })
      .catch(() => {
        // Local inquiry history remains visible if shared inquiry history is unavailable.
      });
  }, [currentUser, messagesOpen]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const trackListingEvent = (listingId: string, eventType: "view" | "save" | "contact" | "share" | "compare", metadata: Record<string, string> = {}) => {
    if (!hydrated || !listingId) return;
    if (!sessionKeyRef.current) {
      try {
        sessionKeyRef.current = window.localStorage.getItem("rental-marketplace.session-key") || stableSessionId;
        window.localStorage.setItem("rental-marketplace.session-key", sessionKeyRef.current);
      } catch {
        sessionKeyRef.current = stableSessionId;
      }
    }
    void fetch("/api/listing-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, eventType, sessionKey: sessionKeyRef.current, metadata }) }).catch(() => undefined);
  };

  const openListing = (listing: Listing) => {
    setSelectedPhotoIndex(0);
    setSelectedListing(listing);
    trackListingEvent(listing.id, "view");
  };

  const resetSharePoster = () => {
    setSharePosterBlob(null);
    setSharePosterUrl("");
    setSharePosterLoading(false);
  };

  const openShare = (listing: Listing) => {
    setSelectedListing(null);
    setShareListing(listing);
    trackListingEvent(listing.id, "share");
    setShareFeedback("");
    resetSharePoster();
  };

  const allListings = useMemo(
    () => [...remoteListings, ...customListings, ...(remoteListings.length > 0 ? [] : LISTINGS)],
    [customListings, remoteListings],
  );

  useEffect(() => {
    if (!hydrated || sharedListingIdRef.current || allListings.length === 0) return;
    const listingId = new URLSearchParams(window.location.search).get("listing");
    if (!listingId) return;
    const matchedListing = allListings.find((listing) => listing.id === listingId);
    if (!matchedListing) return;
    sharedListingIdRef.current = listingId;
    const openTimer = window.setTimeout(() => {
      setSelectedPhotoIndex(0);
      setSelectedListing(matchedListing);
    }, 0);
    return () => window.clearTimeout(openTimer);
  }, [allListings, hydrated]);

  const filteredListings = useMemo(() => {
    const queryVariants = locationSearchVariants(appliedLocation);
    const floorValue = Number(minPrice);
    const ceilingValue = Number(maxPrice);
    const sqftFloorValue = Number(minSqft);
    const sqftCeilingValue = Number(maxSqft);
    const floor = Number.isFinite(floorValue) && floorValue > 0 ? floorValue : 0;
    const ceiling = Number.isFinite(ceilingValue) && ceilingValue > 0 ? ceilingValue : Number.POSITIVE_INFINITY;
    const sqftFloor = Number.isFinite(sqftFloorValue) && sqftFloorValue > 0 ? sqftFloorValue : 0;
    const sqftCeiling = Number.isFinite(sqftCeilingValue) && sqftCeilingValue > 0 ? sqftCeilingValue : Number.POSITIVE_INFINITY;
    const hasSqftFilter = Boolean(minSqft || maxSqft);
    const filtered = allListings.filter((listing) => {
      const searchable = listingLocationSearchText(listing);
      const matchesLocation = queryVariants.length === 0 || queryVariants.some((variant) => searchable.includes(variant));
      const matchesPrice = listing.price >= floor && listing.price <= ceiling;
      const matchesBedrooms = matchesCountFilter(listing.bedrooms, bedrooms);
      const matchesBathrooms = matchesCountFilter(listing.bathrooms, bathrooms);
      const matchesSquareFeet = !hasSqftFilter || (typeof listing.squareFeet === "number" && Number.isFinite(listing.squareFeet) && listing.squareFeet >= sqftFloor && listing.squareFeet <= sqftCeiling);
      const matchesType = rentalType === "all" || listing.type === rentalType;
      const matchesMoveIn = !moveIn || listing.moveIn === "immediate" || moveInMonth(listing.moveIn) === moveIn;
      const matchesFeatures = activeFeatures.every((feature) => listing.features.includes(feature));
      return matchesLocation && matchesPrice && matchesBedrooms && matchesBathrooms && matchesSquareFeet && matchesType && matchesMoveIn && matchesFeatures;
    });

    const rankingSnapshot: SearchRankingSnapshot = {
      locationVariants: queryVariants,
      minPrice: floor,
      maxPrice: ceiling === Number.POSITIVE_INFINITY ? 0 : ceiling,
      minSqft: sqftFloor,
      maxSqft: sqftCeiling === Number.POSITIVE_INFINITY ? 0 : sqftCeiling,
      bedrooms,
      bathrooms,
      rentalType,
      moveIn,
      activeFeatures,
    };
    const rankingListings = new Map<string, SearchRankingListing>(filtered.map((listing) => [listing.id, {
      id: listing.id,
      searchableLocation: listingLocationSearchText(listing),
      price: listing.price,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      squareFeet: listing.squareFeet,
      type: listing.type,
      moveIn: listing.moveIn,
      features: listing.features,
      posterVerified: listing.posterVerified,
      popularityScore: listing.popularityScore,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    }]));
    return [...filtered].sort((a, b) => {
      const rankedA = rankingListings.get(a.id);
      const rankedB = rankingListings.get(b.id);
      if (!rankedA || !rankedB) return allListings.indexOf(a) - allListings.indexOf(b);
      return compareListingsForSearch(rankedA, rankedB, sortMode, rankingSnapshot, allListings.indexOf(a), allListings.indexOf(b));
    });
  }, [activeFeatures, allListings, appliedLocation, bathrooms, bedrooms, maxPrice, maxSqft, minPrice, minSqft, moveIn, rentalType, sortMode]);

  const compareListings = allListings.filter((listing) => compareIds.includes(listing.id));
  const compareKey = compareListings.map((listing) => listing.id).join("|");
  const savedListings = allListings.filter((listing) => savedIds.has(listing.id));
  const messageInquiries = currentUser?.emailVerified ? serverInquiries : inquiries;
  const visibleListings = filteredListings.slice(0, visibleResultCount);
  const canPostAsAgent = !currentUser ? demoMode : currentUser.agentVerified;

  const updateDraft = (updates: Partial<ListingDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
    setDraftSavedAt(draftTimestamp());
    setDraftSaveState("saving");
    setPostError("");
    setAiPolishError("");
    if (Object.prototype.hasOwnProperty.call(updates, "areaEn") || Object.prototype.hasOwnProperty.call(updates, "areaZh") || Object.prototype.hasOwnProperty.call(updates, "areaGroupId") || Object.prototype.hasOwnProperty.call(updates, "areaLocationId") || Object.prototype.hasOwnProperty.call(updates, "locationLookupOptions")) {
      setLocationContext(null);
    }
  };

  const openPostFlow = () => {
    if (!demoMode && !currentUser) {
      setAuthMode("login");
      setAuthError(locale === "zh" ? "请先登录，再发布房源。" : "Sign in before publishing a listing.");
      setAuthOpen(true);
      return;
    }
    if (!demoMode && currentUser && !currentUser.emailVerified) {
      setAccountOpen(true);
      setDashboardTab("listings");
      showToast(locale === "zh" ? "请先验证邮箱，再发布房源" : "Verify your email before publishing a listing");
      return;
    }
    setPostOpen(true);
    setEditingListingId(null);
    setPostStep(1);
    setDraft((current) => ({ ...current, posterRole: canPostAsAgent ? current.posterRole : "owner", contactName: current.contactName || currentUser?.displayName || "", contactEmail: current.contactEmail || currentUser?.email || "" }));
    setPostError("");
    setAiPolishError("");
    setAiPolishSource(null);
    setAiPolishNotes([]);
    setLocationContext(null);
  };

  const openAccount = () => {
    if (!currentUser) {
      setAuthMode("login");
      setAuthError("");
      setAuthOpen(true);
      return;
    }
    setAccountOpen(true);
    setDashboardTab("listings");
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authLoading) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      ...(authMode === "register" ? {
        displayName: String(formData.get("displayName") || ""),
        accountType: formData.get("accountType") === "agent" ? "agent" : "user",
      } : {}),
    };
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { user?: AuthUser; verificationSent?: boolean; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || (locale === "zh" ? "账户操作失败。" : "Account action failed."));
      setAccountSyncReady(false);
      accountSyncUserIdRef.current = null;
      setCurrentUser(result.user);
      setAuthOpen(false);
      setAuthError("");
      showToast(authMode === "register"
        ? result.user.accountType === "agent"
          ? (result.verificationSent
            ? (locale === "zh" ? "经纪账户已创建，验证邮件已发送；执照核验通过后可发布更多房源" : "Agent account created; verify your email, then complete license review for higher limits")
            : (locale === "zh" ? "经纪账户已创建；请先验证邮箱并完成执照核验" : "Agent account created; verify your email and complete license review"))
          : (result.verificationSent ? (locale === "zh" ? "账户已创建，验证邮件已发送" : "Account created; verification email sent") : (locale === "zh" ? "账户已创建，请配置或重新发送验证邮件" : "Account created; verification email is not configured yet"))
        : (locale === "zh" ? "已登录" : "Signed in"));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : (locale === "zh" ? "账户操作失败。" : "Account action failed."));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCurrentUser(null);
    accountSyncUserIdRef.current = null;
    setSavedIds(new Set());
    setSavedSearch(false);
    setSavedSearchSnapshot(null);
    setSavedAlertFrequency("off");
    setSavedAlertLastSentAt(null);
    setDraft(EMPTY_DRAFT);
    setEditingListingId(null);
    setInquiries([]);
    setAccountSyncReady(false);
    setAccountOpen(false);
    setServerInquiries([]);
    setDashboardListings([]);
    setReceivedInquiries([]);
    setRenterApplications([]);
    setReceivedApplications([]);
    setAgentRequests([]);
    setBlockedPublishers([]);
    setBlockedListingIds(new Set());
    setBlockLoadingId(null);
    setCanManageAgentRequests(false);
    setApplicationListing(null);
    setApplicationError("");
    showToast(locale === "zh" ? "已退出登录" : "Signed out");
  };

  const handleResendVerification = async () => {
    if (resendLoading) return;
    setResendLoading(true);
    setResendError("");
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const result = await response.json() as { sent?: boolean; alreadyVerified?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "The verification email could not be sent.");
      if (result.alreadyVerified) {
        setCurrentUser((current) => current ? { ...current, emailVerified: true } : current);
        showToast(locale === "zh" ? "邮箱已经验证" : "Email is already verified");
      } else if (result.sent) {
        showToast(locale === "zh" ? "验证邮件已重新发送" : "Verification email resent");
      } else {
        showToast(locale === "zh" ? "验证邮件暂未发送，请检查 Resend 配置" : "Verification email was not sent; check the Resend configuration");
      }
    } catch (error) {
      setResendError(error instanceof Error ? error.message : "The verification email could not be sent.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleAgentVerificationStatusChange = (status: AuthUser["agentVerificationStatus"]) => {
    setCurrentUser((current) => current ? { ...current, agentVerificationStatus: status, agentVerified: status === "verified" } : current);
  };

  const handleDashboardStatus = async (id: string, status: "published" | "paused") => {
    try {
      const response = await fetch(`/api/my/listings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { error?: string; code?: string; limit?: number };
      if (!response.ok) {
        if (result.code === "LISTING_LIMIT_REACHED") throw new Error(locale === "zh" ? `当前账户最多可发布 ${result.limit || 3} 套有效房源。` : (result.error || "Your listing limit has been reached."));
        throw new Error(result.error || "Listing status could not be updated.");
      }
      setDashboardListings((current) => current.map((listing) => listing.id === id ? { ...listing, status } : listing));
      const listingResponse = await fetch("/api/listings", { cache: "no-store" });
      if (listingResponse.ok) {
        const listings = await listingResponse.json();
        if (Array.isArray(listings)) {
          setRemoteListings(listings as Listing[]);
          setRemoteHasMore(listingResponse.headers.get("X-Has-More") === "true");
        }
      }
      showToast(status === "published" ? (locale === "zh" ? "房源已重新发布" : "Listing republished") : (locale === "zh" ? "房源已暂停" : "Listing paused"));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Listing status could not be updated.");
    }
  };

  const handleRenewListing = async (id: string) => {
    const listing = dashboardListings.find((item) => item.id === id);
    const today = todayDateOnly();
    const baseDate = listing?.expiresOn && listing.expiresOn >= today ? listing.expiresOn : today;
    const expiresOn = addDaysToDateOnly(baseDate, 30);
    try {
      const response = await fetch(`/api/my/listings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", expiresOn }),
      });
      const result = await response.json() as { error?: string; code?: string; limit?: number; expiresOn?: string | null };
      if (!response.ok) {
        if (result.code === "LISTING_LIMIT_REACHED") throw new Error(locale === "zh" ? `当前账户最多可发布 ${result.limit || 3} 套有效房源。` : (result.error || "Your listing limit has been reached."));
        throw new Error(result.error || "Listing could not be renewed.");
      }
      setDashboardListings((current) => current.map((item) => item.id === id ? { ...item, status: "published", expiresOn: result.expiresOn || expiresOn } : item));
      const listingResponse = await fetch("/api/listings", { cache: "no-store" });
      if (listingResponse.ok) {
        const listings = await listingResponse.json();
        if (Array.isArray(listings)) {
          setRemoteListings(listings as Listing[]);
          setRemoteHasMore(listingResponse.headers.get("X-Has-More") === "true");
        }
      }
      showToast(locale === "zh" ? "房源已续期 30 天" : "Listing renewed for 30 days");
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Listing could not be renewed.");
    }
  };

  const handleAgentRequestDecision = async (id: string, status: "accepted" | "declined") => {
    if (agentRequestLoadingId) return;
    setAgentRequestLoadingId(id);
    setDashboardError("");
    try {
      const response = await fetch(`/api/agent-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { error?: string; status?: AgentRequestStatus; agentNote?: string };
      if (!response.ok) throw new Error(result.error || "The agent request could not be updated.");
      setAgentRequests((current) => current.map((request) => request.id === id ? { ...request, status: result.status || status, agentNote: result.agentNote || request.agentNote, updatedAt: new Date().toISOString() } : request));
      showToast(status === "accepted" ? (locale === "zh" ? "请求已接受，房主会收到通知" : "Request accepted; the owner will be notified") : (locale === "zh" ? "请求已拒绝，房主会收到通知" : "Request declined; the owner will be notified"));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "The agent request could not be updated.");
    } finally {
      setAgentRequestLoadingId(null);
    }
  };

  const viewDashboardListing = (id: string) => {
    const listing = dashboardListings.find((item) => item.id === id) || allListings.find((item) => item.id === id);
    if (listing) {
      openListing(listing);
      setAccountOpen(false);
    }
  };

  const editDashboardListing = (id: string) => {
    const listing = dashboardListings.find((item) => item.id === id);
    if (!listing) return;
    const moveInIsImmediate = listing.moveIn === "immediate" || !listing.moveIn;
    const leaseMonths = listing.lease.match(/\d+/)?.[0] || "12";
    const areaSelection = findPopularAreaSelection(listing.areaEn, listing.areaZh);
    setDraft({
      ...EMPTY_DRAFT,
      titleZh: listing.titleZh,
      titleEn: listing.titleEn,
      areaZh: listing.areaZh,
      areaEn: listing.areaEn,
      ...areaSelection,
      privateAddress: listing.privateAddress,
      posterRole: listing.posterRole || "owner",
      rentalType: listing.type,
      price: String(listing.price || ""),
      currency: "USD",
      bedrooms: listing.bedrooms || "1",
      bathrooms: listing.bathrooms || "1",
      squareFeet: listing.squareFeet ? String(listing.squareFeet) : "",
      moveInMode: moveInIsImmediate ? "immediate" : "date",
      moveInDate: moveInIsImmediate ? "" : listing.moveIn,
      lease: leaseMonths,
      features: listing.features || [],
      descriptionZh: listing.descriptionZh || "",
      descriptionEn: listing.descriptionEn || "",
      photos: listing.photos || [],
      photoThumbnails: listing.photoThumbnails || listing.photos || [],
      photoKeys: listing.photoKeys || [],
      media: listing.media || [],
      contactName: listing.contactName || currentUser?.displayName || "",
      contactEmail: listing.contactEmail || currentUser?.email || "",
      tourPreference: listing.tourPreference || "flexible",
      agentService: listing.agentService || "selfManaged",
      agentFeePlan: listing.agentFeePlan || "agentQuote",
      agentFeeAmount: listing.agentFeeAmount == null ? "" : String(listing.agentFeeAmount),
      agentProfileId: listing.agentProfileId || "",
      expiresOn: listing.expiresOn || "",
    });
    setEditingListingId(id);
    setPostStep(1);
    setPostError("");
    setAiPolishError("");
    setAiPolishSource(null);
    setAiPolishNotes([]);
    setLocationContext(null);
    setAccountOpen(false);
    setPostOpen(true);
  };

  const toggleSaved = async (id: string) => {
    const wasSaved = savedIds.has(id);
    trackListingEvent(id, "save");
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!currentUser?.emailVerified) return;
    try {
      const response = wasSaved
        ? await fetch(`/api/saved-listings?listingId=${encodeURIComponent(id)}`, { method: "DELETE" })
        : await fetch("/api/saved-listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: id }),
        });
      if (!response.ok) throw new Error("Saved listing sync failed");
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(id);
        else next.delete(id);
        return next;
      });
      showToast(locale === "zh" ? "收藏同步失败，请稍后重试" : "Saved listing sync failed; try again shortly");
    }
  };

  const toggleCompare = (id: string) => {
    trackListingEvent(id, "compare");
    setCompareSummary(null);
    setCompareSummaryError("");
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) {
        showToast(locale === "zh" ? "最多比较两个房源" : "Compare up to two listings");
        return current;
      }
      return [...current, id];
    });
  };

  const toggleFeature = (feature: string) => {
    setActiveFeatures((current) => (current.includes(feature) ? current.filter((item) => item !== feature) : [...current, feature]));
  };

  const handleProfileUpdate = async (input: { displayName: string; phone: string }) => {
    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = await response.json() as { user?: AuthUser; error?: string };
    if (!response.ok || !result.user) throw new Error(result.error || (locale === "zh" ? "资料暂时无法更新。" : "Profile could not be updated right now."));
    setCurrentUser(result.user);
    showToast(locale === "zh" ? "资料已更新" : "Profile updated");
  };

  const openApplication = (listing: Listing) => {
    if (!currentUser) {
      setAuthMode("login");
      setAuthOpen(true);
      showToast(locale === "zh" ? "请先登录，再提交租赁申请" : "Sign in before submitting a rental application");
      return;
    }
    if (!currentUser.emailVerified) {
      setAccountOpen(true);
      showToast(locale === "zh" ? "请先验证邮箱，再提交租赁申请" : "Verify your email before submitting a rental application");
      return;
    }
    setSelectedListing(null);
    setContactListing(null);
    setApplicationListing(listing);
    setApplicationError("");
  };

  const submitApplication = async (values: ApplicationFormValues) => {
    if (!applicationListing) return;
    if (!currentUser?.emailVerified) throw new Error(locale === "zh" ? "请先验证邮箱。" : "Verify your email first.");
    setApplicationLoading(true);
    setApplicationError("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: applicationListing.id, ...values }),
      });
      const result = await response.json().catch(() => ({})) as { application?: DashboardApplication; error?: string };
      if (!response.ok || !result.application) throw new Error(result.error || (locale === "zh" ? "租赁申请暂时无法提交。" : "The rental application could not be submitted."));
      setRenterApplications((current) => [result.application!, ...current.filter((item) => item.listingId !== result.application!.listingId)]);
      setApplicationListing(null);
      showToast(locale === "zh" ? "租赁申请已提交" : "Rental application submitted");
    } catch (error) {
      const message = error instanceof Error ? error.message : (locale === "zh" ? "租赁申请暂时无法提交。" : "The rental application could not be submitted.");
      setApplicationError(message);
      throw new Error(message);
    } finally {
      setApplicationLoading(false);
    }
  };

  const updateApplicationStatus = async (id: string, status: "reviewing" | "approved" | "declined" | "withdrawn", note: string) => {
    if (!currentUser?.emailVerified) throw new Error(locale === "zh" ? "请先验证邮箱。" : "Verify your email first.");
    setApplicationActionLoadingId(id);
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const result = await response.json().catch(() => ({})) as { status?: ApplicationStatus; note?: string; error?: string; event?: { id: string; status: ApplicationStatus; note: string; actorRole: "renter" | "owner"; createdAt: string } | null };
      if (!response.ok || !result.status) throw new Error(result.error || (locale === "zh" ? "申请状态暂时无法更新。" : "The application status could not be updated."));
      const applyUpdate = (item: DashboardApplication) => item.id === id ? { ...item, status: result.status!, unread: false, ...(status === "withdrawn" ? { requesterNote: result.note || "" } : { ownerNote: result.note || "" }), events: result.event ? [...(item.events || []), result.event] : item.events, updatedAt: new Date().toISOString() } : item;
      setRenterApplications((current) => current.map(applyUpdate));
      setReceivedApplications((current) => current.map(applyUpdate));
      showToast(locale === "zh" ? "申请状态已更新" : "Application status updated");
    } finally {
      setApplicationActionLoadingId(null);
    }
  };

  const applyPopularLocation = (value: string) => {
    setLocationInput(value);
    setAppliedLocation(value);
  };

  const resetFilters = () => {
    setLocationInput("");
    setAppliedLocation("");
    setSelectedPopularAreaId("");
    setMinPrice("");
    setMaxPrice("");
    setMinSqft("");
    setMaxSqft("");
    setBedrooms("");
    setBathrooms("");
    setRentalType("all");
    setMoveIn("");
    setActiveFeatures([]);
    setMobileFiltersOpen(false);
    showToast(locale === "zh" ? "筛选条件已重置" : "Filters reset");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minimum = Number(minPrice);
    const maximum = Number(maxPrice);
    const minimumSqft = Number(minSqft);
    const maximumSqft = Number(maxSqft);
    if (minPrice && maxPrice && Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) {
      showToast(locale === "zh" ? "最低月租不能高于最高月租" : "Minimum rent cannot exceed maximum rent");
      return;
    }
    if (minSqft && maxSqft && Number.isFinite(minimumSqft) && Number.isFinite(maximumSqft) && minimumSqft > maximumSqft) {
      showToast(locale === "zh" ? "最小面积不能大于最大面积" : "Minimum size cannot exceed maximum size");
      return;
    }
    setAppliedLocation(locationInput);
    setMobileFiltersOpen(false);
    showToast(locale === "zh" ? "筛选已应用" : "Filters applied");
  };

  const loadMoreListings = async () => {
    if (remoteLoadingMore) return;
    if (visibleListings.length < filteredListings.length) {
      setVisibleResultCount((current) => current + 6);
      return;
    }
    if (!remoteHasMore) return;
    setRemoteLoadingMore(true);
    try {
      const response = await fetch(`/api/listings?limit=24&offset=${remoteListings.length}&sort=${encodeURIComponent(sortMode)}`, { cache: "no-store" });
      const result = await response.json() as unknown;
      if (!response.ok || !Array.isArray(result)) throw new Error("Listings could not be loaded.");
      setRemoteListings((current) => [...current, ...(result as Listing[])]);
      setRemoteHasMore(response.headers.get("X-Has-More") === "true");
      setVisibleResultCount((current) => current + 6);
    } catch {
      showToast(locale === "zh" ? "更多房源暂时无法加载" : "More listings could not be loaded right now");
    } finally {
      setRemoteLoadingMore(false);
    }
  };

  const removeSavedSearch = async () => {
    setSavedSearch(false);
    setSavedSearchSnapshot(null);
    setSavedAlertFrequency("off");
    setSavedAlertLastSentAt(null);
    if (currentUser?.emailVerified) {
      const response = await fetch("/api/saved-search", { method: "DELETE" }).catch(() => null);
      if (response && !response.ok) {
        showToast(locale === "zh" ? "已从本地移除，但账户同步稍后重试" : "Removed locally; account sync can retry later");
        return;
      }
    }
    showToast(locale === "zh" ? "已取消保存搜索" : "Saved search removed");
  };

  const editSavedSearch = () => {
    if (!savedSearchSnapshot) return;
    const snapshot = savedSearchSnapshot;
    setLocationInput(snapshot.location);
    setAppliedLocation(snapshot.location);
    setSelectedPopularAreaId("");
    setMinPrice(snapshot.minPrice);
    setMaxPrice(snapshot.maxPrice);
    setMinSqft(snapshot.minSqft);
    setMaxSqft(snapshot.maxSqft);
    setBedrooms(snapshot.bedrooms);
    setBathrooms(snapshot.bathrooms);
    setRentalType(snapshot.rentalType);
    setMoveIn(snapshot.moveIn);
    setActiveFeatures([...snapshot.activeFeatures]);
    setSortMode(snapshot.sortMode);
    setSavedOpen(false);
    showToast(locale === "zh" ? "已载入保存的搜索条件" : "Saved search loaded for editing");
  };

  const toggleSavedSearch = async () => {
    if (savedSearch && savedSearchIsCurrent) {
      await removeSavedSearch();
      return;
    }

    const snapshot = { ...searchSnapshot, activeFeatures: [...searchSnapshot.activeFeatures] };
    setSavedSearch(true);
    setSavedSearchSnapshot(snapshot);
    if (currentUser?.emailVerified) {
      const response = await fetch("/api/saved-search", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...snapshot, alertFrequency: savedAlertFrequency }),
      }).catch(() => null);
      if (response && !response.ok) {
        showToast(locale === "zh" ? "已在本地保存，账户同步稍后重试" : "Saved locally; account sync can retry later");
      } else {
        const result = response ? await response.json().catch(() => ({})) as { lastAlertAt?: string | null } : {};
        setSavedAlertLastSentAt(result.lastAlertAt || null);
        showToast(locale === "zh" ? "搜索已保存到账户" : "Search saved to your account");
      }
    } else {
      showToast(locale === "zh" ? "搜索已保存到此浏览器" : "Search saved in this browser");
    }
  };

  const openContact = (listing: Listing) => {
    trackListingEvent(listing.id, "contact");
    setContactListing(listing);
    setSelectedInquiryComments([]);
    setInquiryTourPreference("flexible");
    setInquiryRequestedDate("");
    setInquiryRequestedWindow("any");
    setInquiryMessage("");
    setInquiryTranslation("");
    setInquiryAssistError("");
    setInquiryError("");
  };

  const closeContact = () => {
    setContactListing(null);
    setSelectedInquiryComments([]);
    setInquiryTourPreference("flexible");
    setInquiryRequestedDate("");
    setInquiryRequestedWindow("any");
    setInquiryMessage("");
    setInquiryTranslation("");
    setInquiryAssistError("");
  };

  const applyInquiryQuickAction = (value: string) => {
    setSelectedInquiryComments((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    if (value === "asap") {
      setInquiryRequestedDate((current) => current ? "" : addDaysToDateOnly(todayDateOnly(), 1));
      setInquiryRequestedWindow("any");
    }
  };

  const assistInquiry = async () => {
    if (!contactListing || inquiryAssistLoading) return;
    const form = inquiryFormRef.current;
    if (!form) return;
    setInquiryAssistLoading(true);
    setInquiryAssistError("");
    try {
      const formData = new FormData(form);
      const selectedCommentText = selectedInquiryComments.map((value) => {
        const option = INQUIRY_COMMENT_OPTIONS.find((item) => item.value === value);
        return option ? (locale === "zh" ? option.zh : option.en) : "";
      }).filter(Boolean);
      const response = await fetch("/api/inquiry-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          titleZh: contactListing.titleZh,
          titleEn: contactListing.titleEn,
          areaZh: contactListing.areaZh,
          areaEn: contactListing.areaEn,
          price: contactListing.price,
          bedrooms: contactListing.bedrooms,
          bathrooms: contactListing.bathrooms,
          squareFeet: contactListing.squareFeet,
          moveIn: formData.get("moveIn"),
          leaseLength: formData.get("leaseLength"),
          occupants: formData.get("occupants"),
          pets: formData.get("pets"),
          tourPreference: formData.get("tourPreference"),
          tourRequestedDate: formData.get("tourRequestedDate"),
          tourRequestedWindow: formData.get("tourRequestedWindow"),
          comments: selectedCommentText,
          currentMessage: inquiryMessage,
        }),
      });
      const result = await response.json() as { messageZh?: string; messageEn?: string; error?: string };
      if (!response.ok) throw new Error(result.error || (locale === "zh" ? "AI 咨询助手暂时不可用。" : "The inquiry assistant is unavailable right now."));
      const message = locale === "zh" ? result.messageZh : result.messageEn;
      const translation = locale === "zh" ? result.messageEn : result.messageZh;
      setInquiryMessage(message || "");
      setInquiryTranslation(translation || "");
    } catch (error) {
      setInquiryAssistError(error instanceof Error ? error.message : (locale === "zh" ? "AI 咨询助手暂时不可用。" : "The inquiry assistant is unavailable right now."));
    } finally {
      setInquiryAssistLoading(false);
    }
  };

  const submitInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactListing || inquirySubmitting) return;
    const formData = new FormData(event.currentTarget);
    const selectedCommentText = selectedInquiryComments.map((value) => {
      const option = INQUIRY_COMMENT_OPTIONS.find((item) => item.value === value);
      return option ? `• ${locale === "zh" ? option.zh : option.en}` : "";
    }).filter((comment) => comment.length > 0);
    const freeformMessage = inquiryMessage.trim() || String(formData.get("message") || "").trim();
    const message = [...selectedCommentText, freeformMessage].filter((comment) => comment.length > 0).join("\n");
    const inquiry: Inquiry = {
      id: `inquiry-${inquirySequence.current++}`,
      listingId: contactListing.id,
      listingTitle: listingTitle(contactListing),
      sentAt: new Date().toISOString(),
      moveIn: String(formData.get("moveIn") || ""),
      leaseLength: String(formData.get("leaseLength") || ""),
      occupants: String(formData.get("occupants") || ""),
      pets: String(formData.get("pets") || ""),
      tourPreference: String(formData.get("tourPreference") || ""),
      tourRequestedDate: String(formData.get("tourRequestedDate") || "") || null,
      tourRequestedWindow: String(formData.get("tourRequestedWindow") || "any"),
      message,
      status: "sent",
    };
    if (contactListing.source === "remote" || contactListing.source === "sample" || contactListing.source === "demo") {
      if (!currentUser) {
        setAuthMode("login");
        setAuthError(locale === "zh" ? "请先登录，再发送咨询。" : "Sign in before sending an inquiry.");
        setAuthOpen(true);
        return;
      }
      if (!currentUser.emailVerified) {
        setInquiryError(locale === "zh" ? "请先验证邮箱，再发送咨询。" : "Verify your email before sending an inquiry.");
        closeContact();
        setAccountOpen(true);
        setDashboardTab("listings");
        return;
      }
      setInquirySubmitting(true);
      try {
        const response = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inquiry),
        });
        const result = await response.json() as DashboardInquiry & { error?: string; confirmationSent?: boolean };
        if (!response.ok) throw new Error(result.error || "The inquiry could not be sent.");
        setServerInquiries((current) => [result, ...current]);
        closeContact();
        showToast(result.confirmationSent
          ? (locale === "zh" ? "咨询已发送，确认邮件也已发出" : "Inquiry sent; confirmation email delivered")
          : (locale === "zh" ? "咨询已发送" : "Inquiry sent"));
      } catch (error) {
        setInquiryError(error instanceof Error ? error.message : "The inquiry could not be sent.");
      } finally {
        setInquirySubmitting(false);
      }
      return;
    }
    setInquiries((current) => [inquiry, ...current]);
    closeContact();
    showToast(t.inquirySent);
  };

  const openReportForListing = () => {
    if (!selectedListing) return;
    if (selectedListing.source !== "remote") {
      showToast(locale === "zh" ? "示例房源暂不支持举报" : "Sample listings cannot be reported.");
      return;
    }
    if (!currentUser) {
      setSelectedListing(null);
      setAuthMode("login");
      setAuthError(locale === "zh" ? "请先登录，再举报房源。" : "Sign in before reporting a listing.");
      setAuthOpen(true);
      return;
    }
    setReportError("");
    setReportOpen(true);
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedListing || selectedListing.source !== "remote" || reportLoading) return;
    const formData = new FormData(event.currentTarget);
    setReportLoading(true);
    setReportError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selectedListing.id,
          reason: String(formData.get("reason") || ""),
          details: String(formData.get("details") || ""),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The report could not be submitted.");
      setReportOpen(false);
      setSelectedListing(null);
      showToast(locale === "zh" ? "举报已提交，房源已进入审核队列。" : "Report submitted; the listing has been sent for review.");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "The report could not be submitted.");
    } finally {
      setReportLoading(false);
    }
  };

  const blockSelectedPublisher = async () => {
    if (!selectedListing || selectedListing.source !== "remote" || blockLoadingId) return;
    if (!currentUser) {
      setSelectedListing(null);
      setAuthMode("login");
      setAuthError(locale === "zh" ? "请先登录，再屏蔽发布者。" : "Sign in before blocking a publisher.");
      setAuthOpen(true);
      return;
    }
    setBlockLoadingId(selectedListing.id);
    try {
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: selectedListing.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The publisher could not be blocked.");
      const blockedResponse = await fetch("/api/blocks", { cache: "no-store" });
      if (blockedResponse.ok) {
        const blockedResult = await blockedResponse.json();
        if (Array.isArray(blockedResult)) setBlockedPublishers(blockedResult as BlockedPublisher[]);
      }
      setBlockedListingIds((current) => new Set(current).add(selectedListing.id));
      setSelectedListing(null);
      showToast(locale === "zh" ? "已屏蔽发布者，之后的搜索不会显示其房源。" : "Publisher blocked; future searches will hide their listings.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The publisher could not be blocked.");
    } finally {
      setBlockLoadingId(null);
    }
  };

  const unblockPublisher = async (id: string) => {
    if (blockLoadingId) return;
    setBlockLoadingId(id);
    try {
      const response = await fetch("/api/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedUserId: id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The publisher could not be unblocked.");
      setBlockedPublishers((current) => current.filter((publisher) => publisher.id !== id));
      setBlockedListingIds(new Set());
      showToast(locale === "zh" ? "已取消屏蔽发布者。" : "Publisher unblocked.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The publisher could not be unblocked.");
    } finally {
      setBlockLoadingId(null);
    }
  };

  const validatePostStep = (step: PostStep) => {
    const required = locale === "zh" ? "请补充此步骤的必填信息。" : "Please complete the required fields in this step.";
    if (step === 1 && (!draft.titleZh.trim() || !draft.areaZh.trim() || !draft.privateAddress.trim())) return required;
    if (step === 1 && draft.areaGroupId && !draft.areaLocationId) return locale === "zh" ? "请选择区域 / 城市，或选择手动输入后填写公开区域名称。" : "Choose an area or city, or select manual entry and add a public area label.";
    if (step === 2 && (!draft.price || Number(draft.price) <= 0 || !draft.lease || (draft.moveInMode === "date" && !draft.moveInDate))) return locale === "zh" ? "请填写有效租金、入住方式和租期。" : "Add a valid rent, move-in option, and lease term.";
    if (step === 2 && draft.squareFeet && (!Number.isInteger(Number(draft.squareFeet)) || Number(draft.squareFeet) < 50 || Number(draft.squareFeet) > 100000)) return locale === "zh" ? "请输入 50 至 100,000 之间的建筑面积。" : "Use a square footage value between 50 and 100,000.";
    if (step === 3 && draft.photos.length === 0) return locale === "zh" ? "至少上传一张房源照片。" : "Upload at least one listing photo.";
    if (step === 4 && (!draft.contactName.trim() || !draft.contactEmail.trim() || !draft.contactEmail.includes("@"))) return locale === "zh" ? "请填写姓名和有效邮箱。" : "Add your name and a valid email address.";
    if (step === 4 && draft.agentService === "agentMatch" && draft.agentFeePlan === "flatFee" && (!draft.agentFeeAmount || Number(draft.agentFeeAmount) <= 0)) return locale === "zh" ? "请填写有效的经纪固定费用，或改选其他费用意向。" : "Add a valid agent flat fee or choose another fee preference.";
    if (step === 5 && draft.expiresOn && (!isDateOnly(draft.expiresOn) || draft.expiresOn < todayDateOnly())) return locale === "zh" ? "请选择今天或之后的公开截止日期。" : "Choose today or a future listing expiration date.";
    return "";
  };

  const handlePostNext = () => {
    const error = validatePostStep(postStep);
    if (error) {
      setPostError(error);
      return;
    }
    setPostError("");
    if (postStep < 5) setPostStep((current) => (current + 1) as PostStep);
  };

  const focusQualityTarget = (target?: ListingQualityTarget) => {
    if (!target) return;
    setPostError("");
    setPostStep(target.step as PostStep);
    window.setTimeout(() => {
      const element = document.getElementById(target.id) as HTMLElement | null;
      if (!element) return;
      element.focus();
      element.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 50);
  };

  const movePhoto = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= draft.photos.length) return;
    const media = mediaFromDraft(draft);
    [media[index], media[nextIndex]] = [media[nextIndex], media[index]];
    updateDraft(draftArraysFromMedia(media));
  };

  const processPhotoFiles = async (files: File[]) => {
    const limitedFiles = files.slice(0, 4 - draft.photos.length);
    if (limitedFiles.length === 0) return;
    setMediaUploading(true);
    setPostError("");
    try {
      const nextMedia = [...mediaFromDraft(draft)];
      const fingerprints = new Set(nextMedia.map((media) => media.fingerprint).filter((value): value is string => Boolean(value)));
      for (const file of limitedFiles) {
        const fingerprint = await photoFingerprint(file);
        if (fingerprints.has(fingerprint)) {
          setPostError(locale === "zh" ? "这张照片与已上传照片重复，已跳过。" : "This photo duplicates one already uploaded, so it was skipped.");
          continue;
        }
        const uploaded = await uploadPhotoToR2(file);
        nextMedia.push(uploaded);
        if (uploaded.fingerprint) fingerprints.add(uploaded.fingerprint);
        updateDraft(draftArraysFromMedia(nextMedia.slice(0, 4)));
      }
    } catch (error) {
      console.error("[photo-upload]", error);
      setPostError(photoUploadMessage(error, locale));
    } finally {
      setMediaUploading(false);
    }
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    await processPhotoFiles(files);
    event.target.value = "";
  };

  const polishListingWithAi = async () => {
    if (aiPolishLoading) return;
    setAiPolishLoading(true);
    setLocationContextLoading(true);
    setAiPolishError("");
    setLocationContext(null);
    try {
      const response = await fetch("/api/polish-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleEn: draft.titleEn || draft.titleZh,
          titleZh: draft.titleZh,
          areaEn: draft.areaEn || draft.areaZh,
          areaZh: draft.areaZh,
          privateAddress: draft.privateAddress,
          boroughEn: selectedPostAreaGroup?.en || draft.areaEn,
          boroughZh: selectedPostAreaGroup?.zh || draft.areaZh,
          locale,
          rentalType: draft.rentalType,
          price: draft.price,
          currency: draft.currency,
          squareFeet: draft.squareFeet,
          moveIn: draft.moveInMode === "immediate" ? "立即入住" : draft.moveInDate,
          lease: draft.lease,
          features: draft.features,
          descriptionEn: draft.descriptionEn || draft.descriptionZh,
          descriptionZh: draft.descriptionZh,
          locationLookupOptions: draft.locationLookupOptions,
        }),
      });
      const result = await response.json() as { titleEn?: string; titleZh?: string; descriptionEn?: string; descriptionZh?: string; source?: "openai" | "local"; notes?: string[]; locationContext?: LocationContext | null; error?: string };
      if (!response.ok) throw new Error(result.error || t.polishError);
      setLocationContext(result.locationContext || null);
      updateDraft({
        titleEn: result.titleEn || draft.titleEn || result.titleZh || draft.titleZh,
        titleZh: result.titleZh || draft.titleZh || result.titleEn || draft.titleEn,
        descriptionEn: result.descriptionEn || draft.descriptionEn || result.descriptionZh || draft.descriptionZh,
        descriptionZh: result.descriptionZh || draft.descriptionZh || result.descriptionEn || draft.descriptionEn,
      });
      setAiPolishSource(result.source === "openai" ? "openai" : "local");
      setAiPolishNotes(Array.isArray(result.notes) ? result.notes.slice(0, 3) : []);
      showToast(result.source === "openai" ? t.polishApplied : t.polishLocal);
    } catch (error) {
      setAiPolishError(error instanceof Error ? error.message : t.polishError);
    } finally {
      setLocationContextLoading(false);
      setAiPolishLoading(false);
    }
  };

  const updateSavedSearchAlert = async (frequency: "off" | "daily" | "instant") => {
    setSavedAlertFrequency(frequency);
    if (!currentUser?.emailVerified || !savedSearchSnapshot) return;
    const response = await fetch("/api/saved-search", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...savedSearchSnapshot, alertFrequency: frequency }),
    }).catch(() => null);
    if (!response?.ok) {
      showToast(locale === "zh" ? "提醒设置暂时无法同步" : "Alert setting could not sync right now");
      return;
    }
    const result = await response.json().catch(() => ({})) as { lastAlertAt?: string | null };
    setSavedAlertLastSentAt(result.lastAlertAt || null);
    showToast(frequency === "daily" ? (locale === "zh" ? "已开启每日新房源提醒" : "Daily listing alerts enabled") : (locale === "zh" ? "已关闭搜索提醒" : "Search alerts disabled"));
  };

  const publishLocalListing = async () => {
    const firstError = ([1, 2, 3, 4, 5] as PostStep[]).map(validatePostStep).find(Boolean);
    if (firstError) {
      setPostError(firstError);
      setPostStep(([1, 2, 3, 4, 5] as PostStep[]).find((step) => Boolean(validatePostStep(step))) || 1);
      return;
    }
    if (postSafetyReview.blocking.length > 0) {
      const issue = postSafetyReview.blocking[0];
      setPostError(locale === "zh" ? issue.detailZh : issue.detailEn);
      setPostStep(5);
      return;
    }
    const draftMedia = mediaFromDraft(draft);
    if (draftMedia.length !== draft.photos.length || draftMedia.some((media) => !media.key || !media.url)) {
      setPostError("Please re-upload the listing photos so they can be saved to cloud storage.");
      setPostStep(3);
      return;
    }
    if (publishLoading) return;
    setPublishLoading(true);
    const editingId = editingListingId;
    try {
      const response = await fetch(editingId ? `/api/my/listings/${encodeURIComponent(editingId)}` : "/api/listings", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleZh: draft.titleZh,
          titleEn: draft.titleEn || draft.titleZh,
          areaZh: draft.areaZh,
          areaEn: draft.areaEn || draft.areaZh,
          privateAddress: draft.privateAddress,
          posterRole: draft.posterRole,
          rentalType: draft.rentalType,
          price: draft.price,
          currency: "USD",
          bedrooms: draft.bedrooms,
          bathrooms: draft.bathrooms,
          squareFeet: draft.squareFeet,
          moveIn: draft.moveInMode === "immediate" ? "immediate" : draft.moveInDate,
          lease: draft.lease,
          expiresOn: draft.expiresOn || null,
          features: draft.features,
          descriptionZh: draft.descriptionZh,
          descriptionEn: draft.descriptionEn || draft.descriptionZh,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          tourPreference: draft.tourPreference,
          agentService: draft.agentService,
          agentFeePlan: draft.agentFeePlan,
          agentFeeAmount: draft.agentFeeAmount,
          agentProfileId: draft.agentProfileId,
          media: draftMedia.map((media) => ({
            key: media.key,
            contentType: media.contentType || "image/jpeg",
            thumbnailKey: media.thumbnailKey,
            thumbnailContentType: media.thumbnailContentType,
            width: media.width,
            height: media.height,
          })),
        }),
      });
      const result = await response.json() as Listing & { error?: string; status?: string; code?: string; limit?: number; used?: number; safety?: { blocking?: Array<{ detailZh?: string; detailEn?: string }> } };
      if (!response.ok) {
        if (result.code === "LISTING_LIMIT_REACHED") {
          throw new Error(locale === "zh"
            ? `当前账户已使用 ${result.used || 0} / ${result.limit || 3} 个有效房源额度。完成经纪执照核验后，额度会提高。`
            : (result.error || "Your listing limit has been reached."));
        }
        if (result.code === "AGENT_VERIFICATION_REQUIRED") {
          throw new Error(locale === "zh" ? "完成经纪执照核验后，才可以使用经纪身份发布房源。" : (result.error || "Complete agent license verification before publishing as an agent."));
        }
        if (result.code === "SAFETY_REVIEW_REQUIRED" && result.safety?.blocking?.[0]) {
          throw new Error(locale === "zh" ? (result.safety.blocking[0].detailZh || result.error || "请先修正发布内容。") : (result.safety.blocking[0].detailEn || result.error || "Please fix the listing copy before publishing."));
        }
        throw new Error(result.error || (editingId ? "The listing could not be updated." : "The listing could not be published."));
      }
      if (editingId) {
        const listingResponse = await fetch("/api/listings", { cache: "no-store" });
        if (listingResponse.ok) {
          const listings = await listingResponse.json();
          if (Array.isArray(listings)) {
            setRemoteListings(listings as Listing[]);
            setRemoteHasMore(listingResponse.headers.get("X-Has-More") === "true");
          }
        }
      } else {
        setRemoteListings((current) => [result, ...current]);
        setShareListing(result);
        setShareFeedback("");
      }
      if (currentUser?.emailVerified) await fetch("/api/my/draft", { method: "DELETE" }).catch(() => undefined);
      setDraft(EMPTY_DRAFT);
      setDraftSavedAt(null);
      setDraftSaveState("idle");
      setEditingListingId(null);
      setPostError("");
      setAiPolishSource(null);
      setAiPolishNotes([]);
      setAiPolishError("");
      setPostOpen(false);
      showToast(editingId ? (locale === "zh" ? "房源已更新" : "Listing updated") : (locale === "zh" ? "房源已保存到云端" : "Listing saved to the cloud"));
      return;
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "The listing could not be published.");
      return;
    } finally {
      setPublishLoading(false);
    }

    const roleZh = draft.posterRole === "agent" ? "房产经纪" : "房主";
    const roleEn = draft.posterRole === "agent" ? "Agent" : "Owner";
    const typeZh = draft.rentalType === "privateRoom" ? "独立房间" : draft.rentalType === "sublet" ? "转租" : "整套住房";
    const typeEn = draft.rentalType === "privateRoom" ? "Private room" : draft.rentalType === "sublet" ? "Sublet" : "Entire home";
    const featureLabels = {
      furnished: ["家具齐全", "Furnished"],
      utilities: ["部分费用包含", "Utilities included"],
      parking: ["停车位可询", "Parking available"],
      pets: ["可养宠物", "Pets considered"],
      laundry: ["楼内洗衣房", "Laundry in building"],
      inUnitLaundry: ["室内洗衣机", "In-unit laundry"],
      airConditioning: ["空调", "Air conditioning"],
      dishwasher: ["洗碗机", "Dishwasher"],
      balcony: ["阳台 / 露台", "Balcony / terrace"],
      elevator: ["电梯", "Elevator"],
      gym: ["健身房", "Gym"],
      doorman: ["门卫 / 前台", "Doorman / front desk"],
      storage: ["储物空间", "Storage"],
      naturalLight: ["采光好", "Great natural light"],
      privateEntrance: ["独立出入口", "Private entrance"],
      privateBathroom: ["独立卫生间", "Private bathroom"],
      walkInCloset: ["步入式衣帽间", "Walk-in closet"],
      hardwoodFloors: ["木地板", "Hardwood floors"],
      packageRoom: ["包裹室", "Package room"],
      roofDeck: ["屋顶露台", "Rooftop terrace"],
      nearTransit: ["近公共交通", "Near public transit"],
      shortTerm: ["短租可询", "Short-term lease possible"],
    } as const;
    const tagsZh = draft.features.map((feature) => featureLabels[feature as keyof typeof featureLabels][0]);
    const tagsEn = draft.features.map((feature) => featureLabels[feature as keyof typeof featureLabels][1]);
    const customListing: Listing = {
      id: `local-${Date.now()}`,
      source: "local",
      titleZh: draft.titleZh.trim() || draft.titleEn.trim(),
      titleEn: draft.titleEn.trim() || draft.titleZh.trim(),
      areaZh: draft.areaZh.trim() || draft.areaEn.trim(),
      areaEn: draft.areaEn.trim() || draft.areaZh.trim(),
      type: draft.rentalType,
      typeZh,
      typeEn,
      price: Number(draft.price),
      currency: draft.currency,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      squareFeet: draft.squareFeet ? Number(draft.squareFeet) : null,
      moveIn: draft.moveInMode === "immediate" ? "immediate" : draft.moveInDate,
      lease: `${draft.lease} months`,
      image: draft.photos[0],
      photos: draft.photos,
      photoThumbnails: draft.photoThumbnails,
      media: mediaFromDraft(draft),
      features: draft.features,
      tagsZh,
      tagsEn,
      freshnessZh: "刚刚发布 · 本地预览",
      freshnessEn: "Published just now · local preview",
      posterZh: `${roleZh} · 本地账号`,
      posterEn: `${roleEn} · local account`,
      privacyZh: "精确地址由发布者控制",
      privacyEn: "Poster controls the exact address",
      privateAddress: draft.privateAddress,
      descriptionZh: draft.descriptionZh || draft.descriptionEn,
      descriptionEn: draft.descriptionEn || draft.descriptionZh,
    };
    setCustomListings((current) => [customListing, ...current]);
    setDraft(EMPTY_DRAFT);
    setDraftSavedAt(null);
    setDraftSaveState("idle");
    setPostError("");
    setAiPolishSource(null);
    setAiPolishNotes([]);
    setAiPolishError("");
    setLocationContext(null);
    setPostOpen(false);
    showToast(locale === "zh" ? "房源已发布到本地预览" : "Listing published to this local preview");
  };

  const persistDraftNow = async () => {
    if (!currentUser?.emailVerified) {
      setDraftSaveState("savedLocal");
      return true;
    }
    setDraftSaveState("saving");
    const response = await fetch("/api/my/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, editingListingId }),
    }).catch(() => null);
    const synced = Boolean(response?.ok);
    setDraftSaveState(synced ? "savedAccount" : "offline");
    if (!synced) setDraftRecoveryNotice("offline");
    return synced;
  };

  const clearDraft = async () => {
    setDraft(EMPTY_DRAFT);
    setEditingListingId(null);
    setPostStep(1);
    setPostError("");
    setAiPolishError("");
    setAiPolishSource(null);
    setAiPolishNotes([]);
    setLocationContext(null);
    setDraftSavedAt(null);
    setDraftSaveState("idle");
    setDraftRecoveryNotice(null);
    try {
      window.localStorage.removeItem(STORAGE_KEYS.draft);
      window.localStorage.removeItem(STORAGE_KEYS.draftMeta);
      window.localStorage.removeItem(STORAGE_KEYS.editingListingId);
    } catch {
      // Local storage is optional.
    }
    if (currentUser?.emailVerified) await fetch("/api/my/draft", { method: "DELETE" }).catch(() => undefined);
    showToast(locale === "zh" ? "草稿已清除" : "Draft cleared");
  };

  const saveDraftAndClose = async () => {
    setDraftSavedAt(draftTimestamp());
    const synced = await persistDraftNow();
    setPostOpen(false);
    showToast(!currentUser?.emailVerified
      ? (editingListingId ? (locale === "zh" ? "编辑草稿已保存在此浏览器" : "Edit draft saved in this browser") : (locale === "zh" ? "草稿已保存在此浏览器" : "Draft saved in this browser"))
      : synced
        ? (editingListingId ? (locale === "zh" ? "编辑草稿已同步到账号" : "Edit draft synced to your account") : (locale === "zh" ? "草稿已同步到账号" : "Draft synced to your account"))
        : (locale === "zh" ? "草稿暂时保存在本地，稍后会重试同步" : "Draft saved locally; account sync will retry"));
  };

  const listingTitle = (listing: Listing) => (locale === "zh" ? listing.titleZh : listing.titleEn);
  const listingArea = (listing: Listing) => (locale === "zh" ? toChineseLocationLabel(listing.areaZh || listing.areaEn) : listing.areaEn || listing.areaZh);
  const listingType = (listing: Listing) => (locale === "zh" ? listing.typeZh : listing.typeEn);
  const listingTags = (listing: Listing) => (locale === "zh" ? listing.tagsZh : listing.tagsEn);
  const listingFreshness = (listing: Listing) => (locale === "zh" ? listing.freshnessZh : listing.freshnessEn);
  const listingPoster = (listing: Listing) => (locale === "zh" ? listing.posterZh : listing.posterEn);
  const listingPrivacy = (listing: Listing) => (locale === "zh" ? listing.privacyZh : listing.privacyEn);
  const listingDescription = (listing: Listing) => (locale === "zh" ? listing.descriptionZh : listing.descriptionEn) || "";
  const listingMoveIn = (listing: Listing) => formatMoveIn(listing.moveIn, locale);
  const featureLabel = (feature: string) => {
    const value = t[feature as keyof typeof t];
    return typeof value === "string" ? value : feature;
  };
  const activeFilterLabels: Array<{ key: string; label: string }> = [];
  if (appliedLocation) activeFilterLabels.push({ key: "location", label: appliedLocation });
  if (minPrice) activeFilterLabels.push({ key: "minPrice", label: `${locale === "zh" ? "最低" : "Min"} $${Number(minPrice).toLocaleString("en-US")}` });
  if (maxPrice) activeFilterLabels.push({ key: "maxPrice", label: `${locale === "zh" ? "最高" : "Max"} $${Number(maxPrice).toLocaleString("en-US")}` });
  if (minSqft) activeFilterLabels.push({ key: "minSqft", label: `${locale === "zh" ? "最小面积" : "Min size"} ${Number(minSqft).toLocaleString("en-US")} sq ft` });
  if (maxSqft) activeFilterLabels.push({ key: "maxSqft", label: `${locale === "zh" ? "最大面积" : "Max size"} ${Number(maxSqft).toLocaleString("en-US")} sq ft` });
  if (bedrooms) activeFilterLabels.push({ key: "bedrooms", label: `${bedrooms} ${locale === "zh" ? "卧室" : "bed"}` });
  if (bathrooms) activeFilterLabels.push({ key: "bathrooms", label: `${bathrooms} ${locale === "zh" ? "卫" : "bath"}` });
  if (rentalType !== "all") activeFilterLabels.push({ key: "rentalType", label: rentalType === "entire" ? t.entire : rentalType === "privateRoom" ? t.privateRoom : t.sublet });
  if (moveIn) activeFilterLabels.push({ key: "moveIn", label: moveIn === "august" ? t.august : moveIn === "september" ? t.september : t.october });
  activeFeatures.forEach((feature) => activeFilterLabels.push({ key: `feature:${feature}`, label: featureLabel(feature) }));

  const rankingSummary = sortMode === "fit"
    ? (activeFilterLabels.length > 0 ? t.bestFitSummary : t.bestFitNoFiltersSummary)
    : sortMode === "price"
      ? t.lowestSummary
      : sortMode === "fresh"
        ? t.freshSummary
        : sortMode === "moveIn"
          ? t.soonestSummary
          : sortMode === "verified"
            ? t.verifiedSummary
            : t.popularSummary;
  const rankingLabel = sortMode === "fit"
    ? t.bestFit
    : sortMode === "price"
      ? t.lowest
      : sortMode === "fresh"
        ? t.fresh
        : sortMode === "moveIn"
          ? t.soonest
          : sortMode === "verified"
            ? t.verifiedFirst
            : t.popular;

  const removeFilter = (key: string) => {
    if (key === "location") { setLocationInput(""); setAppliedLocation(""); setSelectedPopularAreaId(""); }
    if (key === "minPrice") setMinPrice("");
    if (key === "maxPrice") setMaxPrice("");
    if (key === "minSqft") setMinSqft("");
    if (key === "maxSqft") setMaxSqft("");
    if (key === "bedrooms") setBedrooms("");
    if (key === "bathrooms") setBathrooms("");
    if (key === "rentalType") setRentalType("all");
    if (key === "moveIn") setMoveIn("");
    if (key.startsWith("feature:")) setActiveFeatures((current) => current.filter((feature) => `feature:${feature}` !== key));
  };
  const listingCompareFeatures = (listing: Listing) => {
    const features = listing.features.map((feature) => featureLabel(feature)).filter(Boolean);
    return features.length > 0 ? features : listingTags(listing);
  };
  const compareFacts: CompareListingFacts[] = compareListings.map((listing) => ({
    id: listing.id,
    title: listingTitle(listing),
    area: listingArea(listing),
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    squareFeet: listing.squareFeet,
    moveIn: listingMoveIn(listing),
    lease: listing.lease,
    features: listingCompareFeatures(listing).slice(0, 8),
    poster: listing.source === "local" ? (locale === "zh" ? "本地账号" : "Local account") : listing.source === "demo" ? (locale === "zh" ? "演示发布" : "Demo post") : listingPoster(listing),
  }));
  const activeCompareSummary = compareSummary && compareSummary.key === compareKey && compareSummary.locale === locale ? compareSummary : null;
  const selectedPhotos = selectedListing ? listingPhotos(selectedListing) : [];
  const handleCompareSummary = async () => {
    if (compareFacts.length !== 2) {
      setCompareSummaryError(locale === "zh" ? "请先选择两套房源。" : "Select two listings first.");
      return;
    }
    const localSummary = buildLocalCompareSummary(compareFacts, locale);
    setCompareSummary({ ...localSummary, key: compareKey, locale, source: "local" });
    setCompareSummaryLoading(true);
    setCompareSummaryError("");
    try {
      const response = await fetch("/api/compare-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, listings: compareFacts }),
      });
      const result = await response.json() as {
        headline?: unknown;
        summary?: unknown;
        bestFor?: unknown;
        tradeoffs?: unknown;
        source?: unknown;
        error?: unknown;
      };
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The comparison summary is unavailable right now.");
      const tradeoffs = Array.isArray(result.tradeoffs) ? result.tradeoffs.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
      setCompareSummary({
        headline: typeof result.headline === "string" && result.headline.trim() ? result.headline : localSummary.headline,
        summary: typeof result.summary === "string" && result.summary.trim() ? result.summary : localSummary.summary,
        bestFor: typeof result.bestFor === "string" && result.bestFor.trim() ? result.bestFor : localSummary.bestFor,
        tradeoffs: tradeoffs.length > 0 ? tradeoffs : localSummary.tradeoffs,
        key: compareKey,
        locale,
        source: result.source === "openai" ? "openai" : "local",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The comparison summary is unavailable right now.";
      setCompareSummaryError(currentUser
        ? message
        : (locale === "zh" ? `本地比较摘要已生成；登录并验证邮箱后可使用 AI 总结（${message}）。` : `A local comparison is ready; sign in and verify your email to use AI summary (${message}).`));
    } finally {
      setCompareSummaryLoading(false);
    }
  };
  const buildListingShareUrl = (listing: Listing) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/?listing=${encodeURIComponent(listing.id)}`;
  };
  const buildListingShareText = (listing: Listing, url: string) => {
    const title = locale === "zh" ? listing.titleZh : listing.titleEn;
    const area = listingArea(listing);
    const type = locale === "zh" ? listing.typeZh : listing.typeEn;
    const tags = listingTags(listing).slice(0, 5);
    const lines = locale === "zh"
      ? [
          `【房源推荐】${title || "房源"}`,
          `位置：${area}`,
          `月租：${formatPrice(listing)}`,
          `户型：${listing.bedrooms === "0" ? "单间" : `${listing.bedrooms} 卧`} · ${listing.bathrooms} 卫${typeof listing.squareFeet === "number" && Number.isFinite(listing.squareFeet) && listing.squareFeet > 0 ? ` · ${listing.squareFeet.toLocaleString("en-US")} 平方英尺` : ""} · ${type}`,
          `入住：${listingMoveIn(listing)}`,
          tags.length > 0 ? `特点：${tags.join(" · ")}` : "",
          url ? `详情：${url}` : "",
        ]
      : [
          `${type}: ${title || "Rental listing"}`,
          `Area: ${area}`,
          `Rent: ${formatPrice(listing)}`,
          `Layout: ${listing.bedrooms === "0" ? "Studio" : `${listing.bedrooms} bed`} · ${listing.bathrooms} bath${typeof listing.squareFeet === "number" && Number.isFinite(listing.squareFeet) && listing.squareFeet > 0 ? ` · ${listing.squareFeet.toLocaleString("en-US")} sq ft` : ""}`,
          `Move-in: ${listingMoveIn(listing)}`,
          tags.length > 0 ? `Features: ${tags.join(" · ")}` : "",
          url ? `Details: ${url}` : "",
        ];
    return lines.filter(Boolean).join("\n");
  };
  const shareUrl = shareListing ? buildListingShareUrl(shareListing) : "";
  const shareText = shareListing ? buildListingShareText(shareListing, shareUrl) : "";
  const wechatShareDetails = useMemo(() => {
    const listing = shareListing || selectedListing;
    if (!listing) return null;
    const title = locale === "zh" ? listing.titleZh : listing.titleEn;
    const area = locale === "zh" ? toChineseLocationLabel(listing.areaZh || listing.areaEn) : listing.areaEn || listing.areaZh;
    const moveIn = formatMoveIn(listing.moveIn, locale);
    const description = locale === "zh"
      ? `${area} · 月租 ${formatPrice(listing)} · ${moveIn}`
      : `${area} · ${formatPrice(listing)} · ${moveIn}`;
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return {
      title: title || (locale === "zh" ? "房源推荐" : "Rental listing"),
      description,
      link: origin ? `${origin}/?listing=${encodeURIComponent(listing.id)}` : "",
      imageUrl: toAbsoluteUrl(listingPhotos(listing)[0] || "/icons/anjurentals-512.png"),
    };
  }, [locale, selectedListing, shareListing]);
  const wechatShareKey = wechatShareDetails ? `${wechatShareDetails.link}|${wechatShareDetails.title}|${wechatShareDetails.imageUrl}` : "";
  const wechatShareStatus: WeChatShareStatus = !wechatShareDetails
    ? "idle"
    : !wechatBrowser
      ? "outside"
      : wechatShareResolution.key === wechatShareKey
        ? wechatShareResolution.status
        : "loading";
  const wechatShareError = wechatShareResolution.key === wechatShareKey ? wechatShareResolution.error : "";

  useEffect(() => {
    const detected = isWeChatBrowser();
    if (!wechatShareDetails || !detected) return;

    let cancelled = false;
    void Promise.resolve().then(() => configureWeChatShare({
      currentUrl: window.location.href.split("#")[0],
      ...wechatShareDetails,
    })).then((result) => {
      if (cancelled) return;
      setWechatShareResolution({ key: wechatShareKey, status: result.configured ? "ready" : "error", error: result.configured ? "" : "unavailable" });
    }).catch((error) => {
      if (cancelled) return;
      setWechatShareResolution({
        key: wechatShareKey,
        status: "error",
        error: error instanceof Error && error.name === "WeChatNotConfigured" ? "not-configured" : "unavailable",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [wechatShareDetails, wechatShareKey]);

  const copySharePayload = async (value: string, successMessage: string) => {
    if (!value) return;
    if (!navigator.clipboard?.writeText) {
      setShareFeedback(locale === "zh" ? "当前浏览器不支持自动复制，请手动选择下方文案。" : "This browser cannot copy automatically. Select the caption below.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setShareFeedback(successMessage);
    } catch {
      setShareFeedback(locale === "zh" ? "复制失败，请手动选择下方文案。" : "Copy failed. Select the caption below.");
    }
  };
  const prepareSharePoster = async () => {
    if (!shareListing) return null;
    if (sharePosterBlob && sharePosterUrl) return { blob: sharePosterBlob, url: sharePosterUrl };
    setSharePosterLoading(true);
    try {
      const blob = await renderSharePoster({
        listing: shareListing,
        locale,
        title: listingTitle(shareListing),
        area: listingArea(shareListing),
        type: listingType(shareListing),
        tags: listingTags(shareListing),
        description: listingDescription(shareListing),
        moveIn: listingMoveIn(shareListing),
        price: formatPrice(shareListing),
        url: shareUrl,
      });
      const url = URL.createObjectURL(blob);
      setSharePosterBlob(blob);
      setSharePosterUrl(url);
      setShareFeedback(locale === "zh" ? "朋友圈海报已生成，可以保存或分享。" : "Your Moments poster is ready to save or share.");
      return { blob, url };
    } catch {
      setShareFeedback(locale === "zh" ? "海报生成失败，请先保存房源图片或直接复制下方文案。" : "The poster could not be generated. Copy the caption below or save the listing photo directly.");
      return null;
    } finally {
      setSharePosterLoading(false);
    }
  };
  const downloadSharePoster = async () => {
    const poster = await prepareSharePoster();
    if (!poster || !shareListing) return;
    const filename = `${shareListing.id.replace(/[^a-z0-9-_]/gi, "-")}-moments-share.jpg`;
    const downloadLink = document.createElement("a");
    downloadLink.href = poster.url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setShareFeedback(locale === "zh" ? "海报已准备好，请在照片中选择并发布到朋友圈。" : "The poster is ready. Select it from Photos when creating your Moments post.");
  };
  const handlePosterShare = async () => {
    const poster = await prepareSharePoster();
    if (!poster || !shareListing) return;
    const filename = `${shareListing.id.replace(/[^a-z0-9-_]/gi, "-")}-moments-share.jpg`;
    const file = new File([poster.blob], filename, { type: poster.blob.type || "image/jpeg" });
    if (Capacitor.isNativePlatform()) {
      try {
        const canShare = await Share.canShare();
        if (canShare.value) {
          const base64 = await blobToBase64(poster.blob);
          const saved = await Filesystem.writeFile({ path: `share-posters/${filename}`, data: base64, directory: Directory.Cache, recursive: true });
          await Share.share({ files: [saved.uri], title: listingTitle(shareListing), text: shareText, url: shareUrl, dialogTitle: locale === "zh" ? "分享房源海报" : "Share listing poster" });
          trackListingEvent(shareListing.id, "share", { channel: "poster" });
          setShareFeedback(locale === "zh" ? "海报已交给手机分享菜单，请选择微信或其他应用。" : "The poster is in the phone share menu. Choose WeChat or another app.");
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    let canShareFile = false;
    try {
      canShareFile = typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    } catch {
      canShareFile = false;
    }
    if (canShareFile) {
      try {
        await navigator.share({ files: [file], title: listingTitle(shareListing), text: shareText, url: shareUrl });
        trackListingEvent(shareListing.id, "share", { channel: "poster" });
        setShareFeedback(locale === "zh" ? "海报已交给系统分享菜单，请选择微信并完成发布。" : "The poster is in the system share menu. Choose WeChat and finish publishing.");
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    await downloadSharePoster();
    await copySharePayload(shareText, locale === "zh" ? "海报已下载，发布文案也已复制。请在微信朋友圈中选择海报并粘贴文案。" : "The poster was downloaded and the caption was copied. Select the poster in Moments and paste the caption.");
    trackListingEvent(shareListing.id, "share", { channel: "poster" });
  };
  const handleNativeShare = async () => {
    if (!shareListing) return;
    if (Capacitor.isNativePlatform()) {
      try {
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({ title: listingTitle(shareListing), text: shareText, url: shareUrl, dialogTitle: locale === "zh" ? "分享房源" : "Share listing" });
          trackListingEvent(shareListing.id, "share", { channel: "native-system" });
          setShareFeedback(locale === "zh" ? "已打开手机分享菜单。" : "The phone share menu is open.");
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: listingTitle(shareListing), text: shareText, url: shareUrl });
        trackListingEvent(shareListing.id, "share", { channel: "system" });
        setShareFeedback(locale === "zh" ? "已打开系统分享菜单。" : "The system share menu is open.");
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    await copySharePayload(`${shareText}\n${shareUrl}`, locale === "zh" ? "分享文案和链接已复制。" : "The caption and link were copied.");
  };
  const handleWeChatMomentsShare = async () => {
    if (!shareListing) return;
    if (wechatBrowser || isWeChatBrowser()) {
      if (wechatShareStatus === "ready") {
        trackListingEvent(shareListing.id, "share", { channel: "wechat-moments" });
        setShareFeedback(locale === "zh"
          ? "微信分享已准备好，请点击右上角 ···，再选择分享到朋友圈。"
          : "WeChat sharing is ready. Tap ··· in the top-right corner, then choose Moments.");
        return;
      }
      if (wechatShareStatus === "loading") {
        setShareFeedback(locale === "zh" ? "正在准备微信分享，请稍候。" : "WeChat sharing is still being prepared.");
        return;
      }
      await copySharePayload(`${shareText}\n${shareUrl}`, locale === "zh"
        ? (wechatShareError === "not-configured" ? "微信原生分享尚未配置，朋友圈文案和链接已复制；请使用海报发布。" : "微信原生分享暂不可用，朋友圈文案和链接已复制；请使用海报发布。")
        : (wechatShareError === "not-configured" ? "Native WeChat sharing is not configured yet. The caption and link were copied; use the poster fallback." : "Native WeChat sharing is unavailable. The caption and link were copied; use the poster fallback."));
      trackListingEvent(shareListing.id, "share", { channel: "wechat-moments-copy" });
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: listingTitle(shareListing), text: shareText, url: shareUrl });
        trackListingEvent(shareListing.id, "share", { channel: "wechat-moments" });
        setShareFeedback(locale === "zh" ? "分享菜单已打开，请选择微信，再选择朋友圈。" : "The share menu is open. Choose WeChat, then Moments.");
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    await copySharePayload(`${shareText}\n${shareUrl}`, locale === "zh" ? "朋友圈文案和链接已复制，请在微信中粘贴分享。" : "The Moments caption and link were copied. Paste them into WeChat to share.");
    trackListingEvent(shareListing.id, "share", { channel: "wechat-moments-copy" });
  };
  const handleChannelShare = async (channel: "wechat" | "tiktok") => {
    const message = channel === "wechat"
      ? (locale === "zh" ? "微信分享文案和链接已复制；请在微信中打开房源页，再点右上角分享。" : "The WeChat caption and link were copied. Open the listing in WeChat, then use the top-right share menu.")
      : (locale === "zh" ? "TikTok 发布文案和链接已复制；请配合房源照片发布。" : "The TikTok caption and link were copied. Add the listing photo when you post.");
    await copySharePayload(`${shareText}\n${shareUrl}`, message);
    if (shareListing) trackListingEvent(shareListing.id, "share", { channel });
  };

  const patchInquiryState = async (id: string, body: { status?: "contacted" | "tourScheduled" | "closed"; revealAddress?: boolean; tourScheduledAt?: string; tourTimeZone?: string; tourNote?: string }) => {
    if (!currentUser?.emailVerified) throw new Error(locale === "zh" ? "请先验证邮箱。" : "Verify your email first.");
    const response = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string; status?: string; tourScheduledAt?: string | null; tourTimeZone?: string; tourNote?: string; addressRevealStatus?: "hidden" | "revealed"; addressRevealedAt?: string | null } | undefined;
    if (!response?.ok) throw new Error(result?.error || (locale === "zh" ? "咨询状态暂时无法更新" : "Inquiry status could not be updated"));
    const applyUpdate = (item: Inquiry) => ({
      ...item,
      ...(typeof result?.status === "string" ? { status: result.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(result || {}, "tourScheduledAt") ? { tourScheduledAt: result?.tourScheduledAt ?? null, tourTimeZone: result?.tourTimeZone || "UTC", tourNote: result?.tourNote || "" } : {}),
      ...(Object.prototype.hasOwnProperty.call(result || {}, "addressRevealStatus") ? { addressRevealStatus: result?.addressRevealStatus || "hidden", addressRevealedAt: result?.addressRevealedAt ?? null } : {}),
    });
    setServerInquiries((current) => current.map((item) => item.id === id ? applyUpdate(item) : item));
    setReceivedInquiries((current) => current.map((item) => item.id === id ? applyUpdate(item) : item));
  };

  const updateInquiryStatus = async (id: string, status: "contacted" | "tourScheduled" | "closed") => {
    try {
      await patchInquiryState(id, { status });
      showToast(locale === "zh" ? "咨询状态已更新" : "Inquiry status updated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : (locale === "zh" ? "咨询状态暂时无法更新" : "Inquiry status could not be updated"));
      throw error;
    }
  };

  const scheduleInquiry = async (id: string, input: { scheduledAt: string; timeZone: string; note: string }) => {
    try {
      await patchInquiryState(id, { status: "tourScheduled", tourScheduledAt: input.scheduledAt, tourTimeZone: input.timeZone, tourNote: input.note });
      showToast(locale === "zh" ? "看房时间已安排" : "Tour scheduled");
    } catch (error) {
      showToast(error instanceof Error ? error.message : (locale === "zh" ? "看房时间暂时无法保存" : "The tour could not be scheduled"));
      throw error;
    }
  };

  const revealInquiryAddress = async (id: string) => {
    try {
      await patchInquiryState(id, { revealAddress: true });
      showToast(locale === "zh" ? "精确地址已分享给租客" : "Exact address shared with the renter");
    } catch (error) {
      showToast(error instanceof Error ? error.message : (locale === "zh" ? "精确地址暂时无法分享" : "The exact address could not be shared"));
      throw error;
    }
  };

  const inquiryStatusLabel = (status: string) => {
    if (status === "contacted") return locale === "zh" ? "已联系" : "Contacted";
    if (status === "tourScheduled") return locale === "zh" ? "已安排看房" : "Tour scheduled";
    if (status === "closed") return locale === "zh" ? "已完成" : "Closed";
    return locale === "zh" ? "已发送" : "Sent";
  };

  const inquiryTourDateLabel = (value: string, timeZone?: string) => {
    try {
      return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timeZone || undefined }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const postStageLabels = [
    { step: 1 as PostStep, label: t.stageProperty },
    { step: 2 as PostStep, label: t.stageTerms },
    { step: 3 as PostStep, label: t.stageStory },
    { step: 4 as PostStep, label: t.stageContact },
    { step: 5 as PostStep, label: t.stagePublish },
  ];
  const completedPostStageCount = ([1, 2, 3, 4] as PostStep[]).filter((step) => postStep > step && !validatePostStep(step)).length;
  const postProgressPercent = Math.round((postStep / postStageLabels.length) * 100);
  const draftSaveLabel = draftSaveState === "saving"
    ? (locale === "zh" ? "正在保存…" : "Saving…")
    : draftSaveState === "savedAccount"
      ? (locale === "zh" ? "已同步到账号" : "Synced to account")
      : draftSaveState === "savedLocal"
        ? (locale === "zh" ? "已保存在此设备" : "Saved on this device")
        : draftSaveState === "offline"
          ? (locale === "zh" ? "已保存本地 · 等待同步" : "Saved locally · sync pending")
          : (locale === "zh" ? "尚未保存" : "Not saved yet");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#rentals">
        {locale === "zh" ? "跳到房源列表" : "Skip to rentals"}
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top" aria-label="Anjurentals home">
            <Image className="brand-logo" src="/brand/anjurentals-mark.svg" alt="" width={30} height={30} aria-hidden="true" priority />
            <span className="brand-wordmark">
              <strong>安居</strong>
              <small>ANJURENTALS</small>
            </span>
          </a>
          <nav className="primary-nav" aria-label={locale === "zh" ? "主要导航" : "Primary navigation"}>
            <a className="active" href="#rentals">{t.findRentals}</a>
            <a href="#saved" onClick={(event) => { event.preventDefault(); setSavedOpen(true); }}>{t.saved}{savedIds.size > 0 ? ` ${savedIds.size}` : ""}</a>
            <a href="#messages" onClick={(event) => { event.preventDefault(); setMessagesOpen(true); }}>{t.messages}{messageInquiries.length > 0 ? ` ${messageInquiries.length}` : ""}</a>
          </nav>
          <div className="topbar-actions">
            <button className="language-switch" type="button" onClick={() => { setCompareSummary(null); setCompareSummaryError(""); setLocale((current) => { const next = current === "zh" ? "en" : "zh"; window.dispatchEvent(new CustomEvent("rental-locale-change", { detail: next })); return next; }); }} aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}>
              <span className="language-dot" aria-hidden="true" />
              {locale === "zh" ? "English" : "中文"}
            </button>
            {currentUser && <button className="desk-link" type="button" onClick={() => setAnalyticsOpen(true)}>{locale === "zh" ? "房源表现" : "Performance"}</button>}
            <NotificationCenter locale={locale} authenticated={Boolean(currentUser?.emailVerified)} onRequireAuth={() => { setAuthMode("login"); setAuthOpen(true); }} />
            <button className="post-button" type="button" onClick={openPostFlow}>
              <span aria-hidden="true">+</span>
              {t.post}
            </button>
            <button className={`avatar-button ${currentUser ? "is-authenticated" : ""}`} type="button" onClick={openAccount} aria-label={currentUser ? currentUser.displayName : t.account}>{currentUser ? currentUser.displayName.slice(0, 1).toUpperCase() : "?"}</button>
          </div>
        </div>
      </header>

      <div className="page-content" id="top">
        <section className="workspace-heading" aria-labelledby="page-title">
          <div className="heading-copy">
            <h1 id="page-title">{t.heading}</h1>
            <p className="heading-subtitle">{t.subheading}</p>
          </div>
          <div className="heading-actions">
            <button className={`outline-button ${savedSearchIsCurrent ? "is-saved" : ""}`} type="button" onClick={toggleSavedSearch}>
              <span className="button-check" aria-hidden="true">{savedSearchIsCurrent ? <CheckIcon /> : ""}</span>
              {savedSearchIsCurrent ? t.savedSearch : (savedSearch ? (locale === "zh" ? "更新保存的搜索" : "Update saved search") : t.saveSearch)}
            </button>
          </div>
        </section>

        <section className="search-workbench" aria-label={locale === "zh" ? "找房工作台" : "Rental search workbench"}>
          <aside ref={filterDialogRef} className={`filter-column ${mobileFiltersOpen ? "is-open" : ""}`} id="rental-filter-desk" role={isMobileViewport ? (mobileFiltersOpen ? "dialog" : "none") : undefined} aria-modal={isMobileViewport && mobileFiltersOpen ? "true" : undefined} aria-hidden={isMobileViewport ? !mobileFiltersOpen : undefined} aria-labelledby={isMobileViewport ? "filter-title" : undefined} inert={isMobileViewport && !mobileFiltersOpen ? true : undefined} tabIndex={isMobileViewport && mobileFiltersOpen ? -1 : undefined}>
            <div className="filter-header">
              <div>
                <span className="section-label">FILTER DESK</span>
                <h2 id="filter-title">{t.filters}</h2>
              </div>
              <div className="filter-header-actions"><button className="text-button" type="button" onClick={resetFilters}>{t.reset}</button><button className="mobile-filter-close" type="button" onClick={() => setMobileFiltersOpen(false)}>{locale === "zh" ? "完成" : "Done"}</button></div>
            </div>

            <form className="filter-form" onSubmit={submitSearch}>
              <label className="field-label" htmlFor="location">{t.location}</label>
              <div className="input-shell search-input-shell">
                <SearchIcon />
                <input id="location" list="location-options" value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder={t.locationPlaceholder} />
              </div>
              <datalist id="location-options">
                {POPULAR_LOCATION_SHORTCUTS.map((shortcut) => <option key={`${shortcut.zh}-${shortcut.value}`} value={shortcut.value}>{shortcut.zh}</option>)}
              </datalist>
              <div className="location-shortcuts" aria-label={t.popularAreas}>
                <div className="location-shortcuts-heading">
                  <span>{t.popularAreas}</span>
                  <span>{t.popularBoroughs}</span>
                </div>
                <div className="location-boroughs">
                  {POPULAR_AREA_GROUPS.map((group) => (
                    <button
                      className={`location-borough ${selectedPopularAreaId === group.id ? "active" : ""}`}
                      type="button"
                      key={group.id}
                      aria-pressed={selectedPopularAreaId === group.id}
                      aria-controls={selectedPopularAreaId === group.id ? "popular-area-options" : undefined}
                      onClick={() => setSelectedPopularAreaId(group.id)}
                    >
                      <strong>{locale === "zh" ? group.zh : group.en}</strong>
                      <small>{locale === "zh" ? group.en : group.zh}</small>
                    </button>
                  ))}
                </div>
                {selectedPopularArea && (
                  <div className="location-area-panel" id="popular-area-options" aria-live="polite">
                    <div className="location-area-panel-heading">
                      <span>{t.popularPlaces}</span>
                      <button className="location-area-collapse" type="button" onClick={() => setSelectedPopularAreaId("")}>{t.collapsePlaces}</button>
                    </div>
                    <div className="location-area-options">
                      <button
                        className={`location-area-option ${locationInput === selectedPopularArea.value ? "active" : ""}`}
                        type="button"
                        onClick={() => applyPopularLocation(selectedPopularArea.value)}
                      >
                        {locale === "zh" ? `全部${selectedPopularArea.zh}` : `All ${selectedPopularArea.en}`}
                      </button>
                      {selectedPopularArea.locations.map((area) => (
                        <button
                          className={`location-area-option ${locationInput === area.value ? "active" : ""}`}
                          type="button"
                          key={area.id}
                          onClick={() => applyPopularLocation(area.value)}
                        >
                          {locale === "zh" ? `${area.zh} / ${area.en}` : `${area.en} / ${area.zh}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="field-note"><LockIcon size={14} />{t.approximate}</p>

              <div className="price-range-fields" aria-label={locale === "zh" ? "月租范围" : "Monthly rent range"}>
                <label className="field-label" htmlFor="min-price">{t.minPrice}
                  <input className="price-input" id="min-price" type="number" min="0" step="50" inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="$1,500" />
                </label>
                <label className="field-label" htmlFor="max-price">{t.maxPrice}
                  <input className="price-input" id="max-price" type="number" min="0" step="50" inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="$3,500" />
                </label>
              </div>

              <div className="price-range-fields size-range-fields" aria-label={locale === "zh" ? "房源面积范围" : "Square footage range"}>
                <label className="field-label" htmlFor="min-sqft">{t.minSqft}
                  <input className="price-input" id="min-sqft" type="number" min="1" step="10" inputMode="numeric" value={minSqft} onChange={(event) => setMinSqft(event.target.value)} placeholder="600" />
                </label>
                <label className="field-label" htmlFor="max-sqft">{t.maxSqft}
                  <input className="price-input" id="max-sqft" type="number" min="1" step="10" inputMode="numeric" value={maxSqft} onChange={(event) => setMaxSqft(event.target.value)} placeholder="1,500" />
                </label>
              </div>

              <div className="filter-field">
                <label className="field-label" htmlFor="bedrooms">{t.bedrooms}</label>
                <select id="bedrooms" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
                  <option value="">{t.anyBedrooms}</option>
                  <option value="0">{t.studio}</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>

              <div className="filter-field">
                <label className="field-label" htmlFor="bathrooms">{t.bathrooms}</label>
                <select id="bathrooms" value={bathrooms} onChange={(event) => setBathrooms(event.target.value)}>
                  <option value="">{t.anyBathrooms}</option>
                  {EXACT_BATHROOM_VALUES.map((value) => <option value={value} key={value}>{value}</option>)}
                </select>
              </div>

              <div className="filter-field">
                <label className="field-label" htmlFor="type">{t.type}</label>
                <select id="type" value={rentalType} onChange={(event) => setRentalType(event.target.value as RentalType)}>
                  <option value="all">{t.allTypes}</option>
                  <option value="entire">{t.entire}</option>
                  <option value="privateRoom">{t.privateRoom}</option>
                  <option value="sublet">{t.sublet}</option>
                </select>
              </div>

              <div className="filter-field">
                <label className="field-label" htmlFor="move-in">{t.moveIn}</label>
                <select id="move-in" value={moveIn} onChange={(event) => setMoveIn(event.target.value)}>
                  <option value="">{t.anytime}</option>
                  <option value="august">{t.august}</option>
                  <option value="september">{t.september}</option>
                  <option value="october">{t.october}</option>
                </select>
              </div>

              <button className="more-filters" type="button" onClick={() => setShowMore((current) => !current)}>
                <SlidersIcon />
                {showMore ? t.less : t.more}
                <span aria-hidden="true">{showMore ? "−" : "+"}</span>
              </button>

              {showMore && (
                <div className="feature-filters">
                  {POST_FEATURE_KEYS.map((key) => (
                    <button className={`feature-chip ${activeFeatures.includes(key) ? "active" : ""}`} key={key} type="button" onClick={() => toggleFeature(key)} aria-pressed={activeFeatures.includes(key)}>
                      <span className="chip-mark" aria-hidden="true">{activeFeatures.includes(key) ? <CheckIcon size={12} /> : ""}</span>
                      {t[key]}
                    </button>
                  ))}
                </div>
              )}

              <button className="primary-button search-button" type="submit"><SearchIcon />{t.search}</button>
            </form>
          </aside>
          {mobileFiltersOpen && <button className="filter-scrim" type="button" onClick={() => setMobileFiltersOpen(false)} aria-label={locale === "zh" ? "关闭筛选条件" : "Close filters"} />}

          <section className="results-column" id="rentals" aria-labelledby="results-heading">
            <button className="mobile-filter-toggle" type="button" onClick={() => setMobileFiltersOpen((current) => !current)} aria-expanded={mobileFiltersOpen} aria-controls="rental-filter-desk">
              <SlidersIcon size={16} />
              <span>{locale === "zh" ? "筛选条件" : "Filters"}</span>
              {activeFilterLabels.length > 0 && <strong>{activeFilterLabels.length}</strong>}
              <span className="mobile-filter-toggle-state">{mobileFiltersOpen ? (locale === "zh" ? "收起" : "Hide") : (locale === "zh" ? "打开" : "Open")}</span>
            </button>
            {activeFilterLabels.length > 0 && <div className="filter-summary" aria-label={locale === "zh" ? "已应用的筛选条件" : "Applied filters"}>
              <span className="filter-summary-label">{locale === "zh" ? "已选条件" : "Applied"}</span>
              <div className="filter-summary-list">
                {activeFilterLabels.map((filter) => <button className="filter-summary-chip" type="button" key={filter.key} onClick={() => removeFilter(filter.key)}>{filter.label}<CloseIcon size={12} /></button>)}
              </div>
              <button className="text-button filter-summary-clear" type="button" onClick={resetFilters}>{t.clear}</button>
            </div>}
            <div className="results-toolbar">
              <div>
                <span className="section-label">{filteredListings.length} / {allListings.length} {locale === "zh" ? "房源" : "listings"}</span>
                <h2 id="results-heading">{t.results}</h2>
              </div>
              <label className="sort-control">
                <span>{t.sort}</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label={t.sort}>
                  <option value="fit">{t.bestFit}</option>
                  <option value="price">{t.lowest}</option>
                  <option value="fresh">{t.fresh}</option>
                  <option value="moveIn">{t.soonest}</option>
                  <option value="verified">{t.verifiedFirst}</option>
                  <option value="popular">{t.popular}</option>
                </select>
              </label>
            </div>

            <details className="search-ranking-note">
              <summary>
                <span className="search-ranking-note-kicker">{t.rankingExplanation}</span>
                <strong>{rankingLabel}</strong>
                <span className="search-ranking-note-toggle" aria-hidden="true">+</span>
              </summary>
              <div className="search-ranking-note-content">
                <p>{rankingSummary}</p>
                {activeFilterLabels.length > 0 && <p className="search-ranking-note-context">
                  {locale === "zh" ? `已应用 ${activeFilterLabels.length} 项筛选条件。` : `${activeFilterLabels.length} search criteria are applied.`}
                </p>}
                <div className="search-ranking-legend" aria-label={locale === "zh" ? "房源新鲜度说明" : "Listing freshness legend"}>
                  <span><i className="freshness-dot freshness-dot-new" aria-hidden="true" />{t.newThisWeek}</span>
                  <span><i className="freshness-dot freshness-dot-updated" aria-hidden="true" />{t.recentlyUpdated}</span>
                </div>
              </div>
            </details>

            {allListings.some((listing) => listing.source === "sample" || listing.source === "local" || listing.source === "demo") && <div className="synthetic-notice" role="note">
              <span className="notice-mark" aria-hidden="true"><i /><i /></span>
              <p>{t.syntheticNotice}</p>
              <button className="notice-action" type="button" onClick={() => showToast(t.addressPrivate)}>{locale === "zh" ? "为什么" : "Why"}</button>
            </div>}

            {remoteListingsError && <div className="live-listing-error" role="alert">
              <div><strong>{locale === "zh" ? "实时房源加载失败" : "Live listings could not be loaded"}</strong><p>{remoteListingsError}</p></div>
              <button className="outline-button" type="button" onClick={() => setRemoteListingsRetry((current) => current + 1)} disabled={remoteListingsLoading}>{remoteListingsLoading ? (locale === "zh" ? "Retrying…" : "Retrying…") : (locale === "zh" ? "重试" : "Retry")}</button>
            </div>}

            <div className="listing-list" aria-busy={remoteListingsLoading}>
              {remoteListingsLoading && allListings.length === 0 ? (
                <div className="listing-loading-state" role="status" aria-live="polite"><span aria-hidden="true" />{locale === "zh" ? "正在加载实时房源…" : "Loading live listings…"}</div>
              ) : filteredListings.length === 0 ? (
                <StatusPanel
                  icon={<SearchIcon size={22} />}
                  title={t.noResults}
                  body={t.noResultsBody}
                  action={<button className="outline-button" type="button" onClick={resetFilters}>{t.clearAndTry}</button>}
                />
              ) : visibleListings.map((listing) => {
                const saved = savedIds.has(listing.id);
                const comparing = compareIds.includes(listing.id);
                const tags = listingTags(listing);
                return (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    featured={visibleListings[0]?.id === listing.id}
                    locale={locale}
                    saved={saved}
                    comparing={comparing}
                    labels={{
                      bed: locale === "zh" ? "卧室" : "bed",
                      bath: locale === "zh" ? "卫" : "bath",
                      squareFeet: locale === "zh" ? "平方英尺" : "sq ft",
                      moveIn: locale === "zh" ? "入住" : "move-in",
                      lease: locale === "zh" ? "租期" : "lease",
                      locationChecked: t.locationChecked,
                      availability: t.availability,
                      verifiedEmail: listing.posterVerificationScope === "agent_license" ? t.verifiedAgent : t.verifiedEmail,
                      photoCount: t.photoCount,
                      approximate: t.approximate,
                      view: t.view,
                      share: locale === "zh" ? "分享" : "Share",
                      compare: t.compare,
                      comparing: t.comparing,
                      contact: t.contact,
                      save: locale === "zh" ? "收藏房源" : "Save listing",
                      removeSaved: locale === "zh" ? "取消收藏" : "Remove from saved",
                      listingBasics: locale === "zh" ? "房源基本信息" : "Listing basics",
                    }}
                    title={listingTitle(listing)}
                    area={listingArea(listing)}
                    type={listingType(listing)}
                    freshness={listingFreshness(listing)}
                    poster={listing.source === "local" ? (locale === "zh" ? "你的本地房源" : "Your local listing") : listing.source === "demo" ? (locale === "zh" ? "演示房源" : "Demo listing") : listingPoster(listing)}
                    privacy={listingPrivacy(listing)}
                    moveInValue={listingMoveIn(listing)}
                    price={formatPrice(listing)}
                    tags={tags}
                    photos={listingPhotos(listing)}
                    thumbnailPhotos={listingPhotoThumbnails(listing)}
                    icons={{
                      pin: (options) => <PinIcon size={options?.size} />,
                      gallery: (options) => <GalleryIcon size={options?.size} />,
                      heart: (options) => <HeartIcon filled={options?.filled} />,
                      share: (options) => <ShareIcon size={options?.size} />,
                      check: (options) => <CheckIcon size={options?.size} />,
                      chat: (options) => <ChatIcon size={options?.size} />,
                      lock: (options) => <LockIcon size={options?.size} />,
                      arrow: (options) => <ArrowIcon size={options?.size} />,
                    }}
                    onOpen={() => openListing(listing)}
                    onSave={() => { void toggleSaved(listing.id); }}
                    onShare={() => openShare(listing)}
                    onCompare={() => toggleCompare(listing.id)}
                    onContact={() => openContact(listing)}
                  />
                );
              })}
            </div>

            {(visibleListings.length < filteredListings.length || remoteHasMore) && <button className="outline-button load-more-button" type="button" onClick={() => { void loadMoreListings(); }} disabled={remoteLoadingMore}>{remoteLoadingMore ? t.loadingMore : t.loadMore}<ArrowIcon size={15} /></button>}

            {compareListings.length > 0 && (
              <aside className="compare-bar" aria-label={t.comparing}>
                <div className="compare-heading">
                  <span className="compare-count">{compareListings.length}</span>
                  <div><strong>{t.comparing}</strong><small>{locale === "zh" ? "把关键条件放在一起看" : "Put the important facts side by side"}</small></div>
                </div>
                <div className="compare-items">
                  {compareListings.map((listing) => <span key={listing.id}>{listingTitle(listing)}<button type="button" onClick={() => toggleCompare(listing.id)} aria-label={`${t.close} ${listingTitle(listing)}`}><CloseIcon size={13} /></button></span>)}
                </div>
                <button className="compare-cta" type="button" onClick={() => setCompareOpen(true)}>{locale === "zh" ? "打开比较" : "Open compare"}<ArrowIcon size={15} /></button>
              </aside>
            )}
          </section>
        </section>

        <section className="guide-rail" aria-label={locale === "zh" ? "产品原则" : "Product principles"}>
          <div className="guide-block privacy-block">
            <span className="guide-icon"><LockIcon /></span>
            <div><h2>{t.privacyGuideTitle}</h2><p>{t.privacyGuideBody}</p></div>
          </div>
          <div className="guide-block">
            <span className="guide-icon blue-icon"><ShieldIcon /></span>
            <div><h2>{t.trustTitle}</h2><p>{t.trustBody}</p></div>
          </div>
          <div className="guide-block">
            <span className="guide-icon lime-icon"><ChatIcon /></span>
            <div><h2>{t.conversationTitle}</h2><p>{t.conversationBody}</p></div>
          </div>
        </section>
      </div>

      {analyticsOpen && currentUser && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAnalyticsOpen(false); }}>
          <aside ref={analyticsDialogRef} className="drawer analytics-drawer" role="dialog" aria-modal="true" aria-labelledby="account-analytics-title" tabIndex={-1}>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">PERFORMANCE DESK</span><button className="drawer-close" type="button" onClick={() => setAnalyticsOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="account-analytics-title">{locale === "zh" ? "房源表现" : "Listing performance"}</h2>
              <p className="drawer-intro">{locale === "zh" ? "用真实互动信号判断哪些房源需要优化、推广或跟进。" : "Use real engagement signals to decide what to improve, promote, or follow up."}</p>
              <ListingAnalyticsPanel locale={locale} />
            </div>
          </aside>
        </div>
      )}

      {savedOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSavedOpen(false); }}>
          <aside ref={savedDialogRef} className="drawer form-drawer" role="dialog" aria-modal="true" aria-labelledby="saved-title" tabIndex={-1}>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">SAVED DESK</span><button className="drawer-close" type="button" onClick={() => setSavedOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="saved-title">{locale === "zh" ? "我保存的房源" : "Saved listings"}</h2>
              <p className="drawer-intro">{currentUser?.emailVerified ? (locale === "zh" ? "收藏已同步到你的账号，可以在其他设备继续查看。" : "Saved listings sync to your account so you can continue on another device.") : (locale === "zh" ? "登录并验证邮箱后，收藏会同步到你的账号；未登录时保存在此浏览器。" : "Verify your account to sync saved listings; signed-out saves stay in this browser.")}</p>
              {currentUser?.emailVerified && savedSearch && savedSearchSnapshot && <section className="saved-search-manager" aria-labelledby="saved-search-manager-title">
                <div className="saved-search-manager-heading"><div><span className="section-label">SEARCH ALERT</span><h3 id="saved-search-manager-title">{locale === "zh" ? "搜索提醒" : "Search alert"}</h3><p>{savedSearchDescription(savedSearchSnapshot)}</p></div><span className={`status-chip ${savedAlertFrequency !== "off" ? "published" : "unpublished"}`}>{savedAlertFrequency === "instant" ? (locale === "zh" ? "即时" : "Instant") : savedAlertFrequency === "daily" ? (locale === "zh" ? "每日" : "Daily") : (locale === "zh" ? "已暂停" : "Paused")}</span></div>
                <div className="saved-search-manager-controls"><label className="field-label" htmlFor="saved-alert-frequency">{locale === "zh" ? "提醒频率" : "Alert frequency"}<select id="saved-alert-frequency" value={savedAlertFrequency} onChange={(event) => { const value = event.target.value; void updateSavedSearchAlert(value === "instant" ? "instant" : value === "daily" ? "daily" : "off"); }}><option value="off">{locale === "zh" ? "暂停提醒" : "Paused"}</option><option value="instant">{locale === "zh" ? "新房源发布后立即提醒" : "As soon as a match is published"}</option><option value="daily">{locale === "zh" ? "每日提醒" : "Every day"}</option></select></label><small>{locale === "zh" ? `上次处理：${savedSearchLastAlertLabel}` : `Last processed: ${savedSearchLastAlertLabel}`}</small></div>
                <small className="saved-search-manager-note">{locale === "zh" ? "即时提醒会在匹配房源发布后出现在站内通知；每日提醒会汇总新房源。Resend 配置完成且邮件提醒开启后，也会发送到邮箱。" : "Instant alerts appear in your inbox when a matching listing is published; daily alerts bundle new matches. With Resend configured and email alerts enabled, they are also sent by email."}</small>
                <div className="saved-search-manager-actions"><button className="outline-button" type="button" onClick={editSavedSearch}>{locale === "zh" ? "编辑条件" : "Edit criteria"}</button><button className="text-button" type="button" onClick={() => { void removeSavedSearch(); }}>{locale === "zh" ? "删除保存的搜索" : "Remove saved search"}</button></div>
              </section>}
              {savedListings.length === 0 ? (
                <div className="drawer-empty"><div className="empty-icon" aria-hidden="true"><HeartIcon /></div><h3>{locale === "zh" ? "还没有收藏" : "Nothing saved yet"}</h3><p>{locale === "zh" ? "在房源照片上点击心形按钮，收藏会出现在这里。" : "Use the heart button on a listing photo to save it here."}</p></div>
              ) : (
                <div className="saved-list">
                  {savedListings.map((listing) => (
                    <button className="saved-item" type="button" key={listing.id} onClick={() => { openListing(listing); setSavedOpen(false); }}>
                    <Image src={listing.image} alt="" width={76} height={62} />
                      <span><strong>{listingTitle(listing)}</strong><small>{listingArea(listing)} · {formatPrice(listing)}</small></span>
                      <ArrowIcon size={15} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {messagesOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessagesOpen(false); }}>
          <aside ref={messagesDialogRef} className="drawer form-drawer" role="dialog" aria-modal="true" aria-labelledby="messages-title" tabIndex={-1}>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">MESSAGE DESK</span><button className="drawer-close" type="button" onClick={() => setMessagesOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="messages-title">{locale === "zh" ? "我的咨询" : "My inquiries"}</h2>
              <p className="drawer-intro">{currentUser?.emailVerified ? (locale === "zh" ? "咨询和看房偏好已保存在你的账号中。" : "Your inquiries and tour preferences are saved to your account.") : (locale === "zh" ? "登录并验证邮箱后，咨询会保存到你的账号；未登录时仅保存在此浏览器。" : "Verify your account to save inquiries to your account; signed-out history stays in this browser.")}</p>
              {messageInquiries.length === 0 ? (
                <div className="drawer-empty"><div className="empty-icon" aria-hidden="true"><ChatIcon /></div><h3>{locale === "zh" ? "还没有消息" : "No inquiries yet"}</h3><p>{locale === "zh" ? "打开一个房源并发送结构化咨询，就会在这里看到记录。" : "Open a listing and send a structured inquiry to see it here."}</p></div>
              ) : (
                <div className="message-list">
                  {messageInquiries.map((inquiry) => (
                    <article className="message-item" key={inquiry.id}>
                      <div className="message-item-top"><strong>{inquiry.listingTitle}</strong><span>{new Date(inquiry.sentAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span></div>
                      <p>{locale === "zh" ? `入住 ${inquiry.moveIn} · ${inquiry.leaseLength} 个月 · ${inquiry.occupants} 位居住者` : `Move-in ${inquiry.moveIn} · ${inquiry.leaseLength} months · ${inquiry.occupants} occupant(s)`}</p>
                      <span className="message-status">{inquiryStatusLabel(inquiry.status)}</span>
                      {(inquiry.tourRequestedDate || (inquiry.tourRequestedWindow && inquiry.tourRequestedWindow !== "any")) && <span className="message-tour-request">{locale === "zh" ? `希望看房：${inquiry.tourRequestedDate || "日期未定"} · ${inquiry.tourRequestedWindow === "weekdayDay" ? "工作日白天" : inquiry.tourRequestedWindow === "weekdayEvening" ? "工作日晚上" : inquiry.tourRequestedWindow === "weekendDay" ? "周末白天" : inquiry.tourRequestedWindow === "weekendEvening" ? "周末晚上" : "时间不限"}` : `Tour request: ${inquiry.tourRequestedDate || "Date flexible"} · ${inquiry.tourRequestedWindow === "weekdayDay" ? "Weekday daytime" : inquiry.tourRequestedWindow === "weekdayEvening" ? "Weekday evening" : inquiry.tourRequestedWindow === "weekendDay" ? "Weekend daytime" : inquiry.tourRequestedWindow === "weekendEvening" ? "Weekend evening" : "Any time"}`}</span>}
                      {inquiry.tourScheduledAt && <span className="message-tour-details">{locale === "zh" ? `看房时间：${inquiryTourDateLabel(inquiry.tourScheduledAt, inquiry.tourTimeZone)}` : `Tour: ${inquiryTourDateLabel(inquiry.tourScheduledAt, inquiry.tourTimeZone)}`}{inquiry.tourTimeZone ? ` · ${inquiry.tourTimeZone}` : ""}{inquiry.tourNote ? ` · ${inquiry.tourNote}` : ""}</span>}
                      {inquiry.revealedAddress && <div className="address-reveal-card"><strong>{locale === "zh" ? "发布者已分享精确地址" : "The owner shared the exact address"}</strong><span>{inquiry.revealedAddress}</span><small>{locale === "zh" ? "请在看房前确认时间、联系人和地址；不要在核实房源和书面租约前支付押金。" : "Confirm the time, contact, and address before the tour. Do not send a deposit before verifying the listing and written lease."}</small></div>}
                      {currentUser?.emailVerified && <div className="message-actions">{!inquiry.readAt && <button className="text-button" type="button" onClick={() => { void fetch(`/api/inquiries/${encodeURIComponent(inquiry.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) }); setServerInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, readAt: new Date().toISOString() } : item)); }}>{locale === "zh" ? "标记已读" : "Mark read"}</button>}{inquiry.status !== "closed" && <button className="text-button" type="button" onClick={() => { void updateInquiryStatus(inquiry.id, "closed"); }}>{locale === "zh" ? "完成咨询" : "Close inquiry"}</button>}</div>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {compareOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompareOpen(false); }}>
          <aside ref={compareDialogRef} className="drawer compare-drawer" role="dialog" aria-modal="true" aria-labelledby="compare-title" tabIndex={-1}>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">COMPARE DESK</span><button className="drawer-close" type="button" onClick={() => setCompareOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="compare-title">{locale === "zh" ? "并排比较房源" : "Compare listings"}</h2>
              <p className="drawer-intro">{locale === "zh" ? "把租金、户型、房源特点、入住时间、租期和发布者信号放在一起看。" : "Put rent, bedrooms, bathrooms, features, timing, lease, and poster signals side by side."}</p>
              <div className="compare-grid">
                {compareListings.map((listing) => (
                  <article className="compare-card" key={listing.id}>
                    <Image src={listing.image} alt="" width={180} height={120} />
                    <strong>{listingTitle(listing)}</strong>
                    <span>{formatPrice(listing)} {t.month}</span>
                    <dl>
                      <div><dt>{t.detailArea}</dt><dd>{listingArea(listing)}</dd></div>
                      <div><dt>{locale === "zh" ? "卧室" : "Bedrooms"}</dt><dd>{listing.bedrooms === "0" ? t.studio : listing.bedrooms}</dd></div>
                      <div><dt>{locale === "zh" ? "卫生间" : "Bathrooms"}</dt><dd>{listing.bathrooms}</dd></div>
                      <div><dt>{locale === "zh" ? "面积" : "Size"}</dt><dd>{typeof listing.squareFeet === "number" && Number.isFinite(listing.squareFeet) && listing.squareFeet > 0 ? `${listing.squareFeet.toLocaleString("en-US")} ${locale === "zh" ? "平方英尺" : "sq ft"}` : (locale === "zh" ? "未提供" : "Not listed")}</dd></div>
                      <div><dt>{t.detailMoveIn}</dt><dd>{listingMoveIn(listing)}</dd></div>
                      <div><dt>{t.detailLease}</dt><dd>{listing.lease}</dd></div>
                      <div className="compare-feature-row"><dt>{locale === "zh" ? "房源特点" : "Features"}</dt><dd className="compare-feature-list">{listingCompareFeatures(listing).slice(0, 8).map((tag, index) => <span className="compare-feature-tag" key={`${tag}-${index}`}>{tag}</span>)}{listingCompareFeatures(listing).length === 0 && <span>—</span>}</dd></div>
                      <div><dt>{t.detailPoster}</dt><dd>{listing.source === "local" ? (locale === "zh" ? "本地账号" : "Local account") : listing.source === "demo" ? (locale === "zh" ? "演示发布" : "Demo post") : listingPoster(listing)}</dd></div>
                    </dl>
                    <button className="outline-button" type="button" onClick={() => { openListing(listing); setCompareOpen(false); }}>{t.view}</button>
                  </article>
                ))}
              </div>
              <section className="compare-summary" aria-labelledby="compare-summary-title">
                <div className="compare-summary-heading">
                  <div><span className="section-label">AI CONCLUSION</span><h3 id="compare-summary-title">{locale === "zh" ? "这两套房源怎么选？" : "Which listing fits better?"}</h3></div>
                  {activeCompareSummary && <span className={`compare-summary-source ${activeCompareSummary.source}`}>{activeCompareSummary.source === "openai" ? "AI" : (locale === "zh" ? "本地摘要" : "Local summary")}</span>}
                </div>
                {compareFacts.length < 2 ? (
                  <div className="compare-summary-empty"><strong>{locale === "zh" ? "再选一套房源" : "Choose one more listing"}</strong><p>{locale === "zh" ? "选择两套房源后，才能生成有意义的并排结论。" : "Select two listings to generate a useful side-by-side conclusion."}</p></div>
                ) : (
                  <>
                    {activeCompareSummary && <div className="compare-summary-body"><strong>{activeCompareSummary.headline}</strong><p>{activeCompareSummary.summary}</p><div className="compare-summary-best"><span>{locale === "zh" ? "适合谁" : "Best for"}</span>{activeCompareSummary.bestFor}</div>{activeCompareSummary.tradeoffs.length > 0 && <ul>{activeCompareSummary.tradeoffs.map((tradeoff, index) => <li key={`${tradeoff}-${index}`}>{tradeoff}</li>)}</ul>}</div>}
                    <button className="primary-button compare-summary-button" type="button" onClick={() => { void handleCompareSummary(); }} disabled={compareSummaryLoading}>{compareSummaryLoading ? (locale === "zh" ? "正在生成总结…" : "Generating summary…") : activeCompareSummary ? (locale === "zh" ? "重新生成 AI 总结" : "Regenerate AI summary") : (locale === "zh" ? "用 AI 总结比较" : "Summarize with AI")}<ArrowIcon size={15} /></button>
                    {compareSummaryError && <p className="compare-summary-note" role="status">{compareSummaryError}</p>}
                    {activeCompareSummary?.source === "local" && !compareSummaryError && <p className="compare-summary-note">{locale === "zh" ? "当前显示本地规则摘要；配置 OPENAI_API_KEY 并验证邮箱后，可生成 AI 结论。" : "This is a local rules-based summary. Configure OPENAI_API_KEY and verify your email to generate an AI conclusion."}</p>}
                  </>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      {postOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPostOpen(false); }}>
          <aside ref={postDialogRef} className="drawer form-drawer post-drawer" role="dialog" aria-modal="true" aria-labelledby="post-title" tabIndex={-1}>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">POSTER WORKFLOW</span><button className="drawer-close" type="button" onClick={() => setPostOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="post-title">{editingListingId ? (locale === "zh" ? "编辑房源" : "Edit listing") : t.postTitle}</h2>
              <p className="drawer-intro">{t.postIntro}</p>
              {draftRecoveryNotice && <div className="draft-recovery-notice" role="status"><div><strong>{draftRecoveryNotice === "local" ? (locale === "zh" ? "已恢复本机草稿" : "Draft restored from this device") : draftRecoveryNotice === "account" ? (locale === "zh" ? "已恢复账号草稿" : "Draft restored from your account") : (locale === "zh" ? "网络暂时不可用，草稿已保留" : "You’re offline; your draft is safe")}</strong><span>{draftRecoveryNotice === "local" ? (locale === "zh" ? "你可以继续编辑，网络恢复后会自动尝试同步。" : "Continue editing; we’ll retry account sync when the connection returns.") : draftRecoveryNotice === "account" ? (locale === "zh" ? "上次保存的内容已加载，可以继续发布。" : "Your last saved version is loaded and ready to continue.") : (locale === "zh" ? "草稿保存在此设备上，不会因为离线而丢失。" : "This draft is stored on this device and won’t be lost while offline.")}</span></div><button className="text-button" type="button" onClick={() => setDraftRecoveryNotice(null)}>{locale === "zh" ? "知道了" : "Got it"}</button></div>}
                {demoMode && !currentUser && <div className="demo-mode-notice" role="note"><strong>{locale === "zh" ? "演示模式" : "Demo mode"}</strong><span>{locale === "zh" ? "无需登录即可发布；请填写联系人信息。" : "No sign-in is needed for this demonstration; enter contact details below."}</span></div>}
                <div className="post-progress"><span>{locale === "zh" ? `第 ${postStep} 步，共 5 步` : `Step ${postStep} of 5`}</span><span>{editingListingId ? (locale === "zh" ? "编辑模式" : "Editing") : draftSavedAt ? (locale === "zh" ? (currentUser?.emailVerified ? "草稿已同步" : "草稿已自动保存") : (currentUser?.emailVerified ? "Draft synced" : "Draft autosaved")) : (currentUser?.emailVerified ? (locale === "zh" ? "账号草稿" : "Account draft") : (locale === "zh" ? "本地草稿" : "Local draft"))}</span></div>
              <div className="post-flow-summary">
                <div className="post-flow-summary-top">
                  <div><span className="section-label">{locale === "zh" ? "发布进度" : "POSTING PROGRESS"}</span><strong>{locale === "zh" ? `已完成 ${completedPostStageCount} / 5 步` : `${completedPostStageCount} of 5 steps complete`}</strong></div>
                  <span className={`draft-save-status ${draftSaveState}`}><span className="draft-save-dot" aria-hidden="true" />{draftSaveLabel}</span>
                </div>
                <div className="post-progress-track" aria-hidden="true"><span style={{ transform: `scaleX(${postProgressPercent / 100})` }} /></div>
                <div className="post-stage-health" role="status">
                  <span>{locale === "zh" ? "可以使用“上一步”返回修改；带“需补充”的步骤还需要信息。" : "Use Back to revise earlier steps; flagged steps still need details."}</span>
                  {postStageLabels.filter(({ step }) => step < postStep && Boolean(validatePostStep(step))).map(({ step, label }) => <button className="post-stage-health-action" type="button" key={step} onClick={() => { setPostStep(step); setPostError(""); }}>{label} · {locale === "zh" ? "需补充" : "Needs details"}</button>)}
                </div>
              </div>
              <div className="stage-list">
                {[t.stageProperty, t.stageTerms, t.stageStory, t.stageContact, t.stagePublish].map((stage, index) => <div className={`stage-row ${index + 1 === postStep ? "is-current" : ""} ${index + 1 < postStep ? "is-complete" : ""}`} key={stage} aria-current={index + 1 === postStep ? "step" : undefined}><span className={`stage-index ${index + 1 <= postStep ? "current" : ""}`}>{index + 1}</span><span>{stage}</span><span className="stage-state">{index + 1 < postStep ? (locale === "zh" ? "完成" : "Done") : index + 1 === postStep ? (locale === "zh" ? "当前" : "Current") : (locale === "zh" ? "待开始" : "Next")}</span></div>)}
              </div>

              {postStep === 1 && (
                <div className="post-form-grid">
                  <div className="post-quick-start field-span-2" role="note"><strong>{locale === "zh" ? "先选一个常用区域，再填写 3 项核心信息" : "Start with a popular area, then add the 3 core details"}</strong><p>{locale === "zh" ? "标题、公开区域和精确地址是第一步必填项；精确地址只用于看房沟通和服务器端附近路线估算。" : "Title, public area, and exact address are required here; the exact address stays private and is used for tour communication and server-side nearby route estimates."}</p></div>
                  <label className="field-label" htmlFor="post-title-zh">{locale === "zh" ? "中文房源标题" : "Listing title"} <span className="field-required">{locale === "zh" ? "必填" : "Required"}</span><input id="post-title-zh" value={draft.titleZh} onChange={(event) => updateDraft({ titleZh: event.target.value })} placeholder={locale === "zh" ? "近地铁的明亮两居" : "Bright two-bedroom near transit"} /></label>
                  <div className="post-location-picker field-span-2" role="group" aria-labelledby="post-location-heading"><div className="post-helper-heading"><span id="post-location-heading">{locale === "zh" ? "公开区域" : "Public area"} <span className="field-required">{locale === "zh" ? "必填" : "Required"}</span></span><small>{locale === "zh" ? "先选行政区 / 地区，再选区域 / 城市" : "Choose a borough or region, then an area or city"}</small></div><p className="field-help">{locale === "zh" ? "公开页面只显示大致区域；精确地址不会放在公开房源中。" : "Public pages show only an approximate area; the exact address stays private."}</p><div className="post-location-grid"><label className="field-label" htmlFor="post-area-group">{locale === "zh" ? "行政区 / 地区" : "Borough / region"}<select id="post-area-group" value={draft.areaGroupId} onChange={(event) => { const group = POPULAR_AREA_GROUPS.find((item) => item.id === event.target.value); updateDraft({ areaGroupId: event.target.value, areaLocationId: "", areaZh: group?.zh || "", areaEn: group?.en || "" }); }}><option value="">{locale === "zh" ? "请选择行政区或地区" : "Choose a borough or region"}</option>{POPULAR_AREA_GROUPS.map((group) => <option value={group.id} key={group.id}>{group.zh} / {group.en}</option>)}</select></label><label className="field-label" htmlFor="post-area-location">{locale === "zh" ? "区域 / 城市" : "Area / city"}<select id="post-area-location" value={draft.areaLocationId} disabled={!selectedPostAreaGroup} onChange={(event) => { const location = selectedPostAreaGroup?.locations.find((item) => item.id === event.target.value); updateDraft({ areaLocationId: event.target.value, areaZh: location?.zh || draft.areaZh, areaEn: location?.en || draft.areaEn }); }}><option value="">{selectedPostAreaGroup ? (locale === "zh" ? "请选择区域或城市" : "Choose an area or city") : (locale === "zh" ? "请先选择行政区 / 地区" : "Choose a borough or region first")}</option>{selectedPostAreaGroup?.locations.map((location) => <option value={location.id} key={location.id}>{location.zh} / {location.en}</option>)}{selectedPostAreaGroup && <option value="custom">{locale === "zh" ? "其他区域 / 手动输入" : "Other area / enter manually"}</option>}</select></label></div></div>
                  <label className="field-label field-span-2" htmlFor="post-area-zh">{locale === "zh" ? "公开区域名称" : "Public area label"} <span className="field-required">{locale === "zh" ? "必填" : "Required"}</span><input id="post-area-zh" value={draft.areaZh} onChange={(event) => updateDraft({ areaZh: event.target.value, areaEn: "", areaLocationId: draft.areaGroupId ? "custom" : "" })} placeholder={locale === "zh" ? "例如：皇后区 · 森林小丘一带" : "Example: Queens · around Forest Hills"} /><span className="field-help">{locale === "zh" ? "选择区域后可继续修改公开名称；建议使用中文，方便本地租客搜索。" : "You can edit the public label after selecting an area; Chinese helps local renters search."}</span></label>
                  <label className="field-label" htmlFor="post-private-address">{locale === "zh" ? "精确地址（私密）" : "Exact address (private)"} <span className="field-required">{locale === "zh" ? "必填" : "Required"}</span><input id="post-private-address" value={draft.privateAddress} onChange={(event) => updateDraft({ privateAddress: event.target.value })} placeholder={locale === "zh" ? "请输入完整街道地址" : "Enter the full street address"} /><span className="field-help">{locale === "zh" ? "只在服务器端用于路线估算和看房沟通；不会发送给 AI 或放在公开房源。" : "Used on the server for route estimates and tour communication; never sent to AI or shown on the public listing."}</span></label>
                  <div className="post-privacy-note"><LockIcon /><div><strong>{t.addressPrivate}</strong><p>不会出现在公开房源卡片；使用 AI 附近参考时，只在服务器端用于 Google 路线估算。</p></div></div>
                  <label className="field-label" htmlFor="post-role">发布者角色<select id="post-role" value={draft.posterRole} onChange={(event) => updateDraft({ posterRole: event.target.value as ListingDraft["posterRole"] })} disabled={Boolean(currentUser) && !canPostAsAgent}><option value="owner">房主</option>{canPostAsAgent && <option value="agent">房产经纪</option>}</select>{currentUser?.accountType === "agent" && !currentUser.agentVerified && <small className="field-help">完成经纪执照核验后，才可使用经纪身份并获得更高发布额度。</small>}{currentUser && currentUser.accountType === "user" && <small className="field-help">普通用户账户按个人房源额度发布。</small>}</label>
                </div>
              )}

              {postStep === 2 && (
                <div className="post-form-grid">
                  <label className="field-label" htmlFor="post-type">{t.type}<select id="post-type" value={draft.rentalType} onChange={(event) => updateDraft({ rentalType: event.target.value as ListingDraft["rentalType"] })}><option value="entire">{t.entire}</option><option value="privateRoom">{t.privateRoom}</option><option value="sublet">{t.sublet}</option></select></label>
                  <label className="field-label" htmlFor="post-price">{locale === "zh" ? "月租" : "Monthly rent"} <span className="field-required">{locale === "zh" ? "必填" : "Required"}</span><input id="post-price" type="number" min="1" value={draft.price} onChange={(event) => updateDraft({ price: event.target.value })} placeholder="2400" /></label>
                  <label className="field-label" htmlFor="post-bedrooms">{locale === "zh" ? "卧室" : "Bedrooms"}<select id="post-bedrooms" value={draft.bedrooms} onChange={(event) => updateDraft({ bedrooms: event.target.value })}><option value="0">Studio</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
                  <label className="field-label" htmlFor="post-bathrooms">{locale === "zh" ? "卫生间" : "Bathrooms"}<select id="post-bathrooms" value={draft.bathrooms} onChange={(event) => updateDraft({ bathrooms: event.target.value })}>{EXACT_BATHROOM_VALUES.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
                  <label className="field-label" htmlFor="post-square-feet">{locale === "zh" ? "建筑面积（平方英尺）" : "Square footage"}<span className="field-optional">{locale === "zh" ? "可选" : "Optional"}</span><input id="post-square-feet" type="number" min="1" step="10" inputMode="numeric" value={draft.squareFeet} onChange={(event) => updateDraft({ squareFeet: event.target.value })} placeholder={locale === "zh" ? "例如 850" : "e.g. 850"} /></label>
                  <label className="field-label" htmlFor="post-move-in-mode">可入住时间<select id="post-move-in-mode" value={draft.moveInMode} onChange={(event) => updateDraft({ moveInMode: event.target.value as ListingDraft["moveInMode"] })}><option value="immediate">{t.immediate}</option><option value="date">{t.chooseDate}</option></select></label>
                  {draft.moveInMode === "date" && <label className="field-label" htmlFor="post-move-in-date">入住日期<input id="post-move-in-date" type="date" value={draft.moveInDate} onInput={(event) => updateDraft({ moveInDate: event.currentTarget.value })} onChange={(event) => updateDraft({ moveInDate: event.target.value })} /></label>}
                  <label className="field-label" htmlFor="post-lease">{locale === "zh" ? "最短租期（月）" : "Minimum lease (months)"}<input id="post-lease" type="number" min="1" value={draft.lease} onChange={(event) => updateDraft({ lease: event.target.value })} /></label>
                  <div className="post-quick-presets field-span-2"><div className="post-quick-presets-group"><span>{locale === "zh" ? "常用月租" : "Common rents"}</span><div className="post-quick-preset-list">{["1500", "2000", "2400", "3000"].map((value) => <button className={`post-quick-preset ${draft.price === value ? "active" : ""}`} key={value} type="button" onClick={() => updateDraft({ price: value })} aria-pressed={draft.price === value}>${Number(value).toLocaleString("en-US")}</button>)}</div></div><div className="post-quick-presets-group"><span>{locale === "zh" ? "常用租期" : "Common terms"}</span><div className="post-quick-preset-list">{["3", "6", "12", "24"].map((value) => <button className={`post-quick-preset ${draft.lease === value ? "active" : ""}`} key={value} type="button" onClick={() => updateDraft({ lease: value })} aria-pressed={draft.lease === value}>{value} {locale === "zh" ? "个月" : "mo"}</button>)}</div></div></div>
                  <div id="post-features" className="field-label feature-field-label" tabIndex={-1}>房源特点（可多选）<div className="feature-filters post-features">{POST_FEATURE_KEYS.map((key) => <button className={`feature-chip ${draft.features.includes(key) ? "active" : ""}`} key={key} type="button" onClick={() => updateDraft({ features: draft.features.includes(key) ? draft.features.filter((item) => item !== key) : [...draft.features, key] })} aria-pressed={draft.features.includes(key)}><span className="chip-mark" aria-hidden="true">{draft.features.includes(key) ? <CheckIcon size={12} /> : ""}</span>{t[key]}</button>)}</div></div>
                </div>
              )}

              {postStep === 3 && (
                <div className="post-form-grid">
                  <label className="field-label field-span-2" htmlFor="post-photos">{locale === "zh" ? "房源照片" : "Listing photos"}<input id="post-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={mediaUploading} onChange={handlePhotoUpload} /><span className="field-help">{locale === "zh" ? `最多 4 张，当前 ${draft.photos.length} 张。支持 JPG、PNG、WebP，照片会上传到云端。` : `Up to 4 photos, ${draft.photos.length} selected. JPG, PNG, and WebP upload to cloud storage.`}</span></label><NativeMediaActions locale={locale} remaining={Math.max(0, 4 - draft.photos.length)} disabled={mediaUploading} onFiles={(files) => processPhotoFiles(files)} />
                  {draft.photos.length > 0 && <div className="photo-preview field-span-2">{draft.photos.map((photo, index) => <div className="photo-preview-item" key={`${photo.slice(0, 24)}-${index}`}><Image src={photo} alt={`${locale === "zh" ? "房源照片" : "Listing photo"} ${index + 1}`} width={112} height={82} /><span className="photo-order">{index === 0 ? (locale === "zh" ? "首图" : "Cover") : index + 1}</span><div className="photo-preview-actions"><button className="photo-action" type="button" onClick={() => movePhoto(index, "up")} disabled={index === 0} aria-label={locale === "zh" ? "设为首图" : "Move photo up"}><ChevronIcon direction="up" /></button><button className="photo-action" type="button" onClick={() => movePhoto(index, "down")} disabled={index === draft.photos.length - 1} aria-label={locale === "zh" ? "照片后移" : "Move photo down"}><ChevronIcon direction="down" /></button><button className="photo-action photo-remove" type="button" onClick={() => updateDraft(draftArraysFromMedia(mediaFromDraft(draft).filter((_, photoIndex) => photoIndex !== index)))} aria-label={locale === "zh" ? `删除照片 ${index + 1}` : `Remove photo ${index + 1}`}><CloseIcon size={14} /></button></div></div>)}</div>}
                  <fieldset className="location-lookup-panel field-span-2">
                    <legend>{t.lookupTitle}</legend>
                    <p className="field-help">{t.lookupHelp}</p>
                    <div className="location-lookup-options">
                      {LOCATION_LOOKUP_OPTIONS.map((option) => {
                        const checked = draft.locationLookupOptions.includes(option);
                        const disabled = aiPolishLoading || (!checked && draft.locationLookupOptions.length >= MAX_LOCATION_LOOKUP_OPTIONS);
                        return <label className={`location-lookup-option ${checked ? "active" : ""} ${disabled ? "disabled" : ""}`} key={option}>
                          <input type="checkbox" checked={checked} disabled={disabled} onChange={() => updateDraft({ locationLookupOptions: checked ? draft.locationLookupOptions.filter((item) => item !== option) : [...draft.locationLookupOptions, option] })} />
                          <span><strong>{LOCATION_LOOKUP_OPTION_COPY[option][locale]}</strong><small>{option === "community" ? (locale === "zh" ? "皇后区查法拉盛市中心；布鲁克林查八大道，并估算公共交通时间和线路" : "Checks Downtown Flushing or Brooklyn 8th Avenue with public-transit time and line details when available") : option === "grocery" ? (locale === "zh" ? "优先查找可验证且距房源合理步行范围内的中文 / 亚洲超市；无法确认时显示并明确标注普通超市" : "Prioritizes a verifiable Chinese / Asian supermarket within a reasonable walking distance; if that cannot be confirmed, it shows a clearly labeled regular supermarket") : option === "transit" ? (locale === "zh" ? "皇后区 / 布鲁克林先查附近公交，没有可验证公交时再查地铁；异常远的站点不会显示" : "Queens / Brooklyn checks a nearby bus stop first, then tries subway only when no verifiable bus result is available; implausibly distant stops are omitted") : (locale === "zh" ? "查找一个代表性地点" : "Checks one representative place")}</small></span>
                        </label>;
                      })}
                    </div>
                    <p className="location-lookup-note">{draft.locationLookupOptions.length === 0 ? t.lookupNone : `${draft.locationLookupOptions.length} ${t.lookupSelected}`}</p>
                  </fieldset>
                  {locationContextLoading && <p className="ai-location-status field-span-2" role="status">{locale === "zh" ? "正在整理所选区域的附近设施和交通参考…" : "Collecting nearby and transit context for the selected area…"}</p>}
                  {!locationContextLoading && locationContext && <p className={`ai-location-status field-span-2 ${locationContext.source === "google" ? "ready" : ""}`} role="status">{locationContext.source === "google" ? (locationContext.routeOrigin === "privateAddress" ? (locale === "zh" ? "已使用私密精确地址加入附近设施和出行时间；地址不会发送给 AI 或公开，发布前请复核。" : "Nearby places and travel times used the private address on the server; the address is not sent to AI or shown publicly. Review before publishing.") : (locale === "zh" ? "已加入大致区域的周边、华人生活圈和出行时间；发布前请复核。" : "Approximate-area nearby places, community destinations, and travel times were added; review before publishing.")) : locationContext.notes[0] || (locale === "zh" ? "没有加入未经验证的周边或交通说法。" : "No unverified nearby or transit claims were added.")}</p>}
                  {!locationContextLoading && locationContext?.source === "google" && (locationContext.destinations.length > 0 || locationContext.nearby.length > 0 || locationContext.transit.length > 0) && <div className="location-context-results field-span-2" role="note">
                    <div className="location-context-heading"><strong>{locale === "zh" ? "Google 返回的附近参考" : "Google-returned nearby references"}</strong><span>{locale === "zh" ? "这些是地图服务返回的地点与路线，发布前请复核。" : "These are map-returned places and routes; review them before publishing."}</span></div>
                    <div className="location-context-meta"><span>{locale === "zh" ? "数据来源：Google 地图" : "Source: Google Maps"}</span><span>{locale === "zh" ? `最后检查：${locationCheckedAtLabel(locationContext.checkedAt, locale)}` : `Last checked: ${locationCheckedAtLabel(locationContext.checkedAt, locale)}`}</span><span>{locale === "zh" ? (locationContext.routeOrigin === "privateAddress" ? "路线起点：私密精确地址（仅服务器）" : "路线起点：大致区域") : (locationContext.routeOrigin === "privateAddress" ? "Route origin: private server-side address" : "Route origin: approximate area")}</span></div>
                    {locationContext.diagnostics && (locationContext.diagnostics.placesQualityIssues > 0 || locationContext.diagnostics.routesQualityIssues > 0) && <p className="location-context-quality-warning">{locale === "zh" ? `已过滤 ${locationContext.diagnostics.placesQualityIssues} 项地点、${locationContext.diagnostics.routesQualityIssues} 项路线结果；原因可能是距离、类别、坐标或调用预算。` : `${locationContext.diagnostics.placesQualityIssues} place and ${locationContext.diagnostics.routesQualityIssues} route result(s) were filtered because of distance, category, coordinates, or call-budget checks.`}</p>}
                    <ul>
                      {locationContext.transit.map((station) => renderTransitContextItem(station, locale))}
                      {locationContext.destinations.map((destination) => <li key={`${destination.mode}-${destination.name}`}>
                        <span>{destination.category}</span>
                        <strong>{destination.name}</strong>
                        <small>{destination.minutes ? (locale === "zh" ? `约 ${destination.minutes} 分钟${destination.mode === "drive" ? "车程" : destination.mode === "transit" ? "公共交通" : "步行"}` : `About ${destination.minutes} minutes by ${destination.mode === "drive" ? "car" : destination.mode === "transit" ? "public transit" : "walking"}`) : (locale === "zh" ? "路线时间暂不可用" : "Travel time unavailable")}</small>
                        {destination.transitLines?.length ? <div className="location-transit-lines"><span className="location-transit-lines-label">{locale === "zh" ? "建议线路" : "Suggested lines"}</span>{destination.transitLines.map((line) => <span className="location-transit-line" key={`${destination.name}-${line.shortName || line.name}`}>{transitLineLabel(line, locale)}</span>)}</div> : null}
                      </li>)}
                      {locationContext.nearby.map((place) => <li key={`nearby-${place.name}`}><span>{place.category}</span><strong>{place.name}</strong><small>{locale === "zh" ? "Google 返回的候选地点；未单独验证路线" : "Google candidate; route not independently verified"}</small></li>)}
                    </ul>
                    {locationContext.notes.length > 1 && <ul className="location-context-notes">{locationContext.notes.slice(1).map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>}
                    <p>{locationContext.routeOrigin === "privateAddress" ? (locale === "zh" ? "以上路线使用私密精确地址计算，精确地址不会显示在公开房源；请发布前复核时间和地点。" : "These routes used the private address on the server; the exact address will not appear on the public listing. Review the times and places before publishing.") : (locale === "zh" ? "以上时间根据所选大致区域估算，不代表精确房屋地址；发布前请复核。" : "Times use the selected approximate area, not the exact property address. Review before publishing.")}</p>
                    <small className="google-attribution">Powered by Google, © 2026 Google</small>
                  </div>}
                  {!locationContextLoading && locationContext?.source === "google" && locationContext.cached && <p className="location-lookup-cache-note" role="status">{t.lookupCached}</p>}
                  <div className="ai-polish-panel field-span-2" role="note">
                    <div className="ai-polish-copy"><span className="ai-polish-mark" aria-hidden="true"><ShieldIcon size={16} /></span><div><strong>{t.polishTitle}</strong><p>{t.polishIntro}</p></div></div>
                    <button className="outline-button ai-polish-button" type="button" onClick={polishListingWithAi} disabled={aiPolishLoading || (!draft.titleZh.trim() && !draft.descriptionZh.trim())}>{aiPolishLoading ? t.polishLoading : t.polishAction}<ArrowIcon size={14} /></button>
                  </div>
                  {aiPolishSource && <p className="ai-polish-status field-span-2" role="status">{aiPolishSource === "openai" ? t.polishApplied : t.polishLocal}</p>}
                  {aiPolishNotes.length > 0 && <div className="ai-polish-notes field-span-2" role="note"><strong>{locale === "zh" ? "发布前请复核" : "Review before publishing"}</strong><ul>{aiPolishNotes.map((note) => <li key={note}>{note}</li>)}</ul></div>}
                  {aiPolishError && <p className="form-error field-span-2" role="alert">{aiPolishError}</p>}
                  <label className="field-label field-span-2" htmlFor="post-description-zh">房源介绍<textarea id="post-description-zh" rows={6} value={draft.descriptionZh} onChange={(event) => updateDraft({ descriptionZh: event.target.value })} placeholder="介绍采光、布局、交通、费用包含内容和其他真实情况。" /></label>
                </div>
              )}

              {postStep === 4 && (
                <div className="post-form-grid">
                  <label className="field-label" htmlFor="post-contact-name">{locale === "zh" ? "联系人姓名" : "Contact name"}<input id="post-contact-name" value={draft.contactName} onChange={(event) => updateDraft({ contactName: event.target.value })} placeholder="Your name" /></label>
                  <label className="field-label" htmlFor="post-contact-email">{locale === "zh" ? "联系邮箱" : "Contact email"}<input id="post-contact-email" type="email" value={draft.contactEmail} onChange={(event) => updateDraft({ contactEmail: event.target.value })} placeholder="you@example.com" /></label>
                  <label className="field-label field-span-2" htmlFor="post-tour-preference">{locale === "zh" ? "看房时间偏好" : "Tour availability"}<select id="post-tour-preference" value={draft.tourPreference} onChange={(event) => updateDraft({ tourPreference: event.target.value })}><option value="flexible">{locale === "zh" ? "时间灵活" : "Flexible"}</option><option value="weekday">{locale === "zh" ? "工作日" : "Weekdays"}</option><option value="weekend">{locale === "zh" ? "周末" : "Weekends"}</option></select></label>
                  <div className="post-privacy-note field-span-2"><LockIcon /><div><strong>{t.addressPrivate}</strong><p>{locale === "zh" ? "看房接受前，公开页面只显示大致区域。" : "Public pages show only the approximate area until a tour is accepted."}</p></div></div>
                  <fieldset className="agent-service-panel field-span-2">
                    <legend className="field-label">{locale === "zh" ? "出租协助（可选）" : "Rental assistance (optional)"}</legend>
                    <p className="field-help">{locale === "zh" ? "默认由你自己管理。需要帮助时，可以请求匹配经纪；发布后由你确认人选和费用，不会自动收费。" : "You manage the rental by default. Request an agent match if you want help; you confirm the person and fee after publishing, with no automatic charge."}</p>
                    <div className="agent-service-options">
                      <label className={`agent-service-option ${draft.agentService === "selfManaged" ? "active" : ""}`}>
                        <input type="radio" name="agent-service" value="selfManaged" checked={draft.agentService === "selfManaged"} onChange={() => updateDraft({ agentService: "selfManaged" })} />
                        <span className="agent-service-option-copy"><strong>{locale === "zh" ? "我自己管理出租" : "I’ll manage the rental"}</strong><small>{locale === "zh" ? "直接接收咨询，不需要经纪协助。" : "Receive inquiries directly without agent assistance."}</small></span>
                      </label>
                      <label className={`agent-service-option ${draft.agentService === "agentMatch" ? "active" : ""}`}>
                        <input type="radio" name="agent-service" value="agentMatch" checked={draft.agentService === "agentMatch"} onChange={() => updateDraft({ agentService: "agentMatch" })} />
                        <span className="agent-service-option-copy"><strong>{locale === "zh" ? "请平台匹配经纪" : "Help me find an agent"}</strong><small>{locale === "zh" ? "让经纪协助推广、筛选租客和安排看房。" : "Get help with promotion, renter screening, and tours."}</small></span>
                      </label>
                    </div>
                    {draft.agentService === "agentMatch" && <div className="agent-assistance-details">
                      <div className="agent-profile-heading"><strong>{locale === "zh" ? "选择经纪（可选）" : "Choose an agent (optional)"}</strong><span>{locale === "zh" ? "也可以先提交匹配请求，之后再确认人选。" : "You can also submit a matching request and choose later."}</span></div>
                      {agentProfilesLoading && <p className="agent-profile-status" role="status">{locale === "zh" ? "正在加载可选经纪…" : "Loading available agents…"}</p>}
                      {agentProfilesError && <p className="agent-profile-error" role="alert">{agentProfilesError}</p>}
                      {!agentProfilesLoading && !agentProfilesError && agentProfiles.length > 0 && <div className="agent-profile-options" role="radiogroup" aria-label={locale === "zh" ? "选择经纪" : "Choose an agent"}>
                        {agentProfiles.map((profile) => <label className={`agent-profile-option ${draft.agentProfileId === profile.id ? "active" : ""}`} key={profile.id}>
                          <input type="radio" name="agent-profile" value={profile.id} checked={draft.agentProfileId === profile.id} onChange={() => updateDraft({ agentProfileId: profile.id })} />
                          <span className={portraitStyles.profileOptionBody}><span className={portraitStyles.profileAvatar} aria-hidden="true">{profile.portraitUrl ? <Image src={profile.portraitUrl} alt="" width={42} height={42} /> : (locale === "zh" ? profile.displayNameZh : profile.displayNameEn).slice(0, 1)}</span><span className="agent-profile-copy"><span className="agent-profile-topline"><strong>{locale === "zh" ? profile.displayNameZh : profile.displayNameEn}</strong><span className={`agent-verification-chip ${profile.isVerified ? "verified" : "sample"}`}>{profile.isVerified ? (locale === "zh" ? "已核验" : "Verified") : (locale === "zh" ? "示例档案" : "Sample profile")}</span></span><small>{profile.brokerage} · {profile.licenseState} · {locale === "zh" ? "州执照已核验" : "State license checked"}</small><p>{profile.serviceAreas.slice(0, 3).join(" · ")} · {profile.languages.join(" / ")}</p></span></span>
                        </label>)}
                      </div>}
                      {!agentProfilesLoading && !agentProfilesError && agentProfiles.length === 0 && <div className="agent-profile-empty" role="note"><strong>{locale === "zh" ? "暂时没有可选经纪" : "No agents are available yet"}</strong><p>{locale === "zh" ? "你仍然可以提交匹配请求；经纪目录准备好后，再选择具体人选。" : "You can still submit a matching request and choose a specific agent when the directory is ready."}</p></div>}
                      <div className="agent-fee-block">
                        <div className="agent-fee-heading"><strong>{locale === "zh" ? "费用意向" : "Fee preference"}</strong><span>{locale === "zh" ? "最终费用需由你与经纪确认。" : "You confirm the final fee with the agent."}</span></div>
                      <div className="agent-fee-options">
                        <label className={`agent-fee-option ${draft.agentFeePlan === "agentQuote" ? "active" : ""}`}><input type="radio" name="agent-fee-plan" value="agentQuote" checked={draft.agentFeePlan === "agentQuote"} onChange={() => updateDraft({ agentFeePlan: "agentQuote" })} /><span>{locale === "zh" ? "先让经纪报价" : "Ask the agent to quote"}</span></label>
                        <label className={`agent-fee-option ${draft.agentFeePlan === "firstMonthRent" ? "active" : ""}`}><input type="radio" name="agent-fee-plan" value="firstMonthRent" checked={draft.agentFeePlan === "firstMonthRent"} onChange={() => updateDraft({ agentFeePlan: "firstMonthRent" })} /><span>{locale === "zh" ? "成交后支付一个月租金" : "One month’s rent after a lease"}</span></label>
                        <label className={`agent-fee-option ${draft.agentFeePlan === "flatFee" ? "active" : ""}`}><input type="radio" name="agent-fee-plan" value="flatFee" checked={draft.agentFeePlan === "flatFee"} onChange={() => updateDraft({ agentFeePlan: "flatFee" })} /><span>{locale === "zh" ? "固定费用" : "Flat fee"}</span></label>
                      </div>
                      {draft.agentFeePlan === "flatFee" && <label className="field-label agent-fee-amount" htmlFor="post-agent-fee-amount">{locale === "zh" ? "预期固定费用" : "Expected flat fee"}<input id="post-agent-fee-amount" type="number" min="1" step="1" value={draft.agentFeeAmount} onChange={(event) => updateDraft({ agentFeeAmount: event.target.value })} placeholder="1500" /></label>}
                      </div>
                    </div>}
                  </fieldset>
                </div>
              )}

              {postStep === 5 && (
                <>
                  <div className="lifecycle-publish-panel">
                    <div>
                      <strong>{locale === "zh" ? "公开期限（可选）" : "Public listing expiration (optional)"}</strong>
                      <p>{draft.expiresOn ? (locale === "zh" ? "到期后，房源会自动从公开搜索中隐藏。你可以在工作台续期。" : "The listing will be hidden from public search after this date. You can renew it from your desk.") : (locale === "zh" ? "不设置截止日期，房源会持续公开，直到你主动暂停。" : "Leave this blank to keep the listing public until you pause it.")}</p>
                    </div>
                    <label className="field-label"><span>{locale === "zh" ? "公开至" : "Public until"}</span><input type="date" min={todayDateOnly()} value={draft.expiresOn} onChange={(event) => updateDraft({ expiresOn: event.target.value })} /></label>
                  </div>
                   <section className={`listing-quality-panel ${listingQuality.attentionCount > 0 ? "has-attention" : "is-ready"}`} aria-labelledby="listing-quality-title">
                     <div className="listing-quality-heading"><div><span className="section-label">QUALITY ASSISTANT</span><h3 id="listing-quality-title">{locale === "zh" ? "发布质量助手" : "Listing quality assistant"}</h3><p>{locale === "zh" ? "发布前检查缺少的信息、描述清晰度、重复照片和异常租金。检查在本地完成，不会把私密地址发送给 AI。" : "Before publishing, check missing facts, description clarity, duplicate photos, and unusual rent. These checks run locally; your private address is not sent to AI."}</p></div><strong aria-label={`${listingQuality.score}%`}>{listingQuality.score}%</strong></div>
                     <div className="listing-quality-bar" role="progressbar" aria-label={locale === "zh" ? "房源质量评分" : "Listing quality score"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={listingQuality.score}><span style={{ width: `${listingQuality.score}%` }} /></div>
                     <p className="listing-quality-summary" role="status">{listingQuality.attentionCount === 0 ? (locale === "zh" ? "当前信息完整，可以继续发布前预览。" : "The listing is in good shape for a final preview.") : (locale === "zh" ? `还有 ${listingQuality.attentionCount} 项值得处理；点击项目可直接回到对应字段。` : `${listingQuality.attentionCount} item(s) need attention; select one to jump back to its field.`)} {listingQuality.comparableCount >= 3 ? (locale === "zh" ? `已使用 ${listingQuality.comparableCount} 套同区域参考检查租金。` : `Rent was checked against ${listingQuality.comparableCount} local comparisons.`) : (locale === "zh" ? "附近可比房源不足，租金仍请人工复核。" : "There are not enough local comparisons; review the rent manually.")}</p>
                     <div className="listing-quality-checks" aria-label={locale === "zh" ? "质量检查项目" : "Quality checks"}>{listingQuality.checks.map((check) => check.done ? <span className="listing-quality-check done" key={check.key}><span className="listing-quality-mark" aria-hidden="true"><CheckIcon size={11} /></span>{locale === "zh" ? check.zh : check.en}</span> : <button className={`listing-quality-check missing ${check.severity}`} key={check.key} type="button" onClick={() => focusQualityTarget(check.target)}><span className="listing-quality-mark" aria-hidden="true" />{locale === "zh" ? check.zh : check.en}<ArrowIcon size={11} /></button>)}</div>
                     {listingQuality.attentionCount > 0 && <div className="listing-quality-issues">{listingQuality.checks.filter((check) => !check.done).map((check) => <article className={`listing-quality-issue ${check.severity}`} key={check.key}><span className="listing-quality-issue-mark" aria-hidden="true">{check.severity === "required" ? "!" : "i"}</span><div><strong>{locale === "zh" ? check.zh : check.en}</strong><p>{locale === "zh" ? check.detailZh : check.detailEn}</p><button className="text-button" type="button" onClick={() => focusQualityTarget(check.target)}>{locale === "zh" ? check.actionZh : check.actionEn}<ArrowIcon size={12} /></button></div></article>)}</div>}
                   </section>
                   <section className={`listing-safety-review ${postSafetyReview.blocking.length > 0 ? "has-blocking" : postSafetyReview.warnings.length > 0 ? "has-warnings" : "is-clear"}`} aria-labelledby="listing-safety-review-title">
                     <div className="listing-safety-review-heading"><div><span className="section-label">SAFETY REVIEW</span><h3 id="listing-safety-review-title">{locale === "zh" ? "发布前安全检查" : "Safety review before publishing"}</h3><p>{locale === "zh" ? "这项检查只针对公开标题和介绍；精确地址与联系人仍保存在私密字段。" : "This checks only the public title and description; the exact address and contact fields remain private."}</p></div><strong>{postSafetyReview.blocking.length > 0 ? (locale === "zh" ? "需修改" : "Fix first") : postSafetyReview.warnings.length > 0 ? (locale === "zh" ? "请复核" : "Review") : (locale === "zh" ? "未发现明显问题" : "No obvious flags")}</strong></div>
                     {postSafetyReview.blocking.length === 0 && postSafetyReview.warnings.length === 0 ? <p className="listing-safety-review-clear">{locale === "zh" ? "目前没有发现明显的住房限制、公开联系方式或高风险付款表述。发布前仍请人工复核事实和费用。" : "No obvious housing restrictions, public contact details, or high-risk payment language were found. Still review facts and fees before publishing."}</p> : <div className="listing-safety-review-list">
                       {postSafetyReview.blocking.map((issue) => <div className="listing-safety-review-item is-blocking" key={issue.key}><span aria-hidden="true">!</span><div><strong>{locale === "zh" ? issue.titleZh : issue.titleEn}</strong><p>{locale === "zh" ? issue.detailZh : issue.detailEn}</p></div></div>)}
                       {postSafetyReview.warnings.map((issue) => <div className="listing-safety-review-item is-warning" key={issue.key}><span aria-hidden="true">!</span><div><strong>{locale === "zh" ? issue.titleZh : issue.titleEn}</strong><p>{locale === "zh" ? issue.detailZh : issue.detailEn}</p></div></div>)}
                     </div>}
                   </section>
                   <div className="post-preview">
                  <div className="preview-photo">{draft.photos[0] ? <Image src={draft.photos[0]} alt="" fill sizes="460px" /> : null}<span>{locale === "zh" ? "公开预览" : "Public preview"}</span></div>
                  <div className="preview-copy"><span className="listing-type">{draft.rentalType === "privateRoom" ? t.privateRoom : draft.rentalType === "sublet" ? t.sublet : t.entire}</span><h3>{draft.titleZh || (locale === "zh" ? "未命名房源" : "Untitled listing")}</h3><p className="listing-area"><PinIcon size={15} />{locale === "zh" ? toChineseLocationLabel(draft.areaZh || "大致区域") : draft.areaEn || draft.areaZh || "Approximate area"}</p><div className="price-line"><strong>{draft.price ? `$${Number(draft.price).toLocaleString("en-US")}` : "—"}</strong><span>{t.month}</span></div><p className="preview-move-in">{t.detailMoveIn}：{draft.moveInMode === "immediate" ? t.immediate : draft.moveInDate || "—"}</p><div className="tag-row">{draft.features.map((feature) => <span className="listing-tag" key={feature}>{featureLabel(feature)}</span>)}</div>{draft.agentService === "agentMatch" && <div className="agent-service-preview"><ShieldIcon size={16} /><div><strong>{selectedAgentProfile ? (locale === "zh" ? `已选择经纪：${selectedAgentProfile.displayNameZh}` : `Agent selected: ${selectedAgentProfile.displayNameEn}`) : (locale === "zh" ? "已请求经纪协助" : "Agent assistance requested")}</strong><p>{draft.agentFeePlan === "firstMonthRent" ? (locale === "zh" ? "费用意向：成交后支付一个月租金" : "Fee preference: one month’s rent after a lease") : draft.agentFeePlan === "flatFee" ? (locale === "zh" ? `费用意向：固定 $${Number(draft.agentFeeAmount || 0).toLocaleString("en-US")}` : `Fee preference: $${Number(draft.agentFeeAmount || 0).toLocaleString("en-US")} flat`) : (locale === "zh" ? "费用意向：请经纪报价" : "Fee preference: agent to quote")}</p></div></div>}<div className="drawer-privacy"><div className="privacy-icon"><LockIcon /></div><div><strong>{t.addressPrivate}</strong><p>精确地址不会出现在公开预览中。</p></div></div></div>
                  </div>
                </>
              )}

              {postError && <p className="form-error" role="alert">{postError}</p>}
              <div className="post-footer-actions">
                <button className="outline-button" type="button" onClick={() => { if (postStep === 1) setPostOpen(false); else setPostStep((current) => (current - 1) as PostStep); }}>{postStep === 1 ? t.close : (locale === "zh" ? "上一步" : "Back")}</button>
                <button className="text-button" type="button" onClick={saveDraftAndClose}>{locale === "zh" ? "保存草稿" : "Save draft"}</button>
                <button className="text-button" type="button" onClick={() => { void clearDraft(); }}>{locale === "zh" ? "清除草稿" : "Clear draft"}</button>
                {postStep < 5 ? <button className="primary-button" type="button" onClick={handlePostNext}>{locale === "zh" ? "下一步" : "Next"}<ArrowIcon /></button> : <button className="primary-button" type="button" disabled={publishLoading || mediaUploading} onClick={publishLocalListing}>{publishLoading ? (locale === "zh" ? "保存中…" : "Saving…") : (editingListingId ? (locale === "zh" ? "保存房源修改" : "Save listing changes") : (locale === "zh" ? "发布云端房源" : "Publish to cloud"))}<CheckIcon /></button>}
              </div>
            </div>
          </aside>
        </div>
      )}

      {shareListing && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareListing(null); }}>
          <aside ref={shareDialogRef} className="drawer share-drawer" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1}>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">SHARE DESK</span><button className="drawer-close" type="button" onClick={() => setShareListing(null)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="share-title">{locale === "zh" ? "房源已发布，发给朋友" : "Your listing is live — share it"}</h2>
              <p className="drawer-intro">{locale === "zh" ? "我们已经准备好房源链接和一段可直接使用的文案。选择一种方式，就可以发到微信、TikTok 或手机的系统分享菜单。" : "Your listing link and a ready-to-use caption are prepared. Choose a route for WeChat, TikTok, or your phone’s system share menu."}</p>
              <div className="share-preview">
                <div className="share-preview-photo">{listingPhotos(shareListing)[0] ? <Image src={listingPhotos(shareListing)[0]} alt="" fill sizes="150px" /> : <div className="image-fallback" aria-hidden="true" />}</div>
                <div className="share-preview-copy"><span className="listing-type">{listingType(shareListing)}</span><h3>{listingTitle(shareListing)}</h3><p className="listing-area"><PinIcon size={14} />{listingArea(shareListing)}</p><strong>{formatPrice(shareListing)}<span className="share-preview-month">{t.month}</span></strong></div>
              </div>
              <section className="share-poster-panel" aria-labelledby="share-poster-title">
                <div className="share-poster-heading">
                  <div><span className="section-label">MOMENTS CARD</span><h3 id="share-poster-title">{locale === "zh" ? "生成朋友圈分享海报" : "Create a Moments share poster"}</h3></div>
                  <span className="share-poster-status">{sharePosterUrl ? <><CheckIcon size={13} />{locale === "zh" ? "已生成" : "Ready"}</> : (locale === "zh" ? "一张图，带走重点" : "One image, key details")}</span>
                </div>
                <p className="share-poster-intro">{locale === "zh" ? "把首图、标题、租金、入住信息和房源链接整理成一张图片；再复制文案，就能在微信朋友圈中快速发布。" : "Combine the first photo, title, rent, move-in details, and listing link into one image, then post it with the copied caption."}</p>
                {sharePosterUrl ? <div className="share-poster-preview"><Image src={sharePosterUrl} alt={locale === "zh" ? "房源朋友圈分享海报预览" : "Listing Moments share poster preview"} width={300} height={375} unoptimized /></div> : <div className="share-poster-placeholder"><ShareIcon size={22} /><strong>{locale === "zh" ? "点击生成海报" : "Tap to generate the poster"}</strong><span>{locale === "zh" ? "图片内含可见房源链接" : "The image includes a visible listing link"}</span></div>}
                <div className="share-poster-actions">
                  <button className="primary-button" type="button" onClick={() => { void handlePosterShare(); }} disabled={sharePosterLoading}><ShareIcon size={15} />{sharePosterLoading ? (locale === "zh" ? "生成中…" : "Preparing…") : (locale === "zh" ? "生成并分享海报" : "Create & share poster")}</button>
                  <button className="outline-button" type="button" onClick={() => { void downloadSharePoster(); }} disabled={sharePosterLoading}><LinkIcon size={15} />{locale === "zh" ? "保存海报" : "Save poster"}</button>
                </div>
                <p className="share-poster-note">{locale === "zh" ? "如果手机没有提供文件分享选项，系统会下载海报并复制文案；打开微信朋友圈后选择海报即可。" : "If file sharing is unavailable, the poster will download and the caption will be copied for Moments."}</p>
              </section>
              <section className={`wechat-share-status wechat-share-status-${wechatShareStatus}`} aria-live="polite">
                <span className="wechat-share-status-icon" aria-hidden="true"><ShareIcon size={17} /></span>
                <div>
                  <strong>
                    {wechatShareStatus === "ready"
                      ? (locale === "zh" ? "微信分享已就绪" : "WeChat sharing is ready")
                      : wechatShareStatus === "loading"
                        ? (locale === "zh" ? "正在准备微信分享" : "Preparing WeChat sharing")
                        : wechatShareStatus === "error"
                          ? (locale === "zh" ? "微信原生分享暂不可用" : "Native WeChat sharing is unavailable")
                          : (locale === "zh" ? "在微信内打开，分享更完整" : "Open inside WeChat for the native share card")}
                  </strong>
                  <p>
                    {wechatShareStatus === "ready"
                      ? (locale === "zh" ? "点击右上角 ···，再选择“分享到朋友圈”。房源标题、缩略图和链接会自动带上。" : "Tap ··· in the top-right corner, then choose Moments. The listing title, thumbnail, and link are ready.")
                      : wechatShareStatus === "loading"
                        ? (locale === "zh" ? "正在验证当前页面和微信分享权限。" : "Verifying this page and its WeChat share permission.")
                        : wechatShareStatus === "error"
                          ? (wechatShareError === "not-configured"
                            ? (locale === "zh" ? "请先配置公众号 AppID、AppSecret 和 JS接口安全域名；仍可使用海报分享。" : "Add the Official Account AppID, AppSecret, and safe domain first. The poster fallback is still available.")
                            : (locale === "zh" ? "微信服务暂时没有接受此页面；仍可使用海报和复制文案。" : "WeChat did not accept this page configuration. The poster and copied-caption fallback are still available."))
                          : (locale === "zh" ? "当前使用外部浏览器；请保存海报并复制文案，或把房源链接发到微信后再打开。" : "You are in an external browser. Save the poster and copy the caption, or open the listing from inside WeChat.")}
                  </p>
                </div>
              </section>
              <div className="share-link-preview">
                <div className="share-link-copy"><LinkIcon size={15} /><span><small>{locale === "zh" ? "房源链接" : "Listing link"}</small><strong>{shareUrl}</strong></span></div>
                <button className="text-button" type="button" onClick={() => { void copySharePayload(shareUrl, locale === "zh" ? "房源链接已复制。" : "Listing link copied."); }}>{locale === "zh" ? "复制" : "Copy"}</button>
              </div>
              <div className="share-actions">
                <button className="share-action share-action-primary" type="button" onClick={() => { void handleWeChatMomentsShare(); }}><ShareIcon /><span><strong>{wechatShareStatus === "ready" ? (locale === "zh" ? "分享到微信朋友圈" : "Share to WeChat Moments") : (locale === "zh" ? "准备微信朋友圈分享" : "Prepare WeChat Moments share")}</strong><small>{wechatShareStatus === "ready" ? (locale === "zh" ? "点击右上角 ···，再选择朋友圈" : "Tap ···, then choose Moments") : (locale === "zh" ? "在微信内打开时自动带上标题、缩略图和链接" : "The title, thumbnail, and link are prepared inside WeChat")}</small></span></button>
                <button className="share-action" type="button" onClick={() => { void handleNativeShare(); }}><ShareIcon /><span><strong>{locale === "zh" ? "打开系统分享" : "Open system share"}</strong><small>{locale === "zh" ? "手机上可直接选择微信等应用" : "Choose an app directly on mobile"}</small></span></button>
                <button className="share-action" type="button" onClick={() => { void handleChannelShare("tiktok"); }}><ShareIcon /><span><strong>TikTok</strong><small>{locale === "zh" ? "复制发布文案和链接，配合照片发布" : "Copy the caption and link, then add your photo"}</small></span></button>
                <button className="share-action" type="button" onClick={() => { void copySharePayload(shareUrl, locale === "zh" ? "房源链接已复制。" : "Listing link copied."); }}><LinkIcon /><span><strong>{locale === "zh" ? "只复制房源链接" : "Copy listing link only"}</strong><small>{locale === "zh" ? "方便粘贴到聊天或群组" : "Paste it into a chat or group"}</small></span></button>
              </div>
              <label className="share-caption-label" htmlFor="share-caption">{locale === "zh" ? "可直接发布的文案" : "Ready-to-post caption"}<textarea id="share-caption" className="share-caption" rows={8} readOnly value={shareText} /></label>
              {shareFeedback && <p className="share-feedback" role="status"><CheckIcon size={15} />{shareFeedback}</p>}
              <p className="share-note">{locale === "zh" ? "微信朋友圈：在微信中打开房源页后，点击右上角分享。TikTok：当前会复制文案和链接；如果以后需要真正一键发布，还需要接入并通过对应平台的官方 API 审核。" : "WeChat Moments: open the listing in WeChat, then use the top-right share menu. TikTok: this first version copies the caption and link; true one-tap posting requires an approved official platform API integration."}</p>
              <div className="share-footer"><button className="outline-button" type="button" onClick={() => setShareListing(null)}>{t.close}</button><button className="primary-button" type="button" onClick={() => { void copySharePayload(shareText, locale === "zh" ? "发布文案已复制。" : "Ready-to-post caption copied."); }}><LinkIcon size={15} />{locale === "zh" ? "复制发布文案" : "Copy caption"}</button></div>
            </div>
          </aside>
        </div>
      )}

      {selectedListing && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedListing(null); }}>
          <aside ref={detailDialogRef} className="drawer detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1}>
            <ListingGallery
              title={listingTitle(selectedListing)}
              photos={selectedPhotos}
              selectedIndex={selectedPhotoIndex}
              approximateLabel={t.approximate}
              photoLabel={locale === "zh" ? "房源照片" : "Listing photos"}
              previousLabel={locale === "zh" ? "上一张房源照片" : "Previous listing photo"}
              nextLabel={locale === "zh" ? "下一张房源照片" : "Next listing photo"}
              closeLabel={t.close}
              expandLabel={locale === "zh" ? "查看大图" : "View fullscreen"}
              lockIcon={(options) => <LockIcon size={options?.size} />}
              closeIcon={(options) => <CloseIcon size={options?.size} />}
              onSelect={setSelectedPhotoIndex}
              onClose={() => setSelectedListing(null)}
            />
            <div className="drawer-content">
              <div className="drawer-heading"><span className="listing-type">{listingType(selectedListing)}</span><button className="drawer-close" type="button" onClick={() => setSelectedListing(null)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="detail-title">{listingTitle(selectedListing)}</h2>
              <p className="listing-area"><PinIcon size={15} />{listingArea(selectedListing)}</p>
              <p className="drawer-intro">{t.detailsIntro}</p>
              <div className="detail-price"><strong>{formatPrice(selectedListing)}</strong><span>{t.month}</span></div>
              <p className="cost-note"><CheckIcon size={13} />{t.costNote}</p>
              <div className="detail-assurance" aria-label={locale === "zh" ? "房源信号" : "Listing signals"}>
                <span className="assurance-item"><span className="assurance-icon verified"><CheckIcon size={12} /></span>{selectedListing.posterVerificationScope === "agent_license" ? t.verifiedAgent : selectedListing.posterVerificationScope === "email" ? t.verifiedEmail : selectedListing.source === "sample" ? t.sampleSignal : t.localSignal}</span>
                <span className="assurance-item"><span className="assurance-icon photo"><GalleryIcon size={12} /></span>{selectedPhotos.length} {t.photoCount}</span>
                <span className="assurance-item"><span className="assurance-icon privacy"><LockIcon size={12} /></span>{t.approximate}</span>
              </div>
              <div className="detail-grid">
                <div><small>{t.detailArea}</small><strong>{listingArea(selectedListing)}</strong></div>
                <div><small>{locale === "zh" ? "建筑面积" : "Square footage"}</small><strong>{typeof selectedListing.squareFeet === "number" && Number.isFinite(selectedListing.squareFeet) && selectedListing.squareFeet > 0 ? `${selectedListing.squareFeet.toLocaleString("en-US")} ${locale === "zh" ? "平方英尺" : "sq ft"}` : (locale === "zh" ? "未提供" : "Not listed")}</strong></div>
                <div><small>{t.detailMoveIn}</small><strong>{listingMoveIn(selectedListing)}</strong></div>
                <div><small>{t.detailLease}</small><strong>{selectedListing.lease}</strong></div>
                <div><small>{t.detailPoster}</small><strong>{listingPoster(selectedListing)}</strong></div>
              </div>
              {listingDescription(selectedListing) && <section className="detail-description">
                <h3 className="drawer-section-heading">{t.detailDescription}</h3>
                <p>{listingDescription(selectedListing)}</p>
              </section>}
              <h3 className="drawer-section-heading">{t.detailAmenities}</h3>
              <div className="tag-row drawer-tags">{listingTags(selectedListing).map((tag) => <span className="listing-tag" key={tag}>{tag}</span>)}</div>
              <div className="drawer-privacy"><div className="privacy-icon"><LockIcon /></div><div><strong>{t.addressPrivate}</strong><p>{listingPrivacy(selectedListing)}</p></div></div>
              <AreaContextPanel locale={locale} areaZh={selectedListing.areaZh} areaEn={selectedListing.areaEn} />
              <CommuteEstimator locale={locale} areaZh={selectedListing.areaZh} areaEn={selectedListing.areaEn} />
              <SafetyNotice
                locale={locale}
                isSample={selectedListing.source === "sample" || selectedListing.source === "demo"}
                verificationScope={selectedListing.posterVerificationScope || "none"}
                isBlocked={blockedListingIds.has(selectedListing.id)}
                onReport={openReportForListing}
                onBlock={() => { void blockSelectedPublisher(); }}
              />
              <DetailActionDock
                contactLabel={t.requestTour}
                applyLabel={locale === "zh" ? "提交租赁申请" : "Submit rental application"}
                compareLabel={t.compare}
                shareLabel={locale === "zh" ? "分享到朋友圈" : "Share to Moments"}
                comparing={compareIds.includes(selectedListing.id)}
                icons={{
                  chat: (options) => <ChatIcon size={options?.size} />,
                  compare: (options) => <CompareIcon size={options?.size} />,
                  share: (options) => <ShareIcon size={options?.size} />,
                }}
                onContact={() => { setSelectedListing(null); openContact(selectedListing); }}
                onApply={() => openApplication(selectedListing)}
                onCompare={() => toggleCompare(selectedListing.id)}
                onShare={() => openShare(selectedListing)}
              />
              <button className="text-button detail-report-button" type="button" onClick={openReportForListing}>{locale === "zh" ? "举报此房源" : "Report this listing"}</button>
            </div>
          </aside>
        </div>
      )}

      {reportOpen && selectedListing && <ReportDrawer locale={locale} listingTitle={listingTitle(selectedListing)} loading={reportLoading} error={reportError} onClose={() => { setReportOpen(false); setReportError(""); }} onSubmit={submitReport} />}

      {contactListing && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeContact(); }}>
          <aside ref={contactDialogRef} className="drawer form-drawer" role="dialog" aria-modal="true" aria-labelledby="contact-title" tabIndex={-1}>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">{contactListing.titleEn}</span><button className="drawer-close" type="button" onClick={closeContact} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="contact-title">{t.contactTitle}</h2>
              <p className="drawer-intro">{t.contactIntro}</p>
              <form key={contactListing.id} ref={inquiryFormRef} className="contact-form" onSubmit={submitInquiry}>
                {inquiryError && <p className="form-error" role="alert">{inquiryError}</p>}
                <section className="inquiry-quick-start" aria-labelledby="inquiry-quick-start-title">
                  <div><span className="section-label">QUICK START</span><h3 id="inquiry-quick-start-title">{locale === "zh" ? "先选一个目的" : "Start with one clear goal"}</h3><p>{locale === "zh" ? "一键加入常用咨询内容；你仍然可以在发送前修改。" : "Add a common intent in one tap; you can edit everything before sending."}</p></div>
                  <div className="inquiry-quick-actions">
                    {["details", "asap", "costs"].map((value) => {
                      const option = INQUIRY_COMMENT_OPTIONS.find((item) => item.value === value);
                      const selected = selectedInquiryComments.includes(value);
                      if (!option) return null;
                      return <button className={`inquiry-quick-action ${selected ? "active" : ""}`} type="button" key={value} onClick={() => applyInquiryQuickAction(value)} aria-pressed={selected}>{selected && <CheckIcon size={13} />}<span>{locale === "zh" ? option.zh : option.en}</span></button>;
                    })}
                  </div>
                </section>
                <label className="field-label" htmlFor="contact-move">{t.intendedMove}</label>
                <select id="contact-move" name="moveIn" defaultValue={contactListing.moveIn === "immediate" ? "immediate" : moveInMonth(contactListing.moveIn) || "september"}><option value="immediate">{locale === "zh" ? "立即入住" : "Move in immediately"}</option><option value="august">{locale === "zh" ? "2026年8月" : "Aug 2026"}</option><option value="september">{locale === "zh" ? "2026年9月" : "Sep 2026"}</option><option value="october">{locale === "zh" ? "2026年10月" : "Oct 2026"}</option></select>
                <label className="field-label" htmlFor="contact-lease">{t.leaseLength}</label>
                <select id="contact-lease" name="leaseLength" defaultValue="12"><option value="6">{locale === "zh" ? "6个月" : "6 months"}</option><option value="12">{locale === "zh" ? "12个月" : "12 months"}</option><option value="24">{locale === "zh" ? "24个月以上" : "24+ months"}</option><option value="undefined">{locale === "zh" ? "未确定" : "Undefined"}</option></select>
                <div className="form-row"><div><label className="field-label" htmlFor="contact-occupants">{t.occupants}</label><select id="contact-occupants" name="occupants" defaultValue="1">{OCCUPANT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div><div><label className="field-label" htmlFor="contact-pets">{t.petsQuestion}</label><select id="contact-pets" name="pets" defaultValue="no"><option value="no">{t.noPets}</option><option value="yes">{t.yesPets}</option></select></div></div>
                <label className="field-label" htmlFor="contact-tour">{locale === "zh" ? "看房偏好" : "Tour preference"}</label>
                <select id="contact-tour" name="tourPreference" value={inquiryTourPreference} onChange={(event) => setInquiryTourPreference(event.target.value)}><option value="flexible">{locale === "zh" ? "时间灵活" : "Flexible"}</option><option value="weekday">{locale === "zh" ? "工作日" : "Weekdays"}</option><option value="weekend">{locale === "zh" ? "周末" : "Weekends"}</option></select>
                <div className="tour-request-fields">
                  <label className="field-label" htmlFor="contact-tour-date"><span>{locale === "zh" ? "希望看房日期（可选）" : "Preferred tour date (optional)"}</span><input id="contact-tour-date" name="tourRequestedDate" type="date" min={todayDateOnly()} value={inquiryRequestedDate} onChange={(event) => setInquiryRequestedDate(event.target.value)} /></label>
                  <label className="field-label" htmlFor="contact-tour-window"><span>{locale === "zh" ? "希望看房时段" : "Preferred time window"}</span><select id="contact-tour-window" name="tourRequestedWindow" value={inquiryRequestedWindow} onChange={(event) => setInquiryRequestedWindow(event.target.value)}>{TOUR_REQUEST_WINDOWS.map((value) => <option value={value} key={value}>{value === "any" ? (locale === "zh" ? "都可以" : "Any time") : value === "weekdayDay" ? (locale === "zh" ? "工作日白天" : "Weekday daytime") : value === "weekdayEvening" ? (locale === "zh" ? "工作日晚上" : "Weekday evening") : value === "weekendDay" ? (locale === "zh" ? "周末白天" : "Weekend daytime") : (locale === "zh" ? "周末晚上" : "Weekend evening")}</option>)}</select></label>
                </div>
                <fieldset className="inquiry-comment-options">
                  <legend className="field-label">{locale === "zh" ? "你想了解什么？（可多选）" : "What would you like to know? (Choose any)"}</legend>
                  <div className="comment-options">
                    {INQUIRY_COMMENT_OPTIONS.map((option) => {
                      const selected = selectedInquiryComments.includes(option.value);
                      return <button className={`comment-option ${selected ? "active" : ""}`} key={option.value} type="button" onClick={() => setSelectedInquiryComments((current) => selected ? current.filter((value) => value !== option.value) : [...current, option.value])} aria-pressed={selected}>{selected && <CheckIcon size={12} />}{locale === "zh" ? option.zh : option.en}</button>;
                    })}
                  </div>
                  <p className="field-help">{locale === "zh" ? "可选择多个，选中的内容会和你的消息一起发送给发布者。" : "Choose any number; selected prompts will be sent with your message."}</p>
                </fieldset>
                <div className="inquiry-assistant-panel">
                  <div className="inquiry-assistant-copy"><span className="inquiry-assistant-mark"><ShieldIcon size={15} /></span><div><strong>{locale === "zh" ? "AI 帮你整理咨询" : "AI inquiry helper"}</strong><p>{locale === "zh" ? "只使用公开房源信息和你刚刚填写的条件，不会索要敏感资料。" : "Uses only public listing facts and the answers above; it never asks for sensitive documents."}</p></div></div>
                  <button className="outline-button inquiry-assistant-button" type="button" onClick={() => { void assistInquiry(); }} disabled={inquiryAssistLoading}>{inquiryAssistLoading ? (locale === "zh" ? "整理中…" : "Preparing…") : (locale === "zh" ? "帮我写一段" : "Help me write")}</button>
                  {inquiryAssistError && <p className="inquiry-assistant-error" role="alert">{inquiryAssistError}</p>}
                  {inquiryTranslation && <details className="inquiry-translation"><summary>{locale === "zh" ? "查看英文翻译" : "View Chinese translation"}</summary><p>{inquiryTranslation}</p></details>}
                </div>
                <label className="field-label" htmlFor="contact-message">{t.message}</label>
                <textarea id="contact-message" name="message" placeholder={t.messagePlaceholder} rows={4} value={inquiryMessage} onChange={(event) => { setInquiryMessage(event.target.value); setInquiryTranslation(""); }} />
                <p className="form-safety"><ShieldIcon size={15} />{locale === "zh" ? "我们不会在这个阶段要求信用资料或受保护特征。" : "We do not ask for credit files or protected traits at this stage."}</p>
                <button className="primary-button full-button" type="submit"><ChatIcon />{t.sendInquiry}</button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {applicationListing && currentUser && <ApplicationDrawer locale={locale} listingTitle={listingTitle(applicationListing)} listingArea={listingArea(applicationListing)} profileDefaults={{ displayName: currentUser.displayName, phone: currentUser.phone }} loading={applicationLoading} error={applicationError} onClose={() => { setApplicationListing(null); setApplicationError(""); }} onSubmit={submitApplication} />}

      {authOpen && <AuthDrawer locale={locale} mode={authMode} loading={authLoading} error={authError} onGoogleLogin={(accountType) => { const query = `?accountType=${encodeURIComponent(accountType || "user")}`; if (Capacitor.isNativePlatform()) { const redirect = new URL(`/api/auth/google${query}&native=1&redirectUri=${encodeURIComponent("com.anjurentals.app://auth/callback")}`, window.location.origin).toString(); void Browser.open({ url: redirect }); return; } window.location.assign(`/api/auth/google${query}`); }} onClose={() => { setAuthOpen(false); setAuthError(""); }} onModeChange={(mode) => { setAuthMode(mode); setAuthError(""); }} onSubmit={handleAuthSubmit} />}

      {accountOpen && currentUser && <AccountDrawer locale={locale} user={currentUser} tab={dashboardTab} listings={dashboardListings} inquiries={receivedInquiries} applications={renterApplications} receivedApplications={receivedApplications} agentRequests={agentRequests} blockedPublishers={blockedPublishers} blockLoadingId={blockLoadingId} canManageAgentRequests={canManageAgentRequests} agentRequestLoadingId={agentRequestLoadingId} applicationActionLoadingId={applicationActionLoadingId} loading={dashboardLoading} error={dashboardError} resendLoading={resendLoading} resendError={resendError} onClose={() => setAccountOpen(false)} onTabChange={setDashboardTab} onLogout={handleLogout} onResendVerification={handleResendVerification} onUpdateProfile={handleProfileUpdate} onAgentVerificationStatusChange={handleAgentVerificationStatusChange} onViewListing={viewDashboardListing} onEditListing={editDashboardListing} onSetListingStatus={handleDashboardStatus} onRenewListing={handleRenewListing} onAgentRequestDecision={handleAgentRequestDecision} onInquiryStatusChange={(id, status) => updateInquiryStatus(id, status)} onScheduleInquiry={scheduleInquiry} onRevealInquiryAddress={revealInquiryAddress} onApplicationStatusChange={updateApplicationStatus} onUnblockPublisher={unblockPublisher} onListingOperationalChange={(id, updates) => setDashboardListings((current) => current.map((listing) => listing.id === id ? { ...listing, ...updates } : listing))} />}

      {(toast || verificationNotice) && <div className="toast" role="status"><span className="toast-mark"><CheckIcon size={13} /></span>{toast || verificationNotice}</div>}

      <SiteFooter />
    </div>
  );
}

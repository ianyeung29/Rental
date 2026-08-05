"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import AccountDrawer from "./components/AccountDrawer";
import AuthDrawer from "./components/AuthDrawer";
import DetailActionDock from "./components/DetailActionDock";
import ListingCard from "./components/ListingCard";
import ListingGallery from "./components/ListingGallery";
import ReportDrawer from "./components/ReportDrawer";
import SiteFooter from "./components/SiteFooter";
import StatusPanel from "./components/StatusPanel";
import { AccountType, AgentVerificationStatus } from "./lib/account-types";
import { demoModeEnabled } from "./lib/demo";
import { toChineseLocationLabel } from "./lib/location-labels";
import { configureWeChatShare, isWeChatBrowser, toAbsoluteUrl } from "./lib/wechat-client";
import { buildLocalCompareSummary, CompareListingFacts, CompareSummaryContent } from "./lib/compare-summary";
import { DEFAULT_LOCATION_LOOKUP_OPTIONS, LOCATION_LOOKUP_OPTIONS, MAX_LOCATION_LOOKUP_OPTIONS } from "./lib/location-context";
import type { LocationContext, LocationLookupOption } from "./lib/location-context";

type Locale = "zh" | "en";
type RentalType = "all" | "entire" | "privateRoom" | "sublet";
type SortMode = "fit" | "price" | "fresh" | "moveIn" | "verified";
type WeChatShareStatus = "idle" | "outside" | "loading" | "ready" | "error";
type WeChatShareResolution = { key: string; status: Exclude<WeChatShareStatus, "idle" | "outside">; error: "" | "not-configured" | "unavailable" };
type CompareSummary = CompareSummaryContent & { key: string; locale: Locale; source: "openai" | "local" };

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
  privacyZh: string;
  privacyEn: string;
  source?: "sample" | "local" | "remote" | "demo";
  posterRole?: "owner" | "agent";
  descriptionZh?: string;
  descriptionEn?: string;
  privateAddress?: string;
  photos?: string[];
  photoKeys?: string[];
  expiresOn?: string | null;
};

type SearchSnapshot = {
  location: string;
  minPrice: string;
  maxPrice: string;
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
  message: string;
  status: string;
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
  brokerage: string;
  licenseState: string;
  licenseNumber: string;
  serviceAreas: string[];
  languages: string[];
  feeSummaryZh: string;
  feeSummaryEn: string;
  isVerified: boolean;
  isSample: boolean;
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
  createdAt: string;
};

type DashboardInquiry = Inquiry & {
  requesterName?: string;
  requesterEmail?: string;
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
  moveInMode: "immediate" | "date";
  moveInDate: string;
  lease: string;
  features: string[];
  descriptionEn: string;
  descriptionZh: string;
  locationLookupOptions: LocationLookupOption[];
  photos: string[];
  photoKeys: string[];
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
  moveInMode: "immediate",
  moveInDate: "",
  lease: "12",
  features: [],
  descriptionEn: "",
  descriptionZh: "",
  locationLookupOptions: [...DEFAULT_LOCATION_LOOKUP_OPTIONS],
  photos: [],
  photoKeys: [],
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
  return Boolean(
    value.titleEn || value.titleZh || value.areaEn || value.areaZh || value.privateAddress || value.price ||
      value.moveInDate || value.lease !== EMPTY_DRAFT.lease || value.descriptionEn || value.descriptionZh ||
      value.photos.length || value.photoKeys.length || value.contactName || value.contactEmail || value.agentProfileId || value.expiresOn ||
      value.features.length || value.agentService !== EMPTY_DRAFT.agentService || value.agentFeePlan !== EMPTY_DRAFT.agentFeePlan || value.agentFeeAmount,
  );
}

const STORAGE_KEYS = {
  locale: "rental-marketplace.locale",
  savedIds: "rental-marketplace.saved-ids",
  savedSearch: "rental-marketplace.saved-search",
  savedSearchSnapshot: "rental-marketplace.saved-search-snapshot",
  customListings: "rental-marketplace.custom-listings",
  inquiries: "rental-marketplace.inquiries",
  draft: "rental-marketplace.listing-draft",
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
    zh: "æ›¼å“ˆé¡¿",
    en: "Manhattan",
    value: "Manhattan",
    locations: [
      { id: "midtown", zh: "ä¸­åŸ", en: "Midtown", value: "Midtown" },
      { id: "lower-manhattan", zh: "ä¸‹åŸ / é‡‘èåŒº", en: "Lower Manhattan", value: "Lower Manhattan" },
      { id: "upper-east-side", zh: "ä¸Šä¸œåŒº", en: "Upper East Side", value: "Upper East Side" },
      { id: "upper-west-side", zh: "ä¸Šè¥¿åŒº", en: "Upper West Side", value: "Upper West Side" },
      { id: "chelsea", zh: "åˆ‡å°”è¥¿", en: "Chelsea", value: "Chelsea" },
      { id: "chinatown", zh: "å”äººè¡— / ååŸ ", en: "Chinatown", value: "Chinatown" },
      { id: "two-bridges", zh: "åŒæ¡¥", en: "Two Bridges", value: "Two Bridges" },
      { id: "lower-east-side", zh: "ä¸‹ä¸œåŒº", en: "Lower East Side", value: "Lower East Side" },
      { id: "harlem", zh: "å“ˆè±å§†", en: "Harlem", value: "Harlem" },
    ],
  },
  {
    id: "brooklyn",
    zh: "å¸ƒé²å…‹æ—",
    en: "Brooklyn",
    value: "Brooklyn",
    locations: [
      { id: "downtown-brooklyn", zh: "å¸ƒé²å…‹æ—å¸‚ä¸­å¿ƒ", en: "Downtown Brooklyn", value: "Downtown Brooklyn" },
      { id: "brooklyn-heights", zh: "å¸ƒé²å…‹æ—é«˜åœ°", en: "Brooklyn Heights", value: "Brooklyn Heights" },
      { id: "williamsburg", zh: "å¨å»‰æ–¯å ¡", en: "Williamsburg", value: "Williamsburg" },
      { id: "greenpoint", zh: "ç»¿ç‚¹", en: "Greenpoint", value: "Greenpoint" },
      { id: "bushwick", zh: "å¸ƒä»€ç»´å…‹", en: "Bushwick", value: "Bushwick" },
      { id: "park-slope", zh: "å…¬å›­å¡", en: "Park Slope", value: "Park Slope" },
      { id: "bensonhurst", zh: "æœ¬æ£®èµ«æ–¯ç‰¹", en: "Bensonhurst", value: "Bensonhurst" },
      { id: "sunset-park", zh: "æ—¥è½å…¬å›­", en: "Sunset Park", value: "Sunset Park" },
      { id: "gravesend", zh: "æ ¼é›·å¤«æ£®å¾·", en: "Gravesend", value: "Gravesend" },
      { id: "sheepshead-bay", zh: "ç¾Šå¤´æ¹¾", en: "Sheepshead Bay", value: "Sheepshead Bay" },
      { id: "bath-beach", zh: "å·´æ–¯æµ·æ»©", en: "Bath Beach", value: "Bath Beach" },
      { id: "homecrest", zh: "éœå§†å…‹é›·æ–¯ç‰¹", en: "Homecrest", value: "Homecrest" },
      { id: "bay-ridge", zh: "æµ·æ¹¾å²­", en: "Bay Ridge", value: "Bay Ridge" },
    ],
  },
  {
    id: "queens",
    zh: "çš‡ååŒº",
    en: "Queens",
    value: "Queens",
    locations: [
      { id: "long-island-city", zh: "é•¿å²›å¸‚", en: "Long Island City", value: "Long Island City" },
      { id: "forest-hills", zh: "æ£®æ—å°ä¸˜", en: "Forest Hills", value: "Forest Hills" },
      { id: "flushing", zh: "æ³•æ‹‰ç››", en: "Flushing", value: "Flushing" },
      { id: "murray-hill-queens", zh: "æ³•æ‹‰ç››æ¢…é‡Œå±±", en: "Murray Hill", value: "Murray Hill" },
      { id: "college-point", zh: "å­¦é™¢ç‚¹", en: "College Point", value: "College Point" },
      { id: "woodside", zh: "æœ¨è¾¹", en: "Woodside", value: "Woodside" },
      { id: "astoria", zh: "é˜¿æ–¯æ‰˜é‡Œäºš", en: "Astoria", value: "Astoria" },
      { id: "jackson-heights", zh: "æ°å…‹é€Šé«˜åœ°", en: "Jackson Heights", value: "Jackson Heights" },
      { id: "elmhurst", zh: "è‰¾å§†èµ«æ–¯ç‰¹", en: "Elmhurst", value: "Elmhurst" },
      { id: "fresh-meadows", zh: "æ–°é²œè‰åŸ", en: "Fresh Meadows", value: "Fresh Meadows" },
      { id: "bayside", zh: "è´èµ›å¾·", en: "Bayside", value: "Bayside" },
    ],
  },
  {
    id: "bronx",
    zh: "å¸ƒæœ—å…‹æ–¯",
    en: "The Bronx",
    value: "Bronx",
    locations: [
      { id: "fordham", zh: "ç¦å¾·å§†", en: "Fordham", value: "Fordham" },
      { id: "riverdale", zh: "æ²³è°·åŒº", en: "Riverdale", value: "Riverdale" },
      { id: "kingsbridge", zh: "é‡‘æ–¯å¸ƒé‡Œå¥‡", en: "Kingsbridge", value: "Kingsbridge" },
      { id: "pelham-bay", zh: "ä½©å‹’å§†æ¹¾", en: "Pelham Bay", value: "Pelham Bay" },
      { id: "belmont", zh: "è´å°”è’™ç‰¹", en: "Belmont", value: "Belmont" },
      { id: "throgs-neck", zh: "ç‰¹ç½—æ ¼æ–¯é¢ˆ", en: "Throgs Neck", value: "Throgs Neck" },
    ],
  },
  {
    id: "staten-island",
    zh: "å²æ³°ç™»å²›",
    en: "Staten Island",
    value: "Staten Island",
    locations: [
      { id: "st-george", zh: "åœ£ä¹”æ²»", en: "St. George", value: "St. George" },
      { id: "new-dorp", zh: "æ–°å¤šæ™®", en: "New Dorp", value: "New Dorp" },
      { id: "tottenville", zh: "æ‰˜æ»•ç»´å°”", en: "Tottenville", value: "Tottenville" },
      { id: "great-kills", zh: "å¤§åŸºå°”æ–¯", en: "Great Kills", value: "Great Kills" },
      { id: "stapleton", zh: "æ–¯å°æ™®é¡¿", en: "Stapleton", value: "Stapleton" },
    ],
  },
  {
    id: "long-island",
    zh: "é•¿å²›",
    en: "Long Island",
    value: "Long Island",
    locations: [
      { id: "nassau", zh: "æ‹¿éªšå¿", en: "Nassau County", value: "Nassau" },
      { id: "suffolk", zh: "è¨ç¦å…‹å¿", en: "Suffolk County", value: "Suffolk" },
      { id: "great-neck", zh: "å¤§é¢ˆ", en: "Great Neck", value: "Great Neck" },
      { id: "jericho", zh: "æ°é‡Œç§‘", en: "Jericho", value: "Jericho" },
      { id: "new-hyde-park", zh: "æ–°æµ·å¾·å…¬å›­", en: "New Hyde Park", value: "New Hyde Park" },
      { id: "garden-city", zh: "èŠ±å›­åŸ", en: "Garden City", value: "Garden City" },
      { id: "hicksville", zh: "å¸Œå…‹æ–¯ç»´å°”", en: "Hicksville", value: "Hicksville" },
      { id: "huntington", zh: "äº¨å»·é¡¿", en: "Huntington", value: "Huntington" },
      { id: "commack", zh: "ç§‘é©¬å…‹", en: "Commack", value: "Commack" },
      { id: "stony-brook", zh: "çŸ³æºª", en: "Stony Brook", value: "Stony Brook" },
      { id: "patchogue", zh: "å¸•å¥‡å¥¥æ ¼", en: "Patchogue", value: "Patchogue" },
    ],
  },
  {
    id: "upstate-new-york",
    zh: "çº½çº¦ä¸Šå·",
    en: "Upstate New York",
    value: "Upstate New York",
    locations: [
      { id: "albany", zh: "å¥¥å°”å·´å°¼", en: "Albany", value: "Albany" },
      { id: "buffalo", zh: "æ°´ç‰›åŸ", en: "Buffalo", value: "Buffalo" },
      { id: "rochester", zh: "ç½—åˆ‡æ–¯ç‰¹", en: "Rochester", value: "Rochester" },
      { id: "syracuse", zh: "é”¡æ‹‰ä¸˜å…¹", en: "Syracuse", value: "Syracuse" },
      { id: "ithaca", zh: "ä¼Šè¨å¡", en: "Ithaca", value: "Ithaca" },
      { id: "saratoga-springs", zh: "è¨æ‹‰æ‰˜åŠ æ³‰", en: "Saratoga Springs", value: "Saratoga Springs" },
      { id: "kingston", zh: "é‡‘æ–¯é¡¿", en: "Kingston", value: "Kingston" },
    ],
  },
] as const;

const LOCATION_LOOKUP_OPTION_COPY: Record<LocationLookupOption, { zh: string; en: string }> = {
  grocery: { zh: "è¶…å¸‚ / æ‚è´§åº—", en: "Supermarkets / groceries" },
  park: { zh: "å…¬å›­", en: "Parks" },
  library: { zh: "å›¾ä¹¦é¦†", en: "Libraries" },
  pharmacy: { zh: "è¯æˆ¿", en: "Pharmacies" },
  school: { zh: "å­¦æ ¡", en: "Schools" }ï]|ŞÚ$z{-®éÜj×ÆF—b6Æ74æÖSÒ'6†&RÖÆ–æ²Ö6÷’#ãÄÆ–æ´–6öâ6—¦S×³WÒóãÇ7ããÇ6ÖÆÃç¶Æö6ÆRÓÓÒ'¦‚"ò.h‹şk©™;îhêR"¢$Æ—7F–ærÆ–æ²'ÓÂ÷6ÖÆÃãÇ7G&öæsç·6†&UW&ÇÓÂ÷7G&öæsãÂ÷7ããÂöF—càĞ¢Æ'WGFöâ6Æ74æÖSÒ'FW‡BÖ'WGFöâ"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ²fö–B6÷•6†&U–ÆöB‡6†&UW&ÂÂÆö6ÆRÓÓÒ'¦‚"ò.h‹şk©™;îhê^[{.ZHŞX‹n8""¢$Æ—7F–ærÆ–æ²6÷–VBâ"“²×Óç¶Æö6ÆRÓÓÒ'¦‚"ò.ZHŞX‹b"¢$6÷’'ÓÂö'WGFöãàĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ'6†&RÖ7F–öç2#àĞ¢Æ'WGFöâ6Æ74æÖSÒ'6†&RÖ7F–öâ6†&RÖ7F–öâ×&–Ö'’"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ²fö–B†æFÆUvT6†DÖöÖVçG56†&R‚“²×ÓãÅ6†&T–6öâóãÇ7ããÇ7G&öæsç·vV6†E6†&U7FGW2ÓÓÒ'&VG’"ò†Æö6ÆRÓÓÒ'¦‚"ò.XˆnKª¾X‹[êîKúiÈ¾Xø¾YÈ‚"¢%6†&RFòvT6†BÖöÖVçG2"’¢†Æö6ÆRÓÓÒ'¦‚"ò.XxnZH~[êîKúiÈ¾Xø¾YÈXˆnKª²"¢%&W&RvT6†BÖöÖVçG26†&R"—ÓÂ÷7G&öæsãÇ6ÖÆÃç·vV6†E6†&U7FGW2ÓÓÒ'&VG’"ò†Æö6ÆRÓÓÒ'¦‚"ò.x+X{¾Xû>Kˆ®Šy"+|+|+~ûÈÎXhŞ˜hºiÈ¾Xø¾YÈ‚"¢%F+|+|+rÂF†Vâ6†ö÷6RÖöÖVçG2"’¢†Æö6ÆRÓÓÒ'¦‚"ò.YÊ[êîKúXh^h™>[Èi{nˆz®Xª[ŠnKˆ®j~š)8{ÊyZ^Y»îY(Î™;îhêR"¢%F†RF—FÆRÂF‡VÖ&æ–ÂÂæBÆ–æ²&R&W&VB–ç6–FRvT6†B"—ÓÂ÷6ÖÆÃãÂ÷7ããÂö'WGFöãàĞ¢Æ'WGFöâ6Æ74æÖSÒ'6†&RÖ7F–öâ"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ²fö–B†æFÆTæF—fU6†&R‚“²×ÓãÅ6†&T–6öâóãÇ7ããÇ7G&öæsç¶Æö6ÆRÓÓÒ'¦‚"ò.h™>[È{;¾{¹şXˆnKª²"¢$÷Vâ7—7FVÒ6†&R'ÓÂ÷7G&öæsãÇ6ÖÆÃç¶Æö6ÆRÓÓÒ'¦‚"ò.h˜¾iË®Kˆ®Xúşy»Nhê^˜hº[êîKúzØ[©NyJ‚"¢$6†ö÷6RâF—&V7FÇ’öâÖö&–ÆR'ÓÂ÷6ÖÆÃãÂ÷7ããÂö'WGFöãàĞ¢Æ'WGFöâ6Æ74æÖSÒ'6†&RÖ7F–öâ"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ²fö–B†æFÆT6†ææVÅ6†&R‚'F–·Fö²"“²×ÓãÅ6†&T–6öâóãÇ7ããÇ7G&öæsåF–µFö³Â÷7G&öæsãÇ6ÖÆÃç¶Æö6ÆRÓÓÒ'¦‚"ò.ZHŞX‹nXù[ˆ>ih~jY(Î™;îhê^ûÈÎ˜XŞYxZ~x˜~Xù[ˆ2"¢$6÷’F†R6F–öâæBÆ–æ²ÂF†VâFB–÷W"†÷Fò'ÓÂ÷6ÖÆÃãÂ÷7ããÂö'WGFöãàĞ¢Æ'WGFöâ6Æ74æÖSÒ'6†&RÖ7F–öâ"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ²fö–B6÷•6†&U–ÆöB‡6†&UW&ÂÂÆö6ÆRÓÓÒ'¦‚"ò.h‹şk©™;îhê^[{.ZHŞX‹n8""¢$Æ—7F–ærÆ–æ²6÷–VBâ"“²×ÓãÄÆ–æ´–6öâóãÇ7ããÇ7G&öæsç¶Æö6ÆRÓÓÒ'¦‚"ò.Xú®ZHŞX‹nh‹şk©™;îhêR"¢$6÷’Æ—7F–ærÆ–æ²öæÇ’'ÓÂ÷7G&öæsãÇ6ÖÆÃç¶Æö6ÆRÓÓÒ'¦‚"ò.ikKëş{)‹KNX‹ˆ®ZJh‰n{êN{¸B"¢%7FR—B–çFò6†B÷"w&÷W'ÓÂ÷6ÖÆÃãÂ÷7ããÂö'WGFöãàĞ¢ÂöF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ'6†&RÖ6F–öâÖÆ&VÂ"‡FÖÄf÷#Ò'6†&RÖ6F–öâ#ç¶Æö6ÆRÓÓÒ'¦‚"ò.Xúşy»Nhê^Xù[ˆ>y¨Nih~j‚"¢%&VG’×Fò×÷7B6F–öâ'ÓÇFW‡F&V–CÒ'6†&RÖ6F–öâ"6Æ74æÖSÒ'6†&RÖ6F–öâ"&÷w3×³‡Ò&VDöæÇ’fÇVS×·6†&UFW‡GÒóãÂöÆ&VÃàĞ¢·6†&TfVVF&6²bbÇ6Æ74æÖSÒ'6†&RÖfVVF&6²"&öÆSÒ'7FGW2#ãÄ6†V6´–6öâ6—¦S×³WÒóç·6†&TfVVF&6·ÓÂ÷çĞĞ¢Ç6Æ74æÖSÒ'6†&RÖæ÷FR#ç¶Æö6ÆRÓÓÒ'¦‚"ò.[êîKúiÈ¾Xø¾YÈûÉ®YÊ[êîKúKŠŞh™>[Èh‹şk©š^YîûÈÎx+X{¾Xû>Kˆ®Šy.XˆnKª¾8%F–µFö¾ûÉ®[Ù>X˜ŞKÉ®ZHŞX‹nih~jY(Î™;îhê^ûÉ¾Zh.iéÎKº^Yî™ÈŠhyÉşjÚ>Kˆ™JîXù[ˆ>ûÈÎ‹ù™ÈŠhhê^XZ^[›n˜	®‹ø~Zû[©N[›>Xûy¨NZéik’’Zêj8""¢%vT6†BÖöÖVçG3¢÷VâF†RÆ—7F–ær–âvT6†BÂF†VâW6RF†RF÷×&–v‡B6†&RÖVçRâF–µFö³¢F†—2f—'7BfW'6–öâ6÷–W2F†R6F–öâæBÆ–æ³²G'VRöæR×F÷7F–ær&WV—&W2â&÷fVBöff–6–ÂÆFf÷&Ò’–çFVw&F–öââ'ÓÂ÷àĞ¢ÆF—b6Æ74æÖSÒ'6†&RÖfö÷FW"#ãÆ'WGFöâ6Æ74æÖSÒ&÷WFÆ–æRÖ'WGFöâ"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ6WE6†&TÆ—7F–ær†çVÆÂ—Óç·Bæ6Æ÷6WÓÂö'WGFöããÆ'WGFöâ6Æ74æÖSÒ'&–Ö'’Ö'WGFöâ"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ²fö–B6÷•6†&U–ÆöB‡6†&UFW‡BÂÆö6ÆRÓÓÒ'¦‚"ò.Xù[ˆ>ih~j[{.ZHŞX‹n8""¢%&VG’×Fò×÷7B6F–öâ6÷–VBâ"“²×ÓãÄÆ–æ´–6öâ6—¦S×³WÒóç¶Æö6ÆRÓÓÒ'¦‚"ò.ZHŞX‹nXù[ˆ>ih~j‚"¢$6÷’6F–öâ'ÓÂö'WGFöããÂöF—càĞ¢ÂöF—càĞ¢Âö6–FSàĞ¢ÂöF—càĞ¢—ĞĞ Ğ¢·6VÆV7FVDÆ—7F–ærbb€Ğ¢ÆF—b6Æ74æÖSÒ&÷fW&Æ’"&öÆSÒ'&W6VçFF–öâ"öäÖ÷W6TF÷vã×²†WfVçB’Óâ²–b†WfVçBçF&vWBÓÓÒWfVçBæ7W'&VçEF&vWB’6WE6VÆV7FVDÆ—7F–ær†çVÆÂ“²×ÓàĞ¢Æ6–FR6Æ74æÖSÒ&G&vW"FWF–ÂÖG&vW""&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&FWF–Â×F—FÆR#à¢ÄÆ—7F–ætvÆÆW'¢F—FÆS×¶Æ—7F–æuF—FÆR‡6VÆV7FVDÆ—7F–ær—Ğ¢†÷F÷3×·6VÆV7FVE†÷F÷2æÆVæwF‚âò6VÆV7FVE†÷F÷2¢²"öÆ—7F–æw2öVÆ×vööBÖÆ–v‡Bçær%×Ğ¢6VÆV7FVD–æFWƒ×·6VÆV7FVE†÷Fô–æFW‡Ğ¢&÷†–ÖFTÆ&VÃ×·Bæ&÷†–ÖFWĞ¢†÷FôÆ&VÃ×¶Æö6ÆRÓÓÒ'¦‚"ò.h‹şk©xZ~x˜r"¢$Æ—7F–ær†÷F÷2'Ğ¢&Wf–÷W4Æ&VÃ×¶Æö6ÆRÓÓÒ'¦‚"ò.Kˆ®Kˆ[Êh‹şk©xZ~x˜r"¢%&Wf–÷W2Æ—7F–ær†÷Fò'Ğ¢æW‡DÆ&VÃ×¶Æö6ÆRÓÓÒ'¦‚"ò.Kˆ¾Kˆ[Êh‹şk©xZ~x˜r"¢$æW‡BÆ—7F–ær†÷Fò'Ğ¢6Æ÷6TÆ&VÃ×·Bæ6Æ÷6WĞ¢W‡æDÆ&VÃ×¶Æö6ÆRÓÓÒ'¦‚"ò.iú^yÈ¾ZJ~Y»â"¢%f–WrgVÆÇ67&VVâ'Ğ¢6÷W&6T—56×ÆS×·6VÆV7FVDÆ—7F–ærç6÷W&6RÓÓÒ'6×ÆR'Ğ¢Æö6´–6öã×²†÷F–öç2’ÓâÄÆö6´–6öâ6—¦S×¶÷F–öç3òç6—¦WÒóçĞ¢6Æ÷6T–6öã×²†÷F–öç2’ÓâÄ6Æ÷6T–6öâ6—¦S×¶÷F–öç3òç6—¦WÒóçĞ¢öå6VÆV7C×·6WE6VÆV7FVE†÷Fô–æFW‡Ğ¢öä6Æ÷6S×²‚’Óâ6WE6VÆV7FVDÆ—7F–ær†çVÆÂ—Ğ¢óà¢ÆF—b6Æ74æÖSÒ&G&vW"Ö6öçFVçB#à¢ÆF—b6Æ74æÖSÒ&G&vW"Ö†VF–ær#ãÇ7â6Æ74æÖSÒ&Æ—7F–ær×G—R#ç¶Æ—7F–æuG—R‡6VÆV7FVDÆ—7F–ær—ÓÂ÷7ããÆ'WGFöâ6Æ74æÖSÒ&G&vW"Ö6Æ÷6R"G—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ6WE6VÆV7FVDÆ—7F–ær†çVÆÂ—Ò&–ÖÆ&VÃ×·Bæ6Æ÷6WÓãÄ6Æ÷6T–6öâóãÂö'WGFöããÂöF—càĞ¢Æƒ"–CÒ&FWF–Â×F—FÆR#ç¶Æ—7F–æuF—FÆR‡6VÆV7FVDÆ—7F–ær—ÓÂöƒ#àĞ¢Ç6Æ74æÖSÒ&Æ—7F–ærÖ&V#ãÅ–ä–6öâ6—¦S×³WÒóç¶Æ—7F–æt&V‡6VÆV7FVDÆ—7F–ær—ÓÂ÷àĞ¢Ç6Æ74æÖSÒ&G&vW"Ö–çG&ò#ç·BæFWF–Ç4–çG&÷ÓÂ÷àĞ¢ÆF—b6Æ74æÖSÒ&FWF–Â×&–6R#ãÇ7G&öæsç¶f÷&ÖE&–6R‡6VÆV7FVDÆ—7F–ær—ÓÂ÷7G&öæsãÇ7ãç·BæÖöçF‡ÓÂ÷7ããÂöF—càĞ¢Ç6Æ74æÖSÒ&6÷7BÖæ÷FR#ãÄ6†V6´–6öâ6—¦S×³7Òóç·Bæ6÷7Dæ÷FWÓÂ÷àĞ¢ÆF—b6Æ74æÖSÒ&FWF–ÂÖ77W&æ6R"&–ÖÆ&VÃ×¶Æö6ÆRÓÓÒ'¦‚"ò.h‹şk©KúXûr"¢$Æ—7F–ær6–væÇ2'ÓàĞ¢Ç7â6Æ74æÖSÒ&77W&æ6RÖ—FVÒ#ãÇ7â6Æ74æÖSÒ&77W&æ6RÖ–6öâfW&–f–VB#ãÄ6†V6´–6öâ6—¦S×³'ÒóãÂ÷7ãç·6VÆV7FVDÆ—7F–ærç÷7FW%fW&–f–VBòBçfW&–f–VDVÖ–Â¢6VÆV7FVDÆ—7F–ærç6÷W&6RÓÓÒ'6×ÆR"òBç6×ÆU6–væÂ¢BæÆö6Å6–væÇÓÂ÷7ãàĞ¢Ç7â6Æ74æÖSÒ&77W&æ6RÖ—FVÒ#ãÇ7â6Æ74æÖSÒ&77W&æ6RÖ–6öâ†÷Fò#ãÄvÆÆW'”–6öâ6—¦S×³'ÒóãÂ÷7ãç·6VÆV7FVE†÷F÷2æÆVæwF‡Ò·Bç†÷Fô6÷VçGÓÂ÷7ãàĞ¢Ç7â6Æ74æÖSÒ&77W&æ6RÖ—FVÒ#ãÇ7â6Æ74æÖSÒ&77W&æ6RÖ–6öâ&—f7’#ãÄÆö6´–6öâ6—¦S×³'ÒóãÂ÷7ãç·Bæ&÷†–ÖFWÓÂ÷7ãàĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&FWF–ÂÖw&–B#àĞ¢ÆF—cãÇ6ÖÆÃç·BæFWF–Ä&VÓÂ÷6ÖÆÃãÇ7G&öæsç¶Æ—7F–æt&V‡6VÆV7FVDÆ—7F–ær—ÓÂ÷7G&öæsãÂöF—càĞ¢ÆF—cãÇ6ÖÆÃç·BæFWF–ÄÖ÷fT–çÓÂ÷6ÖÆÃãÇ7G&öæsç¶Æ—7F–ætÖ÷fT–â‡6VÆV7FVDÆ—7F–ær—ÓÂ÷7G&öæsãÂöF—càĞ¢ÆF—cãÇ6ÖÆÃç·BæFWF–ÄÆV6WÓÂ÷6ÖÆÃãÇ7G&öæsç·6VÆV7FVDÆ—7F–æræÆV6WÓÂ÷7G&öæsãÂöF—càĞ¢ÆF—cãÇ6ÖÆÃç·BæFWF–Å÷7FW'ÓÂ÷6ÖÆÃãÇ7G&öæsç¶Æ—7F–æu÷7FW"‡6VÆV7FVDÆ—7F–ær—ÓÂ÷7G&öæsãÂöF—càĞ¢ÂöF—càĞ¢¶Æ—7F–ætFW67&—F–öâ‡6VÆV7FVDÆ—7F–ær’bbÇ6V7F–öâ6Æ74æÖSÒ&FWF–ÂÖFW67&—F–öâ#àĞ¢Æƒ26Æ74æÖSÒ&G&vW"×6V7F–öâÖ†VF–ær#ç·BæFWF–ÄFW67&—F–öçÓÂöƒ3àĞ¢Çç¶Æ—7F–ætFW67&—F–öâ‡6VÆV7FVDÆ—7F–ær—ÓÂ÷àĞ¢Â÷6V7F–öãçĞĞ¢Æƒ26Æ74æÖSÒ&G&vW"×6V7F–öâÖ†VF–ær#ç·BæFWF–ÄÖVæ—F–W7ÓÂöƒ3àĞ¢ÆF—b6Æ74æÖSÒ'Fr×&÷rG&vW"×Fw2#ç¶Æ—7F–æuFw2‡6VÆV7FVDÆ—7F–ær’æÖ‚‡Fr’ÓâÇ7â6Æ74æÖSÒ&Æ—7F–ær×Fr"¶W“×·FwÓç·FwÓÂ÷7ãâ—ÓÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&G&vW"×&—f7’#ãÆF—b6Æ74æÖSÒ'&—f7’Ö–6öâ#ãÄÆö6´–6öâóãÂöF—cãÆF—cãÇ7G&öæsç·BæFG&W75&—fFWÓÂ÷7G&öæsãÇç¶Æ—7F–æu&—f7’‡6VÆV7FVDÆ—7F–ær—ÓÂ÷ãÂöF—cãÂöF—càĞ¢ÄFWF–Ä7F–öäFö6°¢6öçF7DÆ&VÃ×·Bç&WVW7EF÷W'Ğ¢6ö×&TÆ&VÃ×·Bæ6ö×&WĞ¢6†&TÆ&VÃ×¶Æö6ÆRÓÓÒ'¦‚"ò.XˆnKª¾X‹iÈ¾Xø¾YÈ‚"¢%6†&RFòÖöÖVçG2'Ğ¢6ö×&–æs×¶6ö×&T–G2æ–æ6ÇVFW2‡6VÆV7FVDÆ—7F–æræ–B—Ğ¢–6öç3×·°¢6†C¢†÷F–öç2’ÓâÄ6†D–6öâ6—¦S×¶÷F–öç3òç6—¦WÒóâÀ¢6ö×&S¢†÷F–öç2’ÓâÄ6ö×&T–6öâ6—¦S×¶÷F–öç3òç6—¦WÒóâÀ¢6†&S¢†÷F–öç2’ÓâÅ6†&T–6öâ6—¦S×¶÷F–öç3òç6—¦WÒóâÀ¢×Ğ¢öä6öçF7C×²‚’Óâ²6WE6VÆV7FVDÆ—7F–ær†çVÆÂ“²÷Vä6öçF7B‡6VÆV7FVDÆ—7F–ær“²×Ğ¢öä6ö×&S×²‚’ÓâFövvÆT6ö×&R‡6VÆV7FVDÆ—7F–æræ–B—Ğ¢öå6†&S×²‚’Óâ÷Vå6†&R‡6VÆV7FVDÆ—7F–ær—Ğ¢óà¢Æ'WGFöâ6Æ74æÖSÒ'FW‡BÖ'WGFöâFWF–Â×&W÷'BÖ'WGFöâ"G—SÒ&'WGFöâ"öä6Æ–6³×¶÷Vå&W÷'Df÷$Æ—7F–æwÓç¶Æö6ÆRÓÓÒ'¦‚"ò.K‹îhª^jÚNh‹şk©"¢%&W÷'BF†—2Æ—7F–ær'ÓÂö'WGFöãàĞ¢ÂöF—càĞ¢Âö6–FSàĞ¢ÂöF—càĞ¢—ĞĞ Ğ¢·&W÷'D÷Vâbb6VÆV7FVDÆ—7F–ærbbÅ&W÷'DG&vW"Æö6ÆS×¶Æö6ÆWÒÆ—7F–æuF—FÆS×¶Æ—7F–æuF—FÆR‡6VÆV7FVDÆ—7F–ær—ÒÆöF–æs×·&W÷'DÆöF–æwÒW'&÷#×·&W÷'DW'&÷'Òöä6Æ÷6S×²‚’Óâ²6WE&W÷'D÷Vâ†fÇ6R“²6WE&W÷'DW'&÷"‚""“²×Òöå7V&Ö—C×·7V&Ö—E&W÷'GÒóçĞĞ Ğ¢¶6öçF7DÆ—7F–ærbb€Ğ¢ÆF—b6Æ74æÖSÒ&÷fW&Æ’"&öÆSÒ'&W6VçFF–öâ"öäÖ÷W6TF÷vã×²†WfVçB’Óâ²–b†WfVçBçF&vWBÓÓÒWfVçBæ7W'&VçEF&vWB’6Æ÷6T6öçF7B‚“²×ÓàĞ¢Æ6–FR6Æ74æÖSÒ&G&vW"f÷&ÒÖG&vW""&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&6öçF7B×F—FÆR#àĞ¢ÆF—b6Æ74æÖSÒ&G&vW"Ö6öçFVçB#àĞ¢ÆF—b6Æ74æÖSÒ&G&vW"Ö†VF–ær#ãÇ7â6Æ74æÖSÒ'6V7F–öâÖÆ&VÂ#ç¶6öçF7DÆ—7F–ærçF—FÆTVçÓÂ÷7ããÆ'WGFöâ6Æ74æÖSÒ&G&vW"Ö6Æ÷6R"G—SÒ&'WGFöâ"öä6Æ–6³×¶6Æ÷6T6öçF7GÒ&–ÖÆ&VÃ×·Bæ6Æ÷6WÓãÄ6Æ÷6T–6öâóãÂö'WGFöããÂöF—càĞ¢Æƒ"–CÒ&6öçF7B×F—FÆR#ç·Bæ6öçF7EF—FÆWÓÂöƒ#àĞ¢Ç6Æ74æÖSÒ&G&vW"Ö–çG&ò#ç·Bæ6öçF7D–çG&÷ÓÂ÷àĞ¢Æf÷&Ò¶W“×¶6öçF7DÆ—7F–æræ–GÒ6Æ74æÖSÒ&6öçF7BÖf÷&Ò"öå7V&Ö—C×·7V&Ö—D–çV—'—ÓàĞ¢¶–çV—'”W'&÷"bbÇ6Æ74æÖSÒ&f÷&ÒÖW'&÷""&öÆSÒ&ÆW'B#ç¶–çV—'”W'&÷'ÓÂ÷çĞĞ¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆBÖÆ&VÂ"‡FÖÄf÷#Ò&6öçF7BÖÖ÷fR#ç·Bæ–çFVæFVDÖ÷fWÓÂöÆ&VÃàĞ¢Ç6VÆV7B–CÒ&6öçF7BÖÖ÷fR"æÖSÒ&Ö÷fT–â"FVfVÇEfÇVS×¶6öçF7DÆ—7F–æræÖ÷fT–âÓÓÒ&–ÖÖVF–FR"ò&–ÖÖVF–FR"¢Ö÷fT–äÖöçF‚†6öçF7DÆ—7F–æræÖ÷fT–â’ÇÂ'6WFVÖ&W"'ÓãÆ÷F–öâfÇVSÒ&–ÖÖVF–FR#ç¶Æö6ÆRÓÓÒ'¦‚"ò.z¸¾XÛ>XZ^KØò"¢$Ö÷fR–â–ÖÖVF–FVÇ’'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ&VwW7B#ç¶Æö6ÆRÓÓÒ'¦‚"ò###n[›CiÈ‚"¢$Vr##b'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ'6WFVÖ&W"#ç¶Æö6ÆRÓÓÒ'¦‚"ò###n[›CiÈ‚"¢%6W##b'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ&ö7Fö&W"#ç¶Æö6ÆRÓÓÒ'¦‚"ò###n[›CiÈ‚"¢$ö7B##b'ÓÂö÷F–öããÂ÷6VÆV7CàĞ¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆBÖÆ&VÂ"‡FÖÄf÷#Ò&6öçF7BÖÆV6R#ç·BæÆV6TÆVæwF‡ÓÂöÆ&VÃàĞ¢Ç6VÆV7B–CÒ&6öçF7BÖÆV6R"æÖSÒ&ÆV6TÆVæwF‚"FVfVÇEfÇVSÒ#"#ãÆ÷F–öâfÇVSÒ#b#ç¶Æö6ÆRÓÓÒ'¦‚"ò#nKŠ®iÈ‚"¢#bÖöçF‡2'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ#"#ç¶Æö6ÆRÓÓÒ'¦‚"ò#.KŠ®iÈ‚"¢#"ÖöçF‡2'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ##B#ç¶Æö6ÆRÓÓÒ'¦‚"ò##NKŠ®iÈKº^Kˆ¢"¢##B²ÖöçF‡2'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ'VæFVf–æVB#ç¶Æö6ÆRÓÓÒ'¦‚"ò.iÊ®zîZé¢"¢%VæFVf–æVB'ÓÂö÷F–öããÂ÷6VÆV7CàĞ¢ÆF—b6Æ74æÖSÒ&f÷&Ò×&÷r#ãÆF—cãÆÆ&VÂ6Æ74æÖSÒ&f–VÆBÖÆ&VÂ"‡FÖÄf÷#Ò&6öçF7BÖö67WçG2#ç·Bæö67WçG7ÓÂöÆ&VÃãÇ6VÆV7B–CÒ&6öçF7BÖö67WçG2"æÖSÒ&ö67WçG2"FVfVÇEfÇVSÒ##ãÆ÷F–öâfÇVSÒ##ãÂö÷F–öããÆ÷F–öâfÇVSÒ#"#ã#Âö÷F–öããÆ÷F–öâfÇVSÒ#2²#ã2³Âö÷F–öããÂ÷6VÆV7CãÂöF—cãÆF—cãÆÆ&VÂ6Æ74æÖSÒ&f–VÆBÖÆ&VÂ"‡FÖÄf÷#Ò&6öçF7B×WG2#ç·BçWG5VW7F–öçÓÂöÆ&VÃãÇ6VÆV7B–CÒ&6öçF7B×WG2"æÖSÒ'WG2"FVfVÇEfÇVSÒ&æò#ãÆ÷F–öâfÇVSÒ&æò#ç·BææõWG7ÓÂö÷F–öããÆ÷F–öâfÇVSÒ'–W2#ç·Bç–W5WG7ÓÂö÷F–öããÂ÷6VÆV7CãÂöF—cãÂöF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆBÖÆ&VÂ"‡FÖÄf÷#Ò&6öçF7B×F÷W"#ç¶Æö6ÆRÓÓÒ'¦‚"ò.yÈ¾h‹şXşZ[Ò"¢%F÷W"&VfW&Væ6R'ÓÂöÆ&VÃàĞ¢Ç6VÆV7B–CÒ&6öçF7B×F÷W""æÖSÒ'F÷W%&VfW&Væ6R"FVfVÇEfÇVSÒ&fÆW†–&ÆR#ãÆ÷F–öâfÇVSÒ&fÆW†–&ÆR#ç¶Æö6ÆRÓÓÒ'¦‚"ò.i{n™{Nx^kK²"¢$fÆW†–&ÆR'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ'vVV¶F’#ç¶Æö6ÆRÓÓÒ'¦‚"ò.[z^KÙÎizR"¢%vVV¶F—2'ÓÂö÷F–öããÆ÷F–öâfÇVSÒ'vVV¶VæB#ç¶Æö6ÆRÓÓÒ'¦‚"ò.YiÊ²"¢%vVV¶VæG2'ÓÂö÷F–öããÂ÷6VÆV7CàĞ¢Æf–VÆG6WB6Æ74æÖSÒ&–çV—'’Ö6öÖÖVçBÖ÷F–öç2#àĞ¢ÆÆVvVæB6Æ74æÖSÒ&f–VÆBÖÆ&VÂ#ç¶Æö6ÆRÓÓÒ'¦‚"ò.KÚh;>K¨nŠz>K¸K˜ûÉşûÈXúşZI®˜ûÈ’"¢%v†Bv÷VÆB–÷RÆ–¶RFò¶æ÷sò„6†ö÷6Rç’’'ÓÂöÆVvVæCàĞ¢ÆF—b6Æ74æÖSÒ&6öÖÖVçBÖ÷F–öç2#àĞ¢´”åT•%•ô4ôÔÔTåEôõD”ôå2æÖ‚†÷F–öâ’Óâ°Ğ¢6öç7B6VÆV7FVBÒ6VÆV7FVD–çV—'”6öÖÖVçG2æ–æ6ÇVFW2†÷F–öâçfÇVR“°Ğ¢&WGW&âÆ'WGFöâ6Æ74æÖS×¶6öÖÖVçBÖ÷F–öâG·6VÆV7FVBò&7F—fR"¢"'ÖÒ¶W“×¶÷F–öâçfÇVWÒG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ6WE6VÆV7FVD–çV—'”6öÖÖVçG2‚†7W'&VçB’Óâ6VÆV7FVBò7W'&VçBæf–ÇFW"‚‡fÇVR’ÓâfÇVRÓÒ÷F–öâçfÇVR’¢²ââæ7W'&VçBÂ÷F–öâçfÇVUÒ—Ò&–×&W76VC×·6VÆV7FVGÓç·6VÆV7FVBbbÄ6†V6´–6öâ6—¦S×³'Òóç×¶Æö6ÆRÓÓÒ'¦‚"ò÷F–öâç¦‚¢÷F–öâæVçÓÂö'WGFöãã°Ğ¢Ò—ĞĞ¢ÂöF—càĞ¢Ç6Æ74æÖSÒ&f–VÆBÖ†VÇ#ç¶Æö6ÆRÓÓÒ'¦‚"ò.Xúş˜hºZI®KŠ®ûÈÎ˜KŠŞy¨NXh^ZëKÉ®Y(ÎKÚy¨NkhhşKˆ‹[~Xù˜{¹Xù[ˆ>ˆ^8""¢$6†ö÷6Rç’çVÖ&W#²6VÆV7FVB&ö×G2v–ÆÂ&R6VçBv—F‚–÷W"ÖW76vRâ'ÓÂ÷àĞ¢Âöf–VÆG6WCàĞ¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆBÖÆ&VÂ"‡FÖÄf÷#Ò&6öçF7BÖÖW76vR#ç·BæÖW76vWÓÂöÆ&VÃàĞ¢ÇFW‡F&V–CÒ&6öçF7BÖÖW76vR"æÖSÒ&ÖW76vR"Æ6V†öÆFW#×·BæÖW76vUÆ6V†öÆFW'Ò&÷w3×³GÒóàĞ¢Ç6Æ74æÖSÒ&f÷&Ò×6fWG’#ãÅ6†–VÆD–6öâ6—¦S×³WÒóç¶Æö6ÆRÓÓÒ'¦‚"ò.h‰KºÎKˆŞKÉ®YÊ‹ùKŠ®™‹një^Šhk.KúyJ‹XNiih‰nXù~KùŞhªNx›[è8""¢%vRFòæ÷B6²f÷"7&VF—Bf–ÆW2÷"&÷FV7FVBG&—G2BF†—27FvRâ'ÓÂ÷àĞ¢Æ'WGFöâ6Æ74æÖSÒ'&–Ö'’Ö'WGFöâgVÆÂÖ'WGFöâ"G—SÒ'7V&Ö—B#ãÄ6†D–6öâóç·Bç6VæD–çV—'—ÓÂö'WGFöãàĞ¢Âöf÷&ÓàĞ¢ÂöF—càĞ¢Âö6–FSàĞ¢ÂöF—càĞ¢—ĞĞ Ğ¢¶WF„÷VâbbÄWF„G&vW"Æö6ÆS×¶Æö6ÆWÒÖöFS×¶WF„ÖöFWÒÆöF–æs×¶WF„ÆöF–æwÒW'&÷#×¶WF„W'&÷'ÒöävöövÆTÆöv–ã×²†66÷VçEG—R’Óâ²v–æF÷ræÆö6F–öâæ76–vâ†ö’öWF‚övöövÆSö66÷VçEG—SÒG¶66÷VçEG—RÇÂ'W6W"'Ö“²×Òöä6Æ÷6S×²‚’Óâ²6WDWF„÷Vâ†fÇ6R“²6WDWF„W'&÷"‚""“²×ÒöäÖöFT6†ævS×²†ÖöFR’Óâ²6WDWF„ÖöFR†ÖöFR“²6WDWF„W'&÷"‚""“²×Òöå7V&Ö—C×¶†æFÆTWF…7V&Ö—GÒóçĞĞ Ğ¢¶66÷VçD÷Vâbb7W'&VçEW6W"bbÄ66÷VçDG&vW"Æö6ÆS×¶Æö6ÆWÒW6W#×¶7W'&VçEW6W'ÒF#×¶F6†&ö&EF'ÒÆ—7F–æw3×¶F6†&ö&DÆ—7F–æw7Ò–çV—&–W3×·&V6V—fVD–çV—&–W7ÒvVçE&WVW7G3×¶vVçE&WVW7G7Ò6äÖævTvVçE&WVW7G3×¶6äÖævTvVçE&WVW7G7ÒvVçE&WVW7DÆöF–æt–C×¶vVçE&WVW7DÆöF–æt–GÒÆöF–æs×¶F6†&ö&DÆöF–æwÒW'&÷#×¶F6†&ö&DW'&÷'Ò&W6VæDÆöF–æs×·&W6VæDÆöF–æwÒ&W6VæDW'&÷#×·&W6VæDW'&÷'Òöä6Æ÷6S×²‚’Óâ6WD66÷VçD÷Vâ†fÇ6R—ÒöåF$6†ævS×·6WDF6†&ö&EF'ÒöäÆöv÷WC×¶†æFÆTÆöv÷WGÒöå&W6VæEfW&–f–6F–öã×¶†æFÆU&W6VæEfW&–f–6F–öçÒöåWFFU&öf–ÆS×¶†æFÆU&öf–ÆUWFFWÒöävVçEfW&–f–6F–öå7FGW46†ævS×¶†æFÆTvVçEfW&–f–6F–öå7FGW46†ævWÒöåf–WtÆ—7F–æs×·f–WtF6†&ö&DÆ—7F–æwÒöäVF—DÆ—7F–æs×¶VF—DF6†&ö&DÆ—7F–æwÒöå6WDÆ—7F–æu7FGW3×¶†æFÆTF6†&ö&E7FGW7Òöå&VæWtÆ—7F–æs×¶†æFÆU&VæWtÆ—7F–æwÒöävVçE&WVW7DFV6—6–öã×¶†æFÆTvVçE&WVW7DFV6—6–öçÒóçĞĞ Ğ¢²‡Fö7BÇÂfW&–f–6F–öäæ÷F–6R’bbÆF—b6Æ74æÖSÒ'Fö7B"&öÆSÒ'7FGW2#ãÇ7â6Æ74æÖSÒ'Fö7BÖÖ&²#ãÄ6†V6´–6öâ6—¦S×³7ÒóãÂ÷7ãç·Fö7BÇÂfW&–f–6F–öäæ÷F–6WÓÂöF—cçĞĞ Ğ¢Å6—FTfö÷FW"óàĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ
"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

type Locale = "zh" | "en";
type RentalType = "all" | "entire" | "privateRoom" | "sublet";
type SortMode = "fit" | "price" | "fresh";

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
  currency: "USD" | "CAD";
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
  privacyZh: string;
  privacyEn: string;
};

const LISTINGS: Listing[] = [
  {
    id: "elmwood-light",
    titleZh: "树影公园旁的两居",
    titleEn: "Two bedrooms beside Elmwood Park",
    areaZh: "Queens · Forest Hills 一带",
    areaEn: "Queens · around Forest Hills",
    type: "entire",
    typeZh: "整套住房",
    typeEn: "Entire home",
    price: 3200,
    currency: "USD",
    bedrooms: "2",
    bathrooms: "1",
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
    areaZh: "Jersey City · Heights 一带",
    areaEn: "Jersey City · around the Heights",
    type: "entire",
    typeZh: "整套住房",
    typeEn: "Entire home",
    price: 2680,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
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
    areaZh: "North York · Willowdale 一带",
    areaEn: "North York · around Willowdale",
    type: "privateRoom",
    typeZh: "独立房间",
    typeEn: "Private room",
    price: 1450,
    currency: "CAD",
    bedrooms: "1",
    bathrooms: "1",
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
    areaZh: "Brooklyn · Sunset Park 一带",
    areaEn: "Brooklyn · around Sunset Park",
    type: "sublet",
    typeZh: "转租",
    typeEn: "Sublet",
    price: 2350,
    currency: "USD",
    bedrooms: "1",
    bathrooms: "1",
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
];

const copy = {
  zh: {
    workingTitle: "工作名称 · 未定品牌",
    findRentals: "找房",
    saved: "收藏",
    messages: "消息",
    post: "发布房源",
    pilot: "示例库存 · synthetic pilot inventory",
    heading: "先把住处看明白",
    subheading:
      "比较租金、租期和房源信号。精确地址不会出现在公开页面，发布者会在合适的看房流程中决定是否透露。",
    saveSearch: "保存这组搜索",
    savedSearch: "搜索已保存",
    filters: "筛选条件",
    reset: "重置",
    location: "位置、大学或地标",
    locationPlaceholder: "例如 Forest Hills 或 Columbia",
    maxPrice: "最高月租",
    anyPrice: "不限",
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
    search: "查找房源",
    approximate: "公开页面只显示大致区域",
    results: "符合条件的房源",
    syntheticNotice: "示例房源用于体验流程，不代表已上线库存或商业报价。",
    sort: "排序",
    bestFit: "最匹配",
    lowest: "租金从低到高",
    fresh: "最近更新",
    compare: "比较",
    comparing: "正在比较",
    view: "查看房源",
    contact: "开始联系",
    month: "/月",
    monthly: "月租",
    costBreakdown: "费用结构已拆分",
    locationChecked: "地点已核验",
    availability: "近期确认有房",
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
    startDraft: "开始草稿",
    draftStarted: "草稿已创建（示例模式）",
    clear: "清除条件",
    noResults: "没有找到符合这些条件的示例房源",
    noResultsBody: "试试放宽最高月租、位置或房源类型。",
    clearAndTry: "清除筛选并重试",
    notification: "提醒",
    language: "English",
    account: "账户",
  },
  en: {
    workingTitle: "Working name · brand TBD",
    findRentals: "Find rentals",
    saved: "Saved",
    messages: "Messages",
    post: "Post a listing",
    pilot: "Synthetic pilot inventory",
    heading: "Make the next move clear",
    subheading:
      "Compare rent, terms, and listing signals in one place. Exact addresses stay off public pages until the poster chooses to reveal one in the tour flow.",
    saveSearch: "Save this search",
    savedSearch: "Search saved",
    filters: "Filter desk",
    reset: "Reset",
    location: "Location, university, or landmark",
    locationPlaceholder: "Try Forest Hills or Columbia",
    maxPrice: "Maximum monthly rent",
    anyPrice: "Any price",
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
    search: "Search rentals",
    approximate: "Public pages show an approximate area only",
    results: "Matching rentals",
    syntheticNotice: "Sample listings demonstrate the workflow and are not live inventory or commercial offers.",
    sort: "Sort",
    bestFit: "Best fit",
    lowest: "Lowest rent",
    fresh: "Recently updated",
    compare: "Compare",
    comparing: "Comparing",
    view: "View listing",
    contact: "Start a conversation",
    month: "/mo",
    monthly: "monthly",
    costBreakdown: "Cost structure shown",
    locationChecked: "Location checked",
    availability: "Availability recent",
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
    startDraft: "Start a draft",
    draftStarted: "Draft created (sample mode)",
    clear: "Clear filters",
    noResults: "No sample rentals match those conditions",
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

function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
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

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function formatPrice(listing: Listing) {
  return `$${listing.price.toLocaleString("en-US")} ${listing.currency}`;
}

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [locationInput, setLocationInput] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rentalType, setRentalType] = useState<RentalType>("all");
  const [sortMode, setSortMode] = useState<SortMode>("fit");
  const [moveIn, setMoveIn] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedSearch, setSavedSearch] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [contactListing, setContactListing] = useState<Listing | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [toast, setToast] = useState("");
  const t = copy[locale];

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const filteredListings = useMemo(() => {
    const query = appliedLocation.trim().toLowerCase();
    const ceiling = maxPrice ? Number(maxPrice) : Number.POSITIVE_INFINITY;
    const filtered = LISTINGS.filter((listing) => {
      const searchable = `${listing.titleZh} ${listing.titleEn} ${listing.areaZh} ${listing.areaEn}`.toLowerCase();
      const matchesLocation = !query || searchable.includes(query);
      const matchesPrice = listing.price <= ceiling;
      const matchesType = rentalType === "all" || listing.type === rentalType;
      const matchesFeatures = activeFeatures.every((feature) => listing.features.includes(feature));
      return matchesLocation && matchesPrice && matchesType && matchesFeatures;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "price") return a.price - b.price;
      if (sortMode === "fresh") return LISTINGS.indexOf(a) - LISTINGS.indexOf(b);
      return LISTINGS.indexOf(a) - LISTINGS.indexOf(b);
    });
  }, [activeFeatures, appliedLocation, maxPrice, rentalType, sortMode]);

  const compareListings = LISTINGS.filter((listing) => compareIds.includes(listing.id));

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCompare = (id: string) => {
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

  const resetFilters = () => {
    setLocationInput("");
    setAppliedLocation("");
    setMaxPrice("");
    setRentalType("all");
    setMoveIn("");
    setActiveFeatures([]);
    showToast(locale === "zh" ? "筛选条件已重置" : "Filters reset");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedLocation(locationInput);
    showToast(locale === "zh" ? "筛选已应用" : "Filters applied");
  };

  const submitInquiry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactListing(null);
    showToast(t.inquirySent);
  };

  const listingTitle = (listing: Listing) => (locale === "zh" ? listing.titleZh : listing.titleEn);
  const listingArea = (listing: Listing) => (locale === "zh" ? listing.areaZh : listing.areaEn);
  const listingType = (listing: Listing) => (locale === "zh" ? listing.typeZh : listing.typeEn);
  const listingTags = (listing: Listing) => (locale === "zh" ? listing.tagsZh : listing.tagsEn);
  const listingFreshness = (listing: Listing) => (locale === "zh" ? listing.freshnessZh : listing.freshnessEn);
  const listingPoster = (listing: Listing) => (locale === "zh" ? listing.posterZh : listing.posterEn);
  const listingPrivacy = (listing: Listing) => (locale === "zh" ? listing.privacyZh : listing.privacyEn);

  return (
    <main className="app-shell">
      <a className="skip-link" href="#rentals">
        {locale === "zh" ? "跳到房源列表" : "Skip to rentals"}
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top" aria-label="Rental marketplace home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="brand-wordmark">
              <strong>租住</strong>
              <small>RENTALS</small>
            </span>
          </a>
          <span className="working-title">{t.workingTitle}</span>
          <nav className="primary-nav" aria-label={locale === "zh" ? "主要导航" : "Primary navigation"}>
            <a className="active" href="#rentals">{t.findRentals}</a>
            <a href="#saved">{t.saved}{savedIds.size > 0 ? ` ${savedIds.size}` : ""}</a>
            <a href="#messages">{t.messages}</a>
          </nav>
          <div className="topbar-actions">
            <button className="language-switch" type="button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")} aria-label={`Switch language to ${t.language}`}>
              <span className="language-dot" aria-hidden="true" />
              {t.language}
            </button>
            <button className="post-button" type="button" onClick={() => setPostOpen(true)}>
              <span aria-hidden="true">+</span>
              {t.post}
            </button>
            <button className="avatar-button" type="button" aria-label={t.account}>林</button>
          </div>
        </div>
      </header>

      <div className="page-content" id="top">
        <section className="workspace-heading" aria-labelledby="page-title">
          <div className="heading-copy">
            <p className="status-line"><span className="status-lamp" aria-hidden="true" />{t.pilot}</p>
            <h1 id="page-title">{t.heading}</h1>
            <p className="heading-subtitle">{t.subheading}</p>
          </div>
          <div className="heading-actions">
            <button className={`outline-button ${savedSearch ? "is-saved" : ""}`} type="button" onClick={() => { setSavedSearch((current) => !current); showToast(savedSearch ? (locale === "zh" ? "已取消保存" : "Search removed") : t.savedSearch); }}>
              <span className="button-check" aria-hidden="true">{savedSearch ? <CheckIcon /> : ""}</span>
              {savedSearch ? t.savedSearch : t.saveSearch}
            </button>
          </div>
        </section>

        <section className="search-workbench" aria-label={locale === "zh" ? "找房工作台" : "Rental search workbench"}>
          <aside className="filter-column">
            <div className="filter-header">
              <div>
                <span className="section-label">FILTER DESK</span>
                <h2>{t.filters}</h2>
              </div>
              <button className="text-button" type="button" onClick={resetFilters}>{t.reset}</button>
            </div>

            <form className="filter-form" onSubmit={submitSearch}>
              <label className="field-label" htmlFor="location">{t.location}</label>
              <div className="input-shell search-input-shell">
                <SearchIcon />
                <input id="location" value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder={t.locationPlaceholder} />
              </div>
              <p className="field-note"><LockIcon size={14} />{t.approximate}</p>

              <label className="field-label" htmlFor="price">{t.maxPrice}</label>
              <select id="price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
                <option value="">{t.anyPrice}</option>
                <option value="1800">$1,800</option>
                <option value="2400">$2,400</option>
                <option value="3000">$3,000</option>
                <option value="3500">$3,500</option>
              </select>

              <label className="field-label" htmlFor="type">{t.type}</label>
              <select id="type" value={rentalType} onChange={(event) => setRentalType(event.target.value as RentalType)}>
                <option value="all">{t.allTypes}</option>
                <option value="entire">{t.entire}</option>
                <option value="privateRoom">{t.privateRoom}</option>
                <option value="sublet">{t.sublet}</option>
              </select>

              <label className="field-label" htmlFor="move-in">{t.moveIn}</label>
              <select id="move-in" value={moveIn} onChange={(event) => setMoveIn(event.target.value)}>
                <option value="">{t.anytime}</option>
                <option value="august">Aug 2026</option>
                <option value="september">Sep 2026</option>
                <option value="october">Oct 2026</option>
              </select>

              <button className="more-filters" type="button" onClick={() => setShowMore((current) => !current)}>
                <SlidersIcon />
                {showMore ? t.less : t.more}
                <span aria-hidden="true">{showMore ? "−" : "+"}</span>
              </button>

              {showMore && (
                <div className="feature-filters">
                  {[ ["furnished", t.furnished], ["utilities", t.utilities], ["parking", t.parking], ["pets", t.pets] ].map(([key, label]) => (
                    <button className={`feature-chip ${activeFeatures.includes(key) ? "active" : ""}`} key={key} type="button" onClick={() => toggleFeature(key)} aria-pressed={activeFeatures.includes(key)}>
                      <span className="chip-mark" aria-hidden="true">{activeFeatures.includes(key) ? <CheckIcon size={12} /> : ""}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <button className="primary-button search-button" type="submit"><SearchIcon />{t.search}</button>
            </form>
          </aside>

          <section className="results-column" id="rentals" aria-labelledby="results-heading">
            <div className="results-toolbar">
              <div>
                <span className="section-label">{filteredListings.length} / {LISTINGS.length} {locale === "zh" ? "示例" : "sample"}</span>
                <h2 id="results-heading">{t.results}</h2>
              </div>
              <label className="sort-control">
                <span>{t.sort}</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label={t.sort}>
                  <option value="fit">{t.bestFit}</option>
                  <option value="price">{t.lowest}</option>
                  <option value="fresh">{t.fresh}</option>
                </select>
              </label>
            </div>

            <div className="synthetic-notice" role="note">
              <span className="notice-mark" aria-hidden="true"><i /><i /></span>
              <p>{t.syntheticNotice}</p>
              <button className="notice-action" type="button" onClick={() => showToast(t.addressPrivate)}>{locale === "zh" ? "为什么" : "Why"}</button>
            </div>

            <div className="listing-list">
              {filteredListings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true"><SearchIcon size={22} /></div>
                  <h3>{t.noResults}</h3>
                  <p>{t.noResultsBody}</p>
                  <button className="outline-button" type="button" onClick={resetFilters}>{t.clearAndTry}</button>
                </div>
              ) : filteredListings.map((listing) => {
                const saved = savedIds.has(listing.id);
                const comparing = compareIds.includes(listing.id);
                return (
                  <article className="listing-card" key={listing.id}>
                    <div className="listing-image-wrap">
                      <Image src={listing.image} alt={locale === "zh" ? `${listing.titleZh} 房源照片` : `${listing.titleEn} listing photo`} fill sizes="(max-width: 600px) 100vw, (max-width: 1080px) 40vw, 31vw" priority={listing.id === "elmwood-light"} />
                      <span className="image-label"><span className="image-label-dot" aria-hidden="true" />{listingFreshness(listing)}</span>
                      <button className={`save-button ${saved ? "is-saved" : ""}`} type="button" onClick={() => toggleSaved(listing.id)} aria-label={saved ? (locale === "zh" ? "取消收藏" : "Remove from saved") : (locale === "zh" ? "收藏房源" : "Save listing")} aria-pressed={saved}>
                        <HeartIcon filled={saved} />
                      </button>
                    </div>
                    <div className="listing-body">
                      <div className="listing-topline">
                        <span className="listing-type">{listingType(listing)}</span>
                        <span className="listing-source">{listingPoster(listing)}</span>
                      </div>
                      <h3>{listingTitle(listing)}</h3>
                      <p className="listing-area"><PinIcon size={15} />{listingArea(listing)}</p>
                      <div className="price-line">
                        <strong>{formatPrice(listing)}</strong>
                        <span>{t.month}</span>
                        <span className="cost-badge"><CheckIcon size={11} />{t.costBreakdown}</span>
                      </div>
                      <div className="listing-facts" aria-label={locale === "zh" ? "房源基本信息" : "Listing basics"}>
                        <span><b>{listing.bedrooms}</b> {locale === "zh" ? "卧室" : "bed"}</span>
                        <span><b>{listing.bathrooms}</b> {locale === "zh" ? "卫" : "bath"}</span>
                        <span><b>{listing.moveIn}</b> {locale === "zh" ? "入住" : "move-in"}</span>
                        <span><b>{listing.lease}</b> {locale === "zh" ? "租期" : "lease"}</span>
                      </div>
                      <div className="tag-row">
                        {listingTags(listing).map((tag) => <span className="listing-tag" key={tag}>{tag}</span>)}
                      </div>
                      <div className="trust-row">
                        <span><span className="trust-icon blue"><PinIcon size={12} /></span>{t.locationChecked}</span>
                        <span><span className="trust-icon lime"><CheckIcon size={12} /></span>{t.availability}</span>
                        <span className="privacy-signal"><LockIcon size={12} />{listingPrivacy(listing)}</span>
                      </div>
                      <div className="listing-actions">
                        <button className="link-button" type="button" onClick={() => setSelectedListing(listing)}>{t.view}<ArrowIcon size={15} /></button>
                        <div className="action-group">
                          <button className={`compare-button ${comparing ? "active" : ""}`} type="button" onClick={() => toggleCompare(listing.id)} aria-pressed={comparing}>{comparing ? <CheckIcon size={13} /> : ""}{comparing ? t.comparing : t.compare}</button>
                          <button className="contact-button" type="button" onClick={() => setContactListing(listing)}><ChatIcon size={15} />{t.contact}</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {compareListings.length > 0 && (
              <aside className="compare-bar" aria-label={t.comparing}>
                <div className="compare-heading">
                  <span className="compare-count">{compareListings.length}</span>
                  <div><strong>{t.comparing}</strong><small>{locale === "zh" ? "把关键条件放在一起看" : "Put the important facts side by side"}</small></div>
                </div>
                <div className="compare-items">
                  {compareListings.map((listing) => <span key={listing.id}>{listingTitle(listing)}<button type="button" onClick={() => toggleCompare(listing.id)} aria-label={`${t.close} ${listingTitle(listing)}`}><CloseIcon size={13} /></button></span>)}
                </div>
                <button className="compare-cta" type="button" onClick={() => showToast(locale === "zh" ? "比较视图即将加入" : "Comparison view is next in the build")}>{locale === "zh" ? "打开比较" : "Open compare"}<ArrowIcon size={15} /></button>
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

      {selectedListing && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedListing(null); }}>
          <aside className="drawer detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="drawer-image-wrap"><Image src={selectedListing.image} alt="" fill sizes="620px" /><button className="drawer-close image-close" type="button" onClick={() => setSelectedListing(null)} aria-label={t.close}><CloseIcon /></button><span className="drawer-image-note"><LockIcon size={13} />{t.approximate}</span></div>
            <div className="drawer-content">
              <div className="drawer-heading"><span className="listing-type">{listingType(selectedListing)}</span><button className="drawer-close" type="button" onClick={() => setSelectedListing(null)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="detail-title">{listingTitle(selectedListing)}</h2>
              <p className="listing-area"><PinIcon size={15} />{listingArea(selectedListing)}</p>
              <p className="drawer-intro">{t.detailsIntro}</p>
              <div className="detail-price"><strong>{formatPrice(selectedListing)}</strong><span>{t.month}</span></div>
              <div className="detail-grid">
                <div><small>{t.detailArea}</small><strong>{listingArea(selectedListing)}</strong></div>
                <div><small>{t.detailMoveIn}</small><strong>{selectedListing.moveIn}</strong></div>
                <div><small>{t.detailLease}</small><strong>{selectedListing.lease}</strong></div>
                <div><small>{t.detailPoster}</small><strong>{listingPoster(selectedListing)}</strong></div>
              </div>
              <h3 className="drawer-section-heading">{t.detailAmenities}</h3>
              <div className="tag-row drawer-tags">{listingTags(selectedListing).map((tag) => <span className="listing-tag" key={tag}>{tag}</span>)}</div>
              <div className="drawer-privacy"><div className="privacy-icon"><LockIcon /></div><div><strong>{t.addressPrivate}</strong><p>{listingPrivacy(selectedListing)}</p></div></div>
              <button className="primary-button full-button" type="button" onClick={() => { setSelectedListing(null); setContactListing(selectedListing); }}><ChatIcon />{t.requestTour}</button>
            </div>
          </aside>
        </div>
      )}

      {contactListing && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactListing(null); }}>
          <aside className="drawer form-drawer" role="dialog" aria-modal="true" aria-labelledby="contact-title">
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">{contactListing.titleEn}</span><button className="drawer-close" type="button" onClick={() => setContactListing(null)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="contact-title">{t.contactTitle}</h2>
              <p className="drawer-intro">{t.contactIntro}</p>
              <form className="contact-form" onSubmit={submitInquiry}>
                <label className="field-label" htmlFor="contact-move">{t.intendedMove}</label>
                <select id="contact-move" defaultValue="september"><option value="august">Aug 2026</option><option value="september">Sep 2026</option><option value="october">Oct 2026</option></select>
                <label className="field-label" htmlFor="contact-lease">{t.leaseLength}</label>
                <select id="contact-lease" defaultValue="12"><option value="6">6 months</option><option value="12">12 months</option><option value="24">24+ months</option></select>
                <div className="form-row"><div><label className="field-label" htmlFor="contact-occupants">{t.occupants}</label><select id="contact-occupants" defaultValue="1"><option value="1">1</option><option value="2">2</option><option value="3">3+</option></select></div><div><label className="field-label" htmlFor="contact-pets">{t.petsQuestion}</label><select id="contact-pets" defaultValue="no"><option value="no">{t.noPets}</option><option value="yes">{t.yesPets}</option></select></div></div>
                <label className="field-label" htmlFor="contact-message">{t.message}</label>
                <textarea id="contact-message" placeholder={t.messagePlaceholder} rows={4} />
                <p className="form-safety"><ShieldIcon size={15} />{locale === "zh" ? "我们不会在这个阶段要求信用资料或受保护特征。" : "We do not ask for credit files or protected traits at this stage."}</p>
                <button className="primary-button full-button" type="submit"><ChatIcon />{t.sendInquiry}</button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {postOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPostOpen(false); }}>
          <aside className="drawer form-drawer post-drawer" role="dialog" aria-modal="true" aria-labelledby="post-title">
            <div className="drawer-content">
              <div className="drawer-heading"><span className="section-label">POSTER WORKFLOW</span><button className="drawer-close" type="button" onClick={() => setPostOpen(false)} aria-label={t.close}><CloseIcon /></button></div>
              <h2 id="post-title">{t.postTitle}</h2>
              <p className="drawer-intro">{t.postIntro}</p>
              <div className="stage-list">
                {[t.stageProperty, t.stageTerms, t.stageStory, t.stageContact, t.stagePublish].map((stage, index) => <div className="stage-row" key={stage}><span className={`stage-index ${index === 0 ? "current" : ""}`}>{index + 1}</span><span>{stage}</span><span className="stage-state">{index === 0 ? (locale === "zh" ? "开始" : "Start") : (locale === "zh" ? "待开始" : "Next")}</span></div>)}
              </div>
              <div className="post-privacy-note"><LockIcon /><div><strong>{t.addressPrivate}</strong><p>{t.approximate}</p></div></div>
              <button className="primary-button full-button" type="button" onClick={() => { setPostOpen(false); showToast(t.draftStarted); }}>{t.startDraft}<ArrowIcon /></button>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="toast" role="status"><span className="toast-mark"><CheckIcon size={13} /></span>{toast}</div>}
    </main>
  );
}

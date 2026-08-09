"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Locale = "zh" | "en";

type AgentReview = {
  id: string;
  agentProfileId: string;
  rating: number;
  comment: string;
  reviewerRole: "owner" | "renter";
  createdAt: string;
};

type AgentReviewInteraction = {
  listingId: string;
  listingTitleZh: string;
  listingTitleEn: string;
  listingAreaZh: string;
  listingAreaEn: string;
  reviewerRole: "owner" | "renter";
  alreadyReviewed: boolean;
};

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
  reviewCount: number;
  reviewAverage: number;
  reviews: AgentReview[];
  verificationScope: "agent_license";
};

type ReviewAccess = {
  loaded: boolean;
  loading: boolean;
  submitting: boolean;
  error: string;
  signedIn: boolean;
  emailVerified: boolean;
  canReview: boolean;
  interactions: AgentReviewInteraction[];
  reviews: AgentReview[];
  selectedListingId: string;
  rating: number;
  comment: string;
};

type AgentPayload = AgentProfile[] | { error?: string };
type ReviewPayload = { reviews?: AgentReview[]; signedIn?: boolean; emailVerified?: boolean; canReview?: boolean; interactions?: AgentReviewInteraction[]; error?: string };

function profileName(profile: AgentProfile, locale: Locale) {
  return locale === "zh" ? profile.displayNameZh : profile.displayNameEn;
}

function matchesValue(value: string, query: string) {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function roleLabel(role: AgentReviewInteraction["reviewerRole"] | AgentReview["reviewerRole"], zh: boolean) {
  return role === "owner" ? (zh ? "房主" : "Owner") : (zh ? "租客" : "Renter");
}

function reviewDate(value: string, zh: boolean) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(zh ? "zh-CN" : "en-US", { year: "numeric", month: "short" });
}

function emptyReviewAccess(): ReviewAccess {
  return { loaded: false, loading: false, submitting: false, error: "", signedIn: false, emailVerified: false, canReview: false, interactions: [], reviews: [], selectedListingId: "", rating: 0, comment: "" };
}

export default function AgentDirectory() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [area, setArea] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewAccess, setReviewAccess] = useState<Record<string, ReviewAccess>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as AgentPayload;
        if (!response.ok) throw new Error((result as { error?: string }).error || "Agent profiles could not be loaded.");
        if (!cancelled) setProfiles(Array.isArray(result) ? result : []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Agent profiles could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const languages = useMemo(() => [...new Set(profiles.flatMap((profile) => profile.languages))].sort(), [profiles]);
  const areas = useMemo(() => [...new Set(profiles.flatMap((profile) => profile.serviceAreas))].sort(), [profiles]);
  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim();
    return profiles.filter((profile) => {
      const searchable = [profile.displayNameZh, profile.displayNameEn, profile.brokerage, ...profile.serviceAreas, ...profile.languages].join(" ");
      return (!normalizedQuery || matchesValue(searchable, normalizedQuery))
        && (!language || profile.languages.includes(language))
        && (!area || profile.serviceAreas.includes(area));
    });
  }, [area, language, profiles, query]);

  const zh = locale === "zh";
  const clearFilters = () => {
    setQuery("");
    setLanguage("");
    setArea("");
  };

  const loadReviewAccess = async (agentProfileId: string) => {
    const current = reviewAccess[agentProfileId];
    if (current?.loading || current?.loaded) return;
    setReviewAccess((state) => ({ ...state, [agentProfileId]: { ...(state[agentProfileId] || emptyReviewAccess()), loading: true, error: "" } }));
    try {
      const response = await fetch(`/api/agent-reviews?agentProfileId=${encodeURIComponent(agentProfileId)}`, { cache: "no-store" });
      const result = await response.json() as ReviewPayload;
      if (!response.ok) throw new Error(result.error || (zh ? "评价暂时无法加载。" : "Reviews are unavailable right now."));
      const interactions = Array.isArray(result.interactions) ? result.interactions : [];
      const available = interactions.find((interaction) => !interaction.alreadyReviewed);
      setReviewAccess((state) => ({ ...state, [agentProfileId]: { ...(state[agentProfileId] || emptyReviewAccess()), loaded: true, loading: false, error: "", signedIn: result.signedIn === true, emailVerified: result.emailVerified === true, canReview: result.canReview === true, interactions, reviews: Array.isArray(result.reviews) ? result.reviews : [], selectedListingId: available?.listingId || "", rating: 0, comment: "" } }));
    } catch (loadError) {
      setReviewAccess((state) => ({ ...state, [agentProfileId]: { ...(state[agentProfileId] || emptyReviewAccess()), loaded: true, loading: false, error: loadError instanceof Error ? loadError.message : (zh ? "评价暂时无法加载。" : "Reviews are unavailable right now.") } }));
    }
  };

  const toggleProfile = (agentProfileId: string) => {
    const nextExpanded = expandedId === agentProfileId ? null : agentProfileId;
    setExpandedId(nextExpanded);
    if (nextExpanded) void loadReviewAccess(nextExpanded);
  };

  const updateReviewDraft = (agentProfileId: string, changes: Partial<ReviewAccess>) => {
    setReviewAccess((state) => ({ ...state, [agentProfileId]: { ...(state[agentProfileId] || emptyReviewAccess()), ...changes } }));
  };

  const submitReview = async (profile: AgentProfile) => {
    const access = reviewAccess[profile.id];
    if (!access || !access.selectedListingId || access.rating < 1) return;
    updateReviewDraft(profile.id, { submitting: true, error: "" });
    try {
      const response = await fetch("/api/agent-reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentProfileId: profile.id, listingId: access.selectedListingId, rating: access.rating, comment: access.comment }) });
      const result = await response.json() as { review?: AgentReview; error?: string };
      if (!response.ok || !result.review) throw new Error(result.error || (zh ? "评价暂时无法保存。" : "The review could not be saved."));
      const review = result.review;
      const previousCount = Number(profile.reviewCount || 0);
      const nextCount = previousCount + 1;
      const nextAverage = ((Number(profile.reviewAverage || 0) * previousCount) + review.rating) / nextCount;
      setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, reviewCount: nextCount, reviewAverage: Math.round(nextAverage * 10) / 10, reviews: [review, ...item.reviews].slice(0, 3) } : item));
      updateReviewDraft(profile.id, { submitting: false, error: "", canReview: access.interactions.some((interaction) => interaction.listingId !== access.selectedListingId && !interaction.alreadyReviewed), interactions: access.interactions.map((interaction) => interaction.listingId === access.selectedListingId ? { ...interaction, alreadyReviewed: true } : interaction), reviews: [review, ...access.reviews].slice(0, 40), selectedListingId: "", rating: 0, comment: "" });
    } catch (submitError) {
      updateReviewDraft(profile.id, { submitting: false, error: submitError instanceof Error ? submitError.message : (zh ? "评价暂时无法保存。" : "The review could not be saved.") });
    }
  };

  return (
    <section className="agent-directory" aria-labelledby="agent-directory-heading">
      <div className="agent-directory-intro">
        <div>
          <span className="section-label">{zh ? "经纪目录" : "AGENT DIRECTORY"}</span>
          <h2 id="agent-directory-heading">{zh ? "找一位可以先把边界说清楚的经纪" : "Find an agent who makes the next step clear"}</h2>
        </div>
        <div className="agent-directory-language" role="group" aria-label={zh ? "目录语言" : "Directory language"}>
          <button className={zh ? "active" : ""} type="button" onClick={() => setLocale("zh")} aria-pressed={zh}>中文</button>
          <button className={!zh ? "active" : ""} type="button" onClick={() => setLocale("en")} aria-pressed={!zh}>English</button>
        </div>
      </div>

      <div className="agent-directory-toolbar" role="search">
        <label className="agent-directory-search"><span>{zh ? "搜索姓名、公司或服务区域" : "Search name, brokerage, or service area"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? "例如：法拉盛、Queens、中文" : "Try Flushing, Queens, or Chinese"} /></label>
        <label><span>{zh ? "语言" : "Language"}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="">{zh ? "全部语言" : "All languages"}</option>{languages.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>{zh ? "服务区域" : "Service area"}</span><select value={area} onChange={(event) => setArea(event.target.value)}><option value="">{zh ? "全部区域" : "All areas"}</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button className="text-button agent-directory-reset" type="button" onClick={clearFilters} disabled={!query && !language && !area}>{zh ? "清除筛选" : "Clear"}</button>
      </div>

      <div className="agent-directory-status" aria-live="polite">
        <strong>{loading ? (zh ? "正在加载…" : "Loading…") : `${filteredProfiles.length} ${zh ? "位已核验经纪" : filteredProfiles.length === 1 ? "verified agent" : "verified agents"}`}</strong>
        <span>{zh ? "只展示管理员已核验的经纪档案；评价来自已验证的平台互动。" : "Only admin-approved profiles are shown; reviews come from verified platform interactions."}</span>
      </div>

      {error && <div className="agent-directory-message error" role="alert"><strong>{zh ? "目录暂时无法加载" : "The directory is unavailable"}</strong><p>{error}</p><button className="outline-button" type="button" onClick={() => window.location.reload()}>{zh ? "重新加载" : "Reload"}</button></div>}
      {!error && loading && <div className="agent-directory-loading" aria-label={zh ? "正在加载经纪" : "Loading agents"}><span /><span /><span /></div>}
      {!error && !loading && filteredProfiles.length === 0 && <div className="agent-directory-message"><strong>{zh ? "还没有符合条件的已核验经纪" : "No verified agents match those filters"}</strong><p>{zh ? "试试清除筛选，或者稍后再回来查看新完成核验的经纪。" : "Clear the filters or check back as more agents complete review."}</p><button className="outline-button" type="button" onClick={clearFilters} disabled={!query && !language && !area}>{zh ? "查看全部" : "Show all"}</button></div>}
      {!error && !loading && filteredProfiles.length > 0 && <div className="agent-directory-list">
        {filteredProfiles.map((profile) => {
          const expanded = expandedId === profile.id;
          const name = profileName(profile, locale);
          const access = reviewAccess[profile.id];
          const reviews = access?.reviews.length ? access.reviews : profile.reviews;
          const reviewCount = Number(profile.reviewCount || 0);
          const reviewAverage = Number(profile.reviewAverage || 0);
          const availableInteractions = access?.interactions.filter((interaction) => !interaction.alreadyReviewed) || [];
          return <article className={`agent-directory-row ${expanded ? "expanded" : ""}`} key={profile.id}>
            <div className="agent-directory-avatar" aria-hidden="true">{profile.portraitUrl ? <Image src={profile.portraitUrl} alt="" width={72} height={72} /> : name.slice(0, 1)}</div>
            <div className="agent-directory-main">
              <div className="agent-directory-row-heading"><div><span className="agent-directory-verified"><span aria-hidden="true" />{zh ? "执照已核验" : "License checked"}</span><h3>{name}</h3></div><button className="text-button" type="button" onClick={() => toggleProfile(profile.id)} aria-expanded={expanded}>{expanded ? (zh ? "收起资料" : "Hide profile") : (zh ? "查看资料" : "View profile")}</button></div>
              <p className="agent-directory-brokerage">{profile.brokerage} · {profile.licenseState} {zh ? "州" : "state"}</p>
              <div className="agent-directory-meta"><span>{zh ? "服务" : "Areas"}: {profile.serviceAreas.join(" · ") || (zh ? "待补充" : "To be added")}</span><span>{zh ? "语言" : "Languages"}: {profile.languages.join(" / ") || (zh ? "待补充" : "To be added")}</span><span>{reviewCount > 0 ? `${reviewAverage.toFixed(1)} / 5 · ${reviewCount} ${zh ? "条评价" : reviewCount === 1 ? "review" : "reviews"}` : (zh ? "暂无评价" : "No reviews yet")}</span></div>
              {expanded && <>
                <div className="agent-directory-expanded"><div><span className="section-label">{zh ? "费用说明" : "FEE NOTE"}</span><p>{zh ? profile.feeSummaryZh || "费用由经纪与房主或租客另行确认。" : profile.feeSummaryEn || "Confirm fees directly with the agent before working together."}</p></div><div><span className="section-label">{zh ? "核验范围" : "VERIFICATION SCOPE"}</span><p>{zh ? "管理员根据州公开记录核对执照信息；这不代表政府背书，也不保证交易结果。" : "An admin checked the license against public state records. This is not government endorsement and does not guarantee a transaction."}</p></div></div>
                <section className="agent-directory-review-panel" aria-labelledby={`agent-reviews-${profile.id}`}>
                  <div className="agent-directory-review-heading"><div><span className="section-label">{zh ? "已验证评价" : "VERIFIED REVIEWS"}</span><h4 id={`agent-reviews-${profile.id}`}>{reviewCount > 0 ? `${reviewAverage.toFixed(1)} / 5` : (zh ? "还没有评价" : "No reviews yet")}</h4></div><span>{zh ? "仅来自已完成的平台互动" : "Verified platform interactions only"}</span></div>
                  {access?.loading && <p className="agent-directory-review-status" aria-live="polite">{zh ? "正在读取评价和可评价的互动…" : "Loading reviews and eligible interactions…"}</p>}
                  {access?.error && <p className="agent-directory-review-status error" role="alert">{access.error}</p>}
                  {!access?.loading && !access?.error && reviews.length > 0 && <div className="agent-directory-review-list">{reviews.map((review) => <article className="agent-directory-review" key={review.id}><div><strong>{review.rating} / 5</strong><span>{roleLabel(review.reviewerRole, zh)} · {reviewDate(review.createdAt, zh)}</span></div>{review.comment && <p>{review.comment}</p>}</article>)}</div>}
                  {!access?.loading && !access?.error && reviews.length === 0 && <p className="agent-directory-review-empty">{zh ? "完成一次已验证的经纪互动后，房主或租客可以留下第一条评价。" : "Owners or renters can leave the first review after a verified agent interaction."}</p>}
                  {!access?.loading && !access?.error && access?.signedIn && !access.emailVerified && <p className="agent-directory-review-status">{zh ? "请先验证邮箱，再提交评价。" : "Verify your email before submitting a review."}</p>}
                  {!access?.loading && !access?.error && access?.signedIn && access.emailVerified && access.canReview && <form className="agent-directory-review-form" onSubmit={(event) => { event.preventDefault(); void submitReview(profile); }}><label><span>{zh ? "选择已验证互动" : "Verified interaction"}</span><select value={access.selectedListingId} onChange={(event) => updateReviewDraft(profile.id, { selectedListingId: event.target.value })} required><option value="">{zh ? "选择房源" : "Choose a listing"}</option>{availableInteractions.map((interaction) => <option key={interaction.listingId} value={interaction.listingId}>{zh ? interaction.listingTitleZh : interaction.listingTitleEn} · {roleLabel(interaction.reviewerRole, zh)}</option>)}</select></label><fieldset className="agent-directory-rating"><legend>{zh ? "评分" : "Rating"}</legend>{[1, 2, 3, 4, 5].map((value) => <button className={access.rating === value ? "active" : ""} key={value} type="button" onClick={() => updateReviewDraft(profile.id, { rating: value })} aria-pressed={access.rating === value}>{value}</button>)}</fieldset><label><span>{zh ? "评价内容（可选）" : "Comment (optional)"}</span><textarea value={access.comment} onChange={(event) => updateReviewDraft(profile.id, { comment: event.target.value })} maxLength={600} rows={3} placeholder={zh ? "请分享服务体验，不要填写电话、精确地址或其他私人信息。" : "Share the service experience; do not include phone numbers, exact addresses, or private details."} /></label>{access.error && <p className="form-error" role="alert">{access.error}</p>}<div className="agent-directory-review-actions"><button className="primary-button" type="submit" disabled={access.submitting || !access.selectedListingId || access.rating < 1}>{access.submitting ? (zh ? "发布中…" : "Publishing…") : (zh ? "发布评价" : "Publish review")}</button><small>{zh ? "每个已验证房源互动只能评价一次。" : "One review per verified listing interaction."}</small></div></form>}
                  {!access?.loading && !access?.error && access?.signedIn && access.emailVerified && !access.canReview && <p className="agent-directory-review-status">{zh ? "完成并关闭咨询、或完成租赁申请后，这里会出现评价入口。" : "The review option appears after a completed inquiry or rental application."}</p>}
                  {!access?.loading && !access?.error && access && !access.signedIn && <p className="agent-directory-review-status">{zh ? "登录并完成一次已验证互动后，可以留下评价。" : "Sign in and complete a verified interaction to leave a review."}</p>}
                </section>
              </>}
              <div className="agent-directory-row-footer"><span>{reviewCount > 0 ? (zh ? `${reviewCount} 条已验证评价` : `${reviewCount} verified ${reviewCount === 1 ? "review" : "reviews"}`) : (zh ? "评价来自已验证的平台互动" : "Reviews come from verified platform interactions")}</span><a className="link-button" href={`/?agent=${encodeURIComponent(profile.id)}`}>{zh ? "发布房源时选择" : "Choose when posting"}<span aria-hidden="true">→</span></a></div>
            </div>
          </article>;
        })}
      </div>}
    </section>
  );
}

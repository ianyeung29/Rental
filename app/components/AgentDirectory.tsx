"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Locale = "zh" | "en";

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
  verificationScope: "agent_license";
};

function profileName(profile: AgentProfile, locale: Locale) {
  return locale === "zh" ? profile.displayNameZh : profile.displayNameEn;
}

function matchesValue(value: string, query: string) {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

export default function AgentDirectory() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [area, setArea] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as AgentProfile[] | { error?: string };
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
        <span>{zh ? "只展示管理员已核验的经纪档案。" : "Only admin-approved agent profiles are shown."}</span>
      </div>

      {error && <div className="agent-directory-message error" role="alert"><strong>{zh ? "目录暂时无法加载" : "The directory is unavailable"}</strong><p>{error}</p><button className="outline-button" type="button" onClick={() => window.location.reload()}>{zh ? "重新加载" : "Reload"}</button></div>}
      {!error && loading && <div className="agent-directory-loading" aria-label={zh ? "正在加载经纪" : "Loading agents"}><span /><span /><span /></div>}
      {!error && !loading && filteredProfiles.length === 0 && <div className="agent-directory-message"><strong>{zh ? "还没有符合条件的已核验经纪" : "No verified agents match those filters"}</strong><p>{zh ? "试试清除筛选，或者稍后再回来查看新完成核验的经纪。" : "Clear the filters or check back as more agents complete review."}</p><button className="outline-button" type="button" onClick={clearFilters} disabled={!query && !language && !area}>{zh ? "查看全部" : "Show all"}</button></div>}
      {!error && !loading && filteredProfiles.length > 0 && <div className="agent-directory-list">
        {filteredProfiles.map((profile) => {
          const expanded = expandedId === profile.id;
          const name = profileName(profile, locale);
          return <article className={`agent-directory-row ${expanded ? "expanded" : ""}`} key={profile.id}>
            <div className="agent-directory-avatar" aria-hidden="true">{profile.portraitUrl ? <Image src={profile.portraitUrl} alt="" width={72} height={72} unoptimized /> : name.slice(0, 1)}</div>
            <div className="agent-directory-main">
              <div className="agent-directory-row-heading"><div><span className="agent-directory-verified"><span aria-hidden="true" />{zh ? "执照已核验" : "License checked"}</span><h3>{name}</h3></div><button className="text-button" type="button" onClick={() => setExpandedId(expanded ? null : profile.id)} aria-expanded={expanded}>{expanded ? (zh ? "收起资料" : "Hide profile") : (zh ? "查看资料" : "View profile")}</button></div>
              <p className="agent-directory-brokerage">{profile.brokerage} · {profile.licenseState} {zh ? "州" : "state"}</p>
              <div className="agent-directory-meta"><span>{zh ? "服务" : "Areas"}: {profile.serviceAreas.join(" · ") || (zh ? "待补充" : "To be added")}</span><span>{zh ? "语言" : "Languages"}: {profile.languages.join(" / ") || (zh ? "待补充" : "To be added")}</span></div>
              {expanded && <div className="agent-directory-expanded"><div><span className="section-label">{zh ? "费用说明" : "FEE NOTE"}</span><p>{zh ? profile.feeSummaryZh || "费用由经纪与房主或租客另行确认。" : profile.feeSummaryEn || "Confirm fees directly with the agent before working together."}</p></div><div><span className="section-label">{zh ? "核验范围" : "VERIFICATION SCOPE"}</span><p>{zh ? "管理员根据州公开记录核对执照信息；这不代表政府背书，也不保证交易结果。" : "An admin checked the license against public state records. This is not government endorsement and does not guarantee a transaction."}</p></div></div>}
              <div className="agent-directory-row-footer"><span>{zh ? "交易完成后的评价功能即将开放" : "Reviews will appear after verified transactions are supported"}</span><a className="link-button" href={`/?agent=${encodeURIComponent(profile.id)}`}>{zh ? "发布房源时选择" : "Choose when posting"}<span aria-hidden="true">→</span></a></div>
            </div>
          </article>;
        })}
      </div>}
    </section>
  );
}

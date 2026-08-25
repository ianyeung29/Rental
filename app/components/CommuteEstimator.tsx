"use client";

import { FormEvent, useState } from "react";
import type { LocationContextTransitLine } from "../lib/location-context";

type Locale = "zh" | "en";
type CommuteMode = "drive" | "walk" | "transit";
type CommuteResult = {
  source: "google" | "none";
  approximateArea: string;
  origin: "privateAddress" | "approximateArea";
  destination: string;
  mode: CommuteMode;
  minutes?: number;
  transitLines?: LocationContextTransitLine[];
  cached: boolean;
  note: string;
  checkedAt?: string;
};

const quickDestinations = [
  { zh: "法拉盛市中心（公共交通）", en: "Downtown Flushing (public transit)", valueZh: "法拉盛市中心", valueEn: "Downtown Flushing", mode: "transit" as const },
  { zh: "布鲁克林八大道（公共交通）", en: "Brooklyn 8th Avenue (public transit)", valueZh: "布鲁克林八大道", valueEn: "Brooklyn 8th Avenue", mode: "transit" as const },
  { zh: "附近中文超市（步行）", en: "A nearby Chinese supermarket (walk)", valueZh: "附近中文超市", valueEn: "a nearby Chinese supermarket", mode: "walk" as const, preset: "nearbyChineseSupermarket" as const },
];

function transitLineLabel(line: LocationContextTransitLine, zh: boolean) {
  const vehicle = line.vehicleType === "BUS" ? (zh ? "公交" : "Bus") : line.vehicleType === "SUBWAY" || line.vehicleType === "METRO_RAIL" ? (zh ? "地铁" : "Subway") : line.vehicleType === "TRAIN" || line.vehicleType === "RAIL" || line.vehicleType === "HEAVY_RAIL" || line.vehicleType === "COMMUTER_TRAIN" ? (zh ? "铁路" : "Rail") : "";
  const name = line.shortName || line.name;
  return vehicle ? `${vehicle} ${name}` : name;
}

function checkedAtLabel(value: string | undefined, zh: boolean) {
  if (!value) return zh ? "检查时间暂不可用" : "Checked time unavailable";
  try {
    return new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function CommuteEstimator({ locale, areaZh, areaEn, listingId, canUsePrivateOrigin = false }: { locale: Locale; areaZh: string; areaEn: string; listingId?: string; canUsePrivateOrigin?: boolean }) {
  const zh = locale === "zh";
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<CommuteMode>("drive");
  const [preset, setPreset] = useState<"nearbyChineseSupermarket" | null>(null);
  const [result, setResult] = useState<CommuteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!destination.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/commute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          areaZh,
          areaEn,
          destination: destination.trim(),
          mode,
          ...(preset === "nearbyChineseSupermarket" && canUsePrivateOrigin && listingId ? { preset, listingId } : {}),
        }),
      });
      const payload = await response.json() as CommuteResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || (zh ? "路线估算暂时不可用。" : "The route estimate is unavailable."));
      setResult(payload);
    } catch (submitError) {
      setResult(null);
      setError(submitError instanceof Error ? submitError.message : (zh ? "路线估算暂时不可用。" : "The route estimate is unavailable."));
    } finally {
      setLoading(false);
    }
  };

  return <section className="commute-panel" aria-labelledby="commute-panel-title">
    <div className="commute-heading"><div><span className="section-label">AREA CONTEXT</span><h3 id="commute-panel-title">{zh ? "估算到华人商圈、地铁或公交的时间" : "Estimate routes to Chinese hubs and transit"}</h3><p>{zh ? "商圈、学校等目的地按公开大致区域估算；“附近中文超市”会在服务器端按私密地址匹配最近超市，只显示名称和步行时间。" : "Hubs, schools, and other destinations use the public approximate area. The nearby Chinese supermarket shortcut matches the closest store from the private address on the server and shows only its name and walking time."}</p></div></div>
    <form className="commute-form" onSubmit={submit}>
      <label className="field-label" htmlFor="commute-destination">{zh ? "目的地" : "Destination"}<input id="commute-destination" value={destination} onChange={(event) => { setDestination(event.target.value); setPreset(null); }} placeholder={zh ? "例如：法拉盛市中心、NYU" : "e.g. Downtown Flushing, NYU"} maxLength={180} /></label>
      <label className="field-label" htmlFor="commute-mode">{zh ? "出行方式" : "Travel mode"}<select id="commute-mode" value={mode} onChange={(event) => { const nextMode = event.target.value as CommuteMode; setMode(nextMode); if (nextMode !== "walk") setPreset(null); }}><option value="drive">{zh ? "驾车" : "Drive"}</option><option value="transit">{zh ? "公共交通" : "Public transit"}</option><option value="walk">{zh ? "步行" : "Walk"}</option></select></label>
      <button className="primary-button commute-submit" type="submit" disabled={!destination.trim() || loading}>{loading ? (zh ? "估算中…" : "Estimating…") : (zh ? "估算时间" : "Estimate time")}</button>
    </form>
    <div className="commute-quick-options" aria-label={zh ? "常用目的地" : "Common destinations"}>{quickDestinations.map((item) => <button className="commute-quick-option" type="button" key={item.en} onClick={() => { setDestination(zh ? item.valueZh : item.valueEn); setMode(item.mode); setPreset(item.preset || null); setError(""); }}>{zh ? item.zh : item.en}</button>)}</div>
    {error && <p className="commute-error" role="alert">{error}</p>}
    {result && <div className={`commute-result ${result.source === "google" ? "ready" : "empty"}`} role="status"><div className="commute-result-summary"><strong>{result.minutes ? (zh ? `约 ${result.minutes} 分钟` : `About ${result.minutes} min`) : (zh ? "暂时没有路线时间" : "No route time yet")}</strong><div className="commute-result-place"><span>{result.origin === "privateAddress" ? (zh ? "按私密地址匹配的超市" : "Supermarket matched from private address") : (zh ? "地图匹配地点" : "Map-matched place")}</span><b>{result.destination}</b></div></div>{result.transitLines?.length ? <div className="commute-transit-lines"><span className="commute-transit-lines-label">{zh ? "线路参考" : "Line reference"}</span>{result.transitLines.map((line) => <span className="commute-transit-line" key={line.shortName || line.name}>{transitLineLabel(line, zh)}</span>)}</div> : null}<p>{result.note}</p><small>{zh ? `数据来源：Google 地图 · 最后检查：${checkedAtLabel(result.checkedAt, zh)}` : `Source: Google Maps · Last checked: ${checkedAtLabel(result.checkedAt, zh)}`}</small>{result.cached && <small>{zh ? "已使用缓存，没有重复查询地图。" : "Cached result; no new map lookup was made."}</small>}{result.source === "google" && <small className="google-attribution">Powered by Google, © 2026 Google</small>}</div>}
  </section>;
}

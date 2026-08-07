"use client";

import { FormEvent, useState } from "react";
import type { LocationContextTransitLine } from "../lib/location-context";

type Locale = "zh" | "en";
type CommuteMode = "drive" | "walk" | "transit";
type CommuteResult = {
  source: "google" | "none";
  approximateArea: string;
  destination: string;
  mode: CommuteMode;
  minutes?: number;
  transitLines?: LocationContextTransitLine[];
  cached: boolean;
  note: string;
};

const quickDestinations = [
  { zh: "法拉盛市中心（公共交通）", en: "Downtown Flushing (public transit)", valueZh: "法拉盛市中心", valueEn: "Downtown Flushing", mode: "transit" as const },
  { zh: "布鲁克林八大道（公共交通）", en: "Brooklyn 8th Avenue (public transit)", valueZh: "布鲁克林八大道", valueEn: "Brooklyn 8th Avenue", mode: "transit" as const },
  { zh: "附近中文超市（步行）", en: "A nearby Chinese supermarket (walk)", valueZh: "附近中文超市", valueEn: "a nearby Chinese supermarket", mode: "walk" as const },
];

function transitLineLabel(line: LocationContextTransitLine, zh: boolean) {
  const vehicle = line.vehicleType === "BUS" ? (zh ? "公交" : "Bus") : line.vehicleType === "SUBWAY" || line.vehicleType === "METRO_RAIL" ? (zh ? "地铁" : "Subway") : line.vehicleType === "TRAIN" || line.vehicleType === "RAIL" || line.vehicleType === "HEAVY_RAIL" || line.vehicleType === "COMMUTER_TRAIN" ? (zh ? "铁路" : "Rail") : "";
  const name = line.shortName || line.name;
  return vehicle ? `${vehicle} ${name}` : name;
}

export default function CommuteEstimator({ locale, areaZh, areaEn }: { locale: Locale; areaZh: string; areaEn: string }) {
  const zh = locale === "zh";
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<CommuteMode>("drive");
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
        body: JSON.stringify({ locale, areaZh, areaEn, destination: destination.trim(), mode }),
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
    <div className="commute-heading"><div><span className="section-label">AREA CONTEXT</span><h3 id="commute-panel-title">{zh ? "估算到华人商圈、地铁或公交的时间" : "Estimate routes to Chinese hubs and transit"}</h3><p>{zh ? "可一键查看法拉盛市中心、布鲁克林八大道，或输入学校、工作地点和超市。公共交通结果会尽量显示线路编号；时间只按公开大致区域估算。" : "Check Downtown Flushing, Brooklyn 8th Avenue, or enter a school, workplace, or supermarket. Public-transit results show line numbers when available; estimates use only the public approximate area."}</p></div></div>
    <form className="commute-form" onSubmit={submit}>
      <label className="field-label" htmlFor="commute-destination">{zh ? "目的地" : "Destination"}<input id="commute-destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={zh ? "例如：法拉盛市中心、NYU" : "e.g. Downtown Flushing, NYU"} maxLength={180} /></label>
      <label className="field-label" htmlFor="commute-mode">{zh ? "出行方式" : "Travel mode"}<select id="commute-mode" value={mode} onChange={(event) => setMode(event.target.value as CommuteMode)}><option value="drive">{zh ? "驾车" : "Drive"}</option><option value="transit">{zh ? "公共交通" : "Public transit"}</option><option value="walk">{zh ? "步行" : "Walk"}</option></select></label>
      <button className="primary-button commute-submit" type="submit" disabled={!destination.trim() || loading}>{loading ? (zh ? "估算中…" : "Estimating…") : (zh ? "估算时间" : "Estimate time")}</button>
    </form>
    <div className="commute-quick-options" aria-label={zh ? "常用目的地" : "Common destinations"}>{quickDestinations.map((item) => <button className="commute-quick-option" type="button" key={item.en} onClick={() => { setDestination(zh ? item.valueZh : item.valueEn); setMode(item.mode); setError(""); }}>{zh ? item.zh : item.en}</button>)}</div>
    {error && <p className="commute-error" role="alert">{error}</p>}
    {result && <div className={`commute-result ${result.source === "google" ? "ready" : "empty"}`} role="status"><div><strong>{result.minutes ? (zh ? `约 ${result.minutes} 分钟` : `About ${result.minutes} min`) : (zh ? "暂时没有路线时间" : "No route time yet")}</strong><span>{result.destination}</span></div>{result.transitLines?.length ? <div className="commute-transit-lines"><span className="commute-transit-lines-label">{zh ? "线路参考" : "Line reference"}</span>{result.transitLines.map((line) => <span className="commute-transit-line" key={line.shortName || line.name}>{transitLineLabel(line, zh)}</span>)}</div> : null}<p>{result.note}</p>{result.cached && <small>{zh ? "已使用缓存，没有重复查询地图。" : "Cached result; no new map lookup was made."}</small>}{result.source === "google" && <small className="google-attribution">Powered by Google, © 2026 Google</small>}</div>}
  </section>;
}

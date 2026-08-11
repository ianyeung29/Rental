import { findAreaGuide } from "../lib/area-guides";

type Locale = "zh" | "en";

export default function AreaContextPanel({ locale, areaZh, areaEn }: { locale: Locale; areaZh: string; areaEn: string }) {
  const zh = locale === "zh";
  const areaLabel = zh ? (areaZh || areaEn) : (areaEn || areaZh);
  const guide = findAreaGuide(areaEn, areaZh);

  if (!areaLabel) return null;

  return <details className={`area-context-panel ${guide ? "" : "is-empty"}`}>
    <summary className="area-context-heading">
      <div>
        <span className="section-label">{zh ? "区域参考" : "NEIGHBORHOOD NOTES"}</span>
        <h3 id="area-context-title">{guide ? (zh ? guide.titleZh : guide.titleEn) : (zh ? "区域信息正在整理" : "Area information is being built")}</h3>
        <p>{zh ? `公开大致区域：${areaLabel}` : `Public approximate area: ${areaLabel}`}</p>
      </div>
      {guide && <span className="area-context-region">{zh ? guide.regionZh : guide.regionEn}</span>}
    </summary>

    {guide ? <>
      <p className="area-context-summary">{zh ? guide.summaryZh : guide.summaryEn}</p>
      <div className="area-context-highlights">
        {guide.highlights.map((highlight) => <div className="area-context-highlight" key={highlight.labelEn}>
          <strong>{zh ? highlight.labelZh : highlight.labelEn}</strong>
          <p>{zh ? highlight.detailZh : highlight.detailEn}</p>
        </div>)}
      </div>
      <div className="area-school-reference">
        <div>
          <span className="section-label">{zh ? "学校参考" : "SCHOOL REFERENCE"}</span>
          <h4>{zh ? guide.schoolReference.titleZh : guide.schoolReference.titleEn}</h4>
          <p>{zh ? guide.schoolReference.detailZh : guide.schoolReference.detailEn}</p>
        </div>
        <a className="area-context-link" href={guide.schoolReference.href} target="_blank" rel="noreferrer">
          {zh ? guide.schoolReference.linkZh : guide.schoolReference.linkEn}<span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="area-context-disclaimer">{zh ? "学校参考不代表学区分配、学校质量或入读资格。请以官方信息和精确地址核实。" : "This school reference does not represent school assignment, school quality, or enrollment eligibility. Verify with the official source and exact address."}</p>
    </> : <p className="area-context-empty-copy">{zh ? "我们暂时没有这个区域的策划内容。你仍可以使用下方路线估算，按自己的目的地核实交通、超市或学校信息。" : "We do not have a curated snapshot for this area yet. You can still use the route estimator below to check a destination such as transit, a supermarket, or a school."}</p>}
  </details>;
}

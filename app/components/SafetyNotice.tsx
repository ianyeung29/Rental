"use client";

type SafetyNoticeProps = {
  locale: "zh" | "en";
  isSample: boolean;
  isBlocked: boolean;
  onReport: () => void;
  onBlock: () => void;
};

function ShieldMark() {
  return (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 19 6v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SafetyNotice({ locale, isSample, isBlocked, onReport, onBlock }: SafetyNoticeProps) {
  const zh = locale === "zh";
  return (
    <section className="safety-notice" aria-labelledby="listing-safety-title">
      <div className="safety-notice-heading">
        <span className="safety-notice-mark"><ShieldMark /></span>
        <div>
          <span className="section-label">{zh ? "安全提示" : "SAFETY CHECK"}</span>
          <h3 id="listing-safety-title">{zh ? "看房前，先把风险边界说清楚" : "Keep the first conversation safe"}</h3>
        </div>
      </div>
      <ul>
        <li>{zh ? "不要在看房或签约前支付押金、现金或转账。" : "Do not send a deposit, cash, or wire before a tour and a written lease."}</li>
        <li>{zh ? "先在平台内沟通；精确地址只在合适的看房安排后提供。" : "Keep early conversations on-platform; exact addresses come after an appropriate tour arrangement."}</li>
        <li>{zh ? "平台核验只说明对应范围，不保证房源、交易或个人结果。" : "A verification signal covers only its stated scope; it does not guarantee the listing, transaction, or outcome."}</li>
      </ul>
      {isSample && <p className="safety-notice-note">{zh ? "这是示例房源，不代表真实库存或商业报价。" : "This is a synthetic sample and is not live inventory or a commercial offer."}</p>}
      <div className="safety-notice-actions">
        <button className="text-button" type="button" onClick={onReport}>{zh ? "举报房源" : "Report listing"}</button>
        {!isSample && <button className="text-button" type="button" onClick={onBlock} disabled={isBlocked}>{isBlocked ? (zh ? "已屏蔽发布者" : "Publisher blocked") : (zh ? "屏蔽发布者" : "Block publisher")}</button>}
      </div>
    </section>
  );
}

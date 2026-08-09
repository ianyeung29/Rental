"use client";

type SafetyNoticeProps = {
  locale: "zh" | "en";
  isSample: boolean;
  verificationScope: "email" | "agent_license" | "sample" | "none";
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

export default function SafetyNotice({ locale, isSample, verificationScope, isBlocked, onReport, onBlock }: SafetyNoticeProps) {
  const zh = locale === "zh";
  const verification = verificationScope === "agent_license"
    ? { title: zh ? "经纪执照资料已核验" : "Agent license reviewed", detail: zh ? "只说明经纪身份资料通过了对应审核，不代表房源或交易已保证。" : "This covers the agent-role review only; it does not guarantee the property or transaction." }
    : verificationScope === "email"
      ? { title: zh ? "邮箱已验证" : "Email verified", detail: zh ? "只说明发布者可以访问该邮箱，不代表身份、房源或交易已核验。" : "This confirms access to the email, not the person, property, or transaction." }
      : verificationScope === "sample"
        ? { title: zh ? "示例房源" : "Synthetic sample", detail: zh ? "这是体验数据，不代表真实库存或商业报价。" : "This is experience data, not live inventory or a commercial offer." }
        : { title: zh ? "暂未显示核验信号" : "No verification signal shown", detail: zh ? "请通过平台咨询、看房和举报流程进一步核实。" : "Use the inquiry, tour, and report flows to verify what matters next." };
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
      <div className="safety-verification-panel" aria-label={zh ? "核验范围" : "Verification scope"}>
        <div className="safety-verification-heading"><strong>{zh ? "核验范围" : "Verification scope"}</strong><span>{zh ? "每个信号只代表它写明的范围。" : "Each signal covers only what it says."}</span></div>
        <div className="safety-verification-grid">
          <div className={`safety-verification-signal ${verificationScope !== "none" ? "is-confirmed" : "is-neutral"}`}><span aria-hidden="true">{verificationScope !== "none" ? "✓" : "—"}</span><div><strong>{verification.title}</strong><small>{verification.detail}</small></div></div>
          <div className="safety-verification-signal is-neutral"><span aria-hidden="true">⌖</span><div><strong>{zh ? "大致区域" : "Approximate area"}</strong><small>{zh ? "公开页面不会显示精确地址；看房前请确认路线和地点。" : "The public page does not show the exact address; confirm the route and place before touring."}</small></div></div>
          <div className="safety-verification-signal is-neutral"><span aria-hidden="true">i</span><div><strong>{zh ? "房源信息由发布者提供" : "Listing facts are poster-provided"}</strong><small>{zh ? "租金、房况、照片和可入住时间仍需在咨询和看房中核实。" : "Confirm rent, condition, photos, and availability in the conversation and tour."}</small></div></div>
        </div>
      </div>
      {isSample && <p className="safety-notice-note">{zh ? "这是示例房源，不代表真实库存或商业报价。" : "This is a synthetic sample and is not live inventory or a commercial offer."}</p>}
      <div className="safety-notice-actions">
        <button className="text-button" type="button" onClick={onReport}>{zh ? "举报房源" : "Report listing"}</button>
        {!isSample && <button className="text-button" type="button" onClick={onBlock} disabled={isBlocked}>{isBlocked ? (zh ? "已屏蔽发布者" : "Publisher blocked") : (zh ? "屏蔽发布者" : "Block publisher")}</button>}
      </div>
    </section>
  );
}

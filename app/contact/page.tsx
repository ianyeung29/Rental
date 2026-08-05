import type { Metadata } from "next";
import ContactForm from "../components/ContactForm";
import PublicPageShell from "../components/PublicPageShell";

export const metadata: Metadata = {
  title: "联系我们 · 安居",
  description: "联系安居，获取租客、房东、经纪、隐私与房源问题的帮助。",
};

export default function ContactPage() {
  return (
    <PublicPageShell
      title="需要帮助？从正确的入口开始。"
      description="请留下你的问题和邮箱。我们会把留言发送到安居运营邮箱，并通过 Resend 回复你。"
    >
      <section className="public-split public-section-first">
        <div className="public-copy-stack">
          <span className="section-label">CONTACT ROUTES</span>
          <h2>不同问题，走不同路径。</h2>
          <p>我们把常见的沟通场景放在一起，减少你在找谁帮忙时的时间。提交表单时选择一个主题即可。</p>

          <div className="public-route-list">
            <div>
              <strong>租客找房</strong>
              <p>房源信息、看房沟通或入住条件不清楚？可以在留言中附上房源标题。</p>
            </div>
            <div>
              <strong>房东与经纪</strong>
              <p>发布房源、AI 润色、经纪协助或草稿流程遇到问题？请说明你卡在哪一步。</p>
            </div>
            <div>
              <strong>安全与隐私</strong>
              <p>发现疑似诈骗、歧视、骚扰或隐私问题，请选择对应主题并提供必要线索。</p>
            </div>
          </div>

          <p className="public-muted-note">急于看房时，请直接使用房源页的“开始联系”。公共表单适合产品帮助与运营问题。</p>
        </div>
        <ContactForm />
      </section>
    </PublicPageShell>
  );
}

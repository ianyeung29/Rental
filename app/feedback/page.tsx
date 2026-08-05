import type { Metadata } from "next";
import FeedbackForm from "../components/FeedbackForm";
import PublicPageShell from "../components/PublicPageShell";

export const metadata: Metadata = {
  title: "提交反馈 · 安居",
  description: "告诉安居哪些地方好用、哪里让你卡住，以及下一步最值得改进什么。",
};

export default function FeedbackPage() {
  return (
    <PublicPageShell
      title="每一条反馈，都会影响下一版。"
      description="安居还在试运行。你可以不登录提交体验反馈、错误报告和区域建议；如果留下邮箱，我们可以回复你。"
    >
      <section className="public-split public-section-first">
        <div className="public-copy-stack">
          <span className="section-label">FEEDBACK LOOP</span>
          <h2>请告诉我们哪里不顺。</h2>
          <p>最有帮助的反馈通常包含三个部分：你想做什么、在哪一步卡住、你希望看到什么。</p>
          <div className="public-feedback-prompts">
            <p><strong>例如：</strong>“我在搜索 Forest Hills 时，只输入英文没有看到中文区域标签。”</p>
            <p>你也可以反馈移动端布局、发布流程、房源标签、AI 文字润色或分享文案。</p>
          </div>
          <a className="text-button public-inline-link" href="/contact">这是账户或安全问题？联系安居 →</a>
        </div>
        <FeedbackForm />
      </section>
    </PublicPageShell>
  );
}

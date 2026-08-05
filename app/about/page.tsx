import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "../components/PublicPageShell";

export const metadata: Metadata = {
  title: "关于安居 · Anjurentals",
  description: "了解安居如何帮助纽约华人社区更清楚、更安心地找房与发布房源。",
};

export default function AboutPage() {
  return (
    <PublicPageShell
      title="让找房与发布，先把关键信息说清楚。"
      description="安居是一个面向纽约华人社区的中文优先租房信息平台。我们把租金、租期、入住时间和隐私边界放在同一个清晰的工作台里。"
    >
      <section className="public-split public-section-first">
        <div className="public-story">
          <span className="section-label">ABOUT ANJURENTALS</span>
          <h2>从一张房源卡开始，减少来回猜测。</h2>
          <p>找房时，你需要知道的不只是一个标题和一张照片。安居把常见的租赁条件结构化，让浏览者更快比较预算、房型、卧室、卫生间、入住时间和租期。</p>
          <p>发布时，房东或经纪可以先用中文写出真实情况，再选择房源特点。AI 润色只帮助整理表达，不替发布者创造事实；准确性仍由发布者负责。</p>
          <div className="public-actions">
            <Link className="primary-button" href="/">开始找房 <span aria-hidden="true">→</span></Link>
            <a className="outline-button" href="/contact">联系安居</a>
          </div>
        </div>

        <aside className="public-note-panel">
          <span className="public-note-mark" aria-hidden="true">01</span>
          <h2>我们的起点</h2>
          <p>先做一个可理解、可比较、可继续沟通的租房信息台，再逐步增加验证、社区与服务。</p>
          <dl className="public-mini-list">
            <div><dt>服务区域</dt><dd>纽约市 · 长岛 · 上州逐步扩展</dd></div>
            <div><dt>使用语言</dt><dd>中文优先，保留英文辅助信息</dd></div>
            <div><dt>当前阶段</dt><dd>产品试运行，功能持续完善</dd></div>
          </dl>
        </aside>
      </section>

      <section className="public-section public-principles" aria-labelledby="principles-title">
        <div className="public-section-heading">
          <span className="section-label">HOW WE WORK</span>
          <h2 id="principles-title">四个会影响产品取舍的原则</h2>
        </div>
        <div className="public-principle-list">
          <article>
            <strong>信息先行</strong>
            <p>租金、房型、入住时间和租期先于营销话术出现。</p>
          </article>
          <article>
            <strong>地址有边界</strong>
            <p>公开页面只显示大致区域，精确地址留到合适的看房沟通中。</p>
          </article>
          <article>
            <strong>沟通更具体</strong>
            <p>联系房东或经纪时，可以选择入住时间、租期和想了解的内容。</p>
          </article>
          <article>
            <strong>公平与安全</strong>
            <p>我们不允许歧视、诈骗、骚扰或误导性房源，并提供举报与反馈入口。</p>
          </article>
        </div>
      </section>

      <section className="public-section public-callout-section">
        <div>
          <span className="section-label">A SMALL PILOT, BUILT IN PUBLIC</span>
          <h2>发现不清楚的地方，直接告诉我们。</h2>
        </div>
        <a className="outline-button" href="/feedback">提交反馈 <span aria-hidden="true">→</span></a>
      </section>
    </PublicPageShell>
  );
}

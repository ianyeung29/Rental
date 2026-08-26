import type { Metadata } from "next";
import PublicPageShell from "../components/PublicPageShell";

export const metadata: Metadata = {
  title: "网站地图 · 安居",
  description: "安居公开页面、帮助入口和平台规则的网站地图。",
};

const directory = [
  {
    title: "主要入口",
    links: [
      ["找房首页", "/"],
      ["经纪目录", "/agents"],
      ["关于安居", "/about"],
      ["发布房源", "/"],
    ],
  },
  {
    title: "帮助与反馈",
    links: [
      ["安装到手机桌面", "/install"],
      ["联系我们", "/contact"],
      ["提交反馈", "/feedback"],
      ["网站地图", "/sitemap"],
    ],
  },
  {
    title: "规则与隐私",
    links: [
      ["法律与平台规则", "/legal"],
      ["Legal and platform policies", "/legal/en"],
      ["使用条款", "/legal#terms"],
      ["隐私说明", "/legal#privacy"],
      ["删除账户", "/delete-account"],
      ["Delete account", "/delete-account/en"],
      ["公平住房", "/legal#fair-housing"],
    ],
  },
];

export default function SitemapPage() {
  return (
    <PublicPageShell
      title="所有公开入口，都从这里开始。"
      description="浏览安居的主要页面、帮助入口和平台规则。房源详情会随着发布内容动态变化。"
    >
      <section className="public-section public-section-first">
        <div className="public-section-heading">
          <span className="section-label">DIRECTORY</span>
          <h2>公开页面</h2>
        </div>
        <div className="sitemap-directory">
          {directory.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <div className="sitemap-links">
                {group.links.map(([label, href]) => <a href={href} key={href}>{label}<span aria-hidden="true">→</span></a>)}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="public-callout-section public-section">
        <div>
          <span className="section-label">FOR SEARCH ENGINES</span>
          <h2>XML sitemap</h2>
          <p>搜索引擎可以通过自动生成的 XML sitemap 发现公开页面。</p>
        </div>
        <a className="outline-button" href="/sitemap.xml">打开 sitemap.xml <span aria-hidden="true">↗</span></a>
      </section>
    </PublicPageShell>
  );
}

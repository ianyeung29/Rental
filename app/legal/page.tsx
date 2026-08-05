import type { Metadata } from "next";
import PublicPageShell from "../components/PublicPageShell";

export const metadata: Metadata = {
  title: "法律与平台规则 · 安居",
  description: "安居的使用条款、隐私说明、公平住房与房源发布规则。",
};

export default function LegalPage() {
  return (
    <PublicPageShell
      title="把平台边界写清楚，才方便放心使用。"
      description="这里汇总安居的试运行版使用条款、隐私说明、公平住房与安全规则。内容是产品草案，正式公开运营前请由合资格律师审核。"
    >
      <div className="legal-notice">
        <strong>试运行说明 / Pilot notice</strong>
        <p>安居是租房信息与沟通平台，不是房东、经纪、租客或租约的一方。页面内容和流程会继续更新，请在签约、付款或提交敏感资料前独立核实。</p>
      </div>

      <div className="legal-layout">
        <aside className="legal-index" aria-label="法律页面目录">
          <span className="section-label">ON THIS PAGE</span>
          <a href="#terms">使用条款</a>
          <a href="#privacy">隐私说明</a>
          <a href="#fair-housing">公平住房与房源标准</a>
          <a href="#safety">安全与平台边界</a>
          <a href="#accessibility">无障碍与联系</a>
        </aside>

        <div className="legal-content">
          <section id="terms" className="legal-section">
            <h2>使用条款 <span>Terms of use</span></h2>
            <p>使用安居，即表示你会提供真实、合法且不误导他人的信息，并会尊重其他用户。房东、经纪和其他发布者对自己发布的房源、价格、可入住时间和沟通内容负责。</p>
            <ul>
              <li>不得发布虚假、重复、过期、冒用他人身份或未获授权发布的房源。</li>
              <li>不得发布歧视性条件、骚扰、威胁、诈骗、恶意导流或违法内容。</li>
              <li>不得利用平台收集他人的密码、社会安全号码、银行信息或其他不必要的敏感资料。</li>
              <li>安居可以为了安全、准确性、隐私或违反规则而隐藏、限制或移除内容，并可能暂停相关功能。</li>
            </ul>
            <p>安居不保证房源一定真实、可用、适合你的情况或一定会促成租约。任何看房、背景核验、付款和签约都应由相关各方自行核实并承担决定。</p>
          </section>

          <section id="privacy" className="legal-section">
            <h2>隐私说明 <span>Privacy notice</span></h2>
            <p>我们会收集你主动提供的信息，例如注册资料、房源内容、咨询表单和联系/反馈表单中的姓名、邮箱与留言。公开页面不会显示房屋精确地址；精确地址用于后续流程时，应只提供给你信任的对象。</p>
            <p>这些信息可能用于提供和保护服务、回复你的问题、发送账户验证邮件、处理房源沟通、改进产品和处理安全报告。图片会通过配置的对象存储服务保存，结构化数据会通过配置的数据库服务保存，邮件会通过 Resend 发送。</p>
            <p>我们不会要求你在公开反馈表单中填写密码、社会安全号码、付款信息或受保护特征。你可以通过<a href="/contact">联系我们</a>询问、更正或删除适用的个人信息；我们可能需要先验证请求人的身份。</p>
            <p>请注意，电子邮件和互联网传输并非绝对安全。不要在联系、反馈或房源描述中提交不必要的敏感信息。</p>
          </section>

          <section id="fair-housing" className="legal-section">
            <h2>公平住房与房源标准 <span>Fair housing</span></h2>
            <p>安居支持公平、平等的住房机会。房源或沟通不得基于受法律保护的特征拒绝、限制、骚扰或区别对待他人。平台会参考适用的联邦、纽约州和地方公平住房规则处理相关内容。</p>
            <p>你可以先阅读<a href="https://www.hud.gov/helping-americans/fair-housing-act-overview" target="_blank" rel="noreferrer">美国住房与城市发展部公平住房说明</a>和<a href="https://ag.ny.gov/publications/fair-housing" target="_blank" rel="noreferrer">纽约州总检察长公平住房资源</a>。如果发现疑似歧视、诈骗或误导性房源，请使用房源页的举报入口，或通过<a href="/contact">联系我们</a>提供线索。</p>
          </section>

          <section id="safety" className="legal-section">
            <h2>安全与平台边界 <span>Safety</span></h2>
            <ul>
              <li>看房前核实发布者身份、房源是否真实、费用明细和租约条款。</li>
              <li>不要在未独立核实前通过电汇、礼品卡、加密货币或现金支付押金和租金。</li>
              <li>不要把密码、社会安全号码、银行登录信息或身份证件发送给陌生人。</li>
              <li>发现威胁、骚扰、冒充、疑似诈骗或危险情况时，优先联系当地紧急服务或执法机构，再向安居报告。</li>
            </ul>
            <p>安居提供信息展示、结构化沟通和基础举报工具，不是物业管理公司、经纪代理、背景核验机构、法律顾问或付款托管方。</p>
          </section>

          <section id="accessibility" className="legal-section">
            <h2>无障碍与联系 <span>Accessibility</span></h2>
            <p>我们会持续改善键盘操作、移动端布局、文字对比度和表单错误提示。如果你在使用安居时遇到无障碍障碍，或需要其他格式的信息，请通过<a href="/contact">联系我们</a>告诉我们。</p>
            <p className="legal-footnote">这份页面是安居试运行阶段的产品说明草案，不构成法律意见或完整的隐私政策、服务条款或租赁协议。正式上线前应根据运营地点、数据流程和适用法律进行专业审核。</p>
          </section>
        </div>
      </div>
    </PublicPageShell>
  );
}

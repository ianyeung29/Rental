import type { Metadata } from "next";
import Link from "next/link";
import AccountDeletionRequestForm from "../components/AccountDeletionRequestForm";
import PublicPageShell from "../components/PublicPageShell";

export const metadata: Metadata = {
  title: "删除账户 · 安居",
  description: "通过注册邮箱请求删除安居账户及相关账户资料。",
};

export default function DeleteAccountPage() {
  return (
    <PublicPageShell title="删除安居账户" description="通过注册邮箱确认后，永久删除账户及其相关资料。">
      <section className="account-deletion-page public-section public-section-first">
        <div className="account-deletion-copy">
          <h2>开始删除请求</h2>
          <p>为保护账户安全，我们会先把一封确认邮件发送到你的登录邮箱。打开邮件并确认后，删除才会执行。</p>
          <ul>
            <li>会删除账户资料、公开房源及其图片、私密房源资料、草稿记录、收藏、保存搜索、申请、通知订阅和登录会话。</li>
            <li>删除你发布的房源会同时移除对应的公开页面；已被其他人保存或分享的截图、链接缓存和独立保存的副本不受我们控制。</li>
            <li>少量信息可能因安全、防欺诈、争议或法律义务在适用期限内保留；详情见<a href="/legal#data">隐私说明中的数据删除规则</a>。</li>
          </ul>
        </div>
        <AccountDeletionRequestForm />
      </section>
      <section className="public-callout-section public-section">
        <div>
          <h2>还不想删除？</h2>
          <p>你可以先登录后修改个人资料、关闭通知、删除保存搜索，或暂停自己的房源。</p>
        </div>
        <Link className="outline-button" href="/">返回找房 / Back to Anjurentals</Link>
      </section>
    </PublicPageShell>
  );
}

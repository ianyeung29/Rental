import type { Metadata } from "next";
import Link from "next/link";
import AccountDeletionConfirmForm from "../../components/AccountDeletionConfirmForm";
import PublicPageShell from "../../components/PublicPageShell";

export const metadata: Metadata = {
  title: "确认删除账户 · 安居",
  description: "确认永久删除安居账户及相关账户资料。",
};

export default async function DeleteAccountConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <PublicPageShell title="确认删除账户" description="此操作不可撤销。请仅在确认要永久删除账户时继续。">
      <section className="account-deletion-page public-section public-section-first">
        <div className="account-deletion-copy">
          <h2>最后确认</h2>
          <p>确认后会立即退出所有已登录设备，并删除属于此账户的资料和发布内容。</p>
          <p>如果这不是你本人发起的请求，请关闭此页面；账户不会被删除。</p>
        </div>
        {token ? <AccountDeletionConfirmForm token={token} /> : <div className="account-deletion-result"><strong>链接无效 / Invalid link</strong><p>此确认链接缺少必要信息。请回到删除账户页面重新请求邮件。</p><Link className="outline-button" href="/delete-account">重新请求 / Request a new link</Link></div>}
      </section>
    </PublicPageShell>
  );
}

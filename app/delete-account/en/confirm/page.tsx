import type { Metadata } from "next";
import Link from "next/link";
import AccountDeletionConfirmForm from "../../../components/AccountDeletionConfirmForm";
import PublicPageShell from "../../../components/PublicPageShell";

export const metadata: Metadata = {
  title: "Confirm Account Deletion | Anjurentals",
  description: "Confirm permanent deletion of your Anjurentals account and associated data.",
};

export default async function EnglishDeleteAccountConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <PublicPageShell
      locale="en"
      languageHref="/delete-account/confirm"
      title="Confirm account deletion"
      description="This action cannot be undone. Continue only if you want to permanently delete your account."
    >
      <section className="account-deletion-page public-section public-section-first">
        <div className="account-deletion-copy">
          <h2>Final confirmation</h2>
          <p>Confirming this request signs you out of every device and deletes the account information and published content that belong to this account.</p>
          <p>If you did not request this, close this page. Your account will not be deleted.</p>
        </div>
        {token ? <AccountDeletionConfirmForm token={token} locale="en" /> : <div className="account-deletion-result"><strong>Invalid link</strong><p>This confirmation link is missing required information. Return to the account-deletion page to request a new email.</p><Link className="outline-button" href="/delete-account/en">Request a new link</Link></div>}
      </section>
    </PublicPageShell>
  );
}

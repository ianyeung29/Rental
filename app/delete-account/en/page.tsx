import type { Metadata } from "next";
import Link from "next/link";
import AccountDeletionRequestForm from "../../components/AccountDeletionRequestForm";
import PublicPageShell from "../../components/PublicPageShell";

export const metadata: Metadata = {
  title: "Delete Account | Anjurentals",
  description: "Request deletion of your Anjurentals account and associated account data using your sign-in email address.",
};

export default function EnglishDeleteAccountPage() {
  return (
    <PublicPageShell
      locale="en"
      languageHref="/delete-account"
      title="Delete your Anjurentals account"
      description="Use your sign-in email address to request permanent deletion of your account and associated data."
    >
      <section className="account-deletion-page public-section public-section-first">
        <div className="account-deletion-copy">
          <h2>Start a deletion request</h2>
          <p>To protect your account, we first send a confirmation email to the address used to sign in. Deletion happens only after you open that email and confirm the request.</p>
          <ul>
            <li>We delete your account profile, public listings and their images, private listing records, drafts, saved items, saved searches, applications, notification subscriptions, and sign-in sessions.</li>
            <li>Deleting a listing removes its public page. Screenshots, shared links, cached pages, and copies saved independently by others are outside our control.</li>
            <li>Limited information may be retained for security, fraud prevention, disputes, legal obligations, or backups. See the <Link href="/legal/en#data">account-deletion and retention section of our privacy policy</Link> for details.</li>
          </ul>
        </div>
        <AccountDeletionRequestForm locale="en" />
      </section>
      <section className="public-callout-section public-section">
        <div>
          <h2>Not ready to delete?</h2>
          <p>You can sign in to update your profile, turn off notifications, remove saved searches, or pause your own listings first.</p>
        </div>
        <Link className="outline-button" href="/">Back to Anjurentals</Link>
      </section>
    </PublicPageShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "../../components/PublicPageShell";

const LAST_UPDATED = "2026-08-25";

export const metadata: Metadata = {
  title: "Legal and Platform Policies | Anjurentals",
  description: "Anjurentals terms of use, privacy policy, safety practices, account deletion, and fair-housing rules.",
};

export default function EnglishLegalPage() {
  return (
    <PublicPageShell
      locale="en"
      languageHref="/legal"
      title="Clear platform rules make it easier to use Anjurentals with confidence."
      description="This page explains Anjurentals’ terms of use, privacy policy, safety practices, fair-housing standards, and account controls. We update it as the service and applicable law change."
    >
      <div className="legal-notice">
        <strong>Service notice</strong>
        <p>
          Anjurentals is a rental-information and communication platform for New York’s Chinese community. We are not a landlord, broker, tenant, property manager, background-check provider, legal adviser, or party to a lease. This policy explains our product practices and is not legal advice.
        </p>
        <p>Last updated: <time dateTime={LAST_UPDATED}>August 25, 2026</time></p>
      </div>

      <div className="legal-layout">
        <aside className="legal-index" aria-label="Legal page contents">
          <span className="section-label">ON THIS PAGE</span>
          <a href="#terms">Terms of use</a>
          <a href="#privacy">Privacy policy</a>
          <a href="#data">Your data and account</a>
          <Link href="/delete-account/en">Delete account</Link>
          <a href="#security">Safety and security</a>
          <a href="#fair-housing">Fair housing</a>
          <a href="#accessibility">Accessibility and contact</a>
        </aside>

        <div className="legal-content">
          <section id="terms" className="legal-section">
            <h2>Terms of use</h2>
            <p>
              By using Anjurentals, you agree to provide accurate, lawful, and non-misleading information and to treat other users with respect. Landlords, agents, and other publishers are responsible for their listings, pricing, availability, contact information, and communications. Renters are responsible for their inquiries, applications, and profile information.
            </p>
            <ul>
              <li>Do not publish false, duplicate, expired, impersonated, unauthorized, or misleading listings.</li>
              <li>Do not publish discriminatory conditions, harassment, threats, scams, malicious links, malware, or unlawful content.</li>
              <li>Do not use the platform to obtain passwords, Social Security numbers, bank information, government identification, or other unnecessary sensitive information from others.</li>
              <li>Do not bypass access controls, probe or attack the service, abuse automated requests, or attempt to access listings, messages, applications, or account data that are not yours.</li>
              <li>We may hide, limit, or remove content and suspend features or accounts for safety, accuracy, privacy, legal, or policy reasons.</li>
            </ul>
            <p>
              Anjurentals does not guarantee that a listing is genuine, available, suitable for you, or will lead to a lease. Viewing, identity verification, background checks, payments, deposits, leases, and signing decisions must be independently verified by the relevant parties.
            </p>
          </section>

          <section id="privacy" className="legal-section">
            <h2>Privacy policy</h2>
            <p>
              This section explains how Anjurentals handles personal information. You can browse public listings without providing unnecessary personal information. If you register, publish a listing, contact a publisher, apply, enable notifications, or use AI or map features, the relevant workflow processes the information described below.
            </p>

            <h3>Information we may collect</h3>
            <ul>
              <li><strong>Account and sign-in information:</strong> email address, display name, optional phone number, account type (user or agent), email-verification status, and an identifier supplied through optional Google sign-in. We do not receive your Google password.</li>
              <li><strong>Listing and media information:</strong> titles, neighborhood or borough, rent, bedrooms, bathrooms, square footage, move-in date, lease term, feature tags, descriptions, photos, and agent portraits. A publisher’s exact address, contact name and email, viewing preferences, agent-assistance request, and fee details are private listing information.</li>
              <li><strong>Inquiries, tours, and applications:</strong> name, email, phone, message, intended move-in date, lease length, household size, pets, viewing preference, and optional application details such as current city, employment status, and income range. Application data is shared through the relevant workflow with the publisher or agent; it is not publicly displayed.</li>
              <li><strong>Agent verification:</strong> license state and number, brokerage, service areas, languages, portrait, and review status. The current process does not ask for identity documents, credit reports, or background-check files. Do not upload those files as a portrait or listing image.</li>
              <li><strong>Device and usage records:</strong> necessary session cookies; anonymous local browser draft and filter state; listing-view, save, contact, and share events; and records used for abuse prevention, troubleshooting, and security auditing. Where configured, IP addresses are encrypted and also irreversibly hashed. We may also record country or region, browser, operating system, device type, requested path, and the email address of a signed-in user.</li>
              <li><strong>Browser notifications:</strong> if you opt in to push notifications, we store the browser subscription endpoint, push keys, and user agent so notifications can be sent. You can turn these off in account settings or browser permissions.</li>
            </ul>

            <h3>How we use information</h3>
            <ul>
              <li>To create and protect accounts, send verification and password-reset messages, deliver inquiry or application updates, and provide necessary service notifications.</li>
              <li>To save, display, and manage listings; handle saves, saved searches, comparisons, inquiries, tours, applications, agent verification, and address-reveal workflows.</li>
              <li>To provide AI listing polish, comparison summaries, and inquiry assistance only when you choose to use those features.</li>
              <li>To provide selected nearby-place and route estimates, and to rate-limit, prevent fraud, debug, audit, monitor errors, and improve the service.</li>
              <li>To handle feedback, support, reports, legal requests, and platform-safety events.</li>
            </ul>

            <h3>Exact addresses, maps, and AI</h3>
            <p>
              Public listing pages show only an approximate area. When a publisher asks for nearby information or route estimates, the exact address is sent from our server to Google Maps Platform for geocoding, place, or routing requests. The exact address is not shown on a public listing page, included in public AI-written copy, or sent to OpenAI as part of an AI request. Destinations and places that you enter yourself may still be sent to Google, so do not enter unnecessary private information in a destination field. Google processes request data under its own terms and privacy policy.
            </p>
            <p>
              When you use AI polish or summaries, a listing title, public area, rental facts, features, description, and area context that excludes the exact address may be sent to OpenAI. Do not paste an exact address, phone number, email, identification document, financial information, or other private information into free-text listing fields. We cannot reliably remove information that you choose to include in public copy.
            </p>

            <h3>Service providers and recipients</h3>
            <p>
              To provide the service, information may be processed by Neon (structured database), Cloudflare R2 (listing images and agent-portrait storage), Vercel and related hosting or edge infrastructure, Resend (verification, password reset, support, and notification email), Google OAuth (optional sign-in), Google Maps Platform (maps, places, and routes), and OpenAI (only when you use AI features). Browser push notifications also pass through your browser and its push provider. We share information only as needed to provide the relevant feature. We do not sell personal information or use it for cross-site behavioral advertising.
            </p>
            <p>
              Published listing photos and agent portraits use public media URLs, so anyone with a URL may be able to access the image. Do not upload passwords, identification documents, credit reports, bank records, or other sensitive files. Structured private information is returned only through account flows that check identity and permission.
            </p>

            <h3>Retention</h3>
            <ul>
              <li>Sign-in sessions last up to about 30 days; email-verification links are valid for about 24 hours; password-reset links are valid for about one hour.</li>
              <li>Nearby-place information is generally cached for about seven days. Exact addresses are not stored as plaintext in that cache; cache keys use a one-way hash.</li>
              <li>Security-audit activity is currently retained for about 30 days and cleaned by scheduled tasks. Error, usage, and operational records may be kept longer when needed for troubleshooting, safety, or billing.</li>
              <li>Account, listing, application, message, media, and agent information is retained while needed to provide the service, resolve disputes, and meet legal obligations. After an approved deletion request, copies in backups or provider systems may require additional time to expire or be removed.</li>
            </ul>

            <h3>Public content, cross-border processing, and children</h3>
            <p>
              Listing titles, public area, rental facts, features, descriptions, and published photos that you choose to publish may be publicly visible. Exact addresses and contact details are not public listing fields. Providers may process data in the United States or other countries where they operate. Anjurentals is intended for adult rental use and is not directed to children under 13. If you believe a child provided personal information, please <a href="/contact">contact us</a>.
            </p>
          </section>

          <section id="data" className="legal-section">
            <h2>Your data and account controls</h2>
            <h3>Delete your account</h3>
            <p>
              You can visit the <Link href="/delete-account/en">account-deletion page</Link> at any time, enter the email address used for your account, and finish through the confirmation email. Once confirmed, we delete your account profile, public listings and their images, private listing records, drafts, saved items, saved searches, applications, notification subscriptions, and sign-in sessions. Published listings are removed from public pages. Only a confirmation link sent to the account’s sign-in email can complete deletion.
            </p>
            <p>
              You can also update editable profile information, turn off notifications, remove saved searches, or withdraw unfinished drafts through account features. You may <a href="/contact">contact us</a> to request access to or correction of applicable personal information, or to ask how information is used. Please contact us from the email used for your account and do not send passwords, API keys, Social Security numbers, or complete identity documents by email.
            </p>
            <p>
              Some information may need to be retained for security auditing, fraud investigation, disputes, legal obligations, or necessary backups. Security-audit records are generally cleared within about 30 days; provider backups, browser caches, or independently saved third-party copies may take longer to expire or be removed. Your rights and response timelines depend on your location and the nature of the request. We handle requests under applicable law.
            </p>
          </section>

          <section id="security" className="legal-section">
            <span id="safety" aria-hidden="true" />
            <h2>Safety and security</h2>
            <p>
              We use technical and organizational measures appropriate to the current service, including production HTTPS; HttpOnly, SameSite, Secure session cookies; scrypt password hashing; token hashing; email verification; server-side authorization checks; rate limits; audit and error monitoring; pre-signed image uploads; file-type and size checks; and encryption of audit IP addresses when the deployment encryption key is configured. Exact-address disclosure follows the relevant user and permission workflow and leaves an audit record without address contents.
            </p>
            <p>
              No internet transmission, storage system, or account can be guaranteed completely secure. Use a strong, unique password and do not reuse passwords from other services. Do not submit passwords, API keys, Social Security numbers, bank information, or identity documents in listings, feedback, support messages, or screenshots. Enable multi-factor authentication for Cloudflare, Neon, Vercel, Resend, Google, OpenAI, and other provider accounts, and grant only the access needed for the work.
            </p>
            <h3>Offline rental safety</h3>
            <ul>
              <li>Before a viewing, independently verify the publisher’s identity, the listing, fee details, address, and lease terms.</li>
              <li>Do not send a deposit or rent by wire, gift card, cryptocurrency, or cash before independent verification.</li>
              <li>Do not send passwords, Social Security numbers, bank sign-in information, or identity documents to strangers.</li>
              <li>For threats, harassment, impersonation, suspected fraud, or an emergency, contact local emergency services or law enforcement first, then report the issue to Anjurentals.</li>
            </ul>
            <h3>Report a security issue</h3>
            <p>
              If you find unauthorized account access, a privacy exposure, malicious listing, suspicious link, or another security concern, use <a href="/contact">Contact us</a> and select the safety or privacy topic. Include the affected page, steps to reproduce, time, and non-sensitive evidence. Do not include passwords, tokens, API keys, complete identity documents, or another person’s exact address, and do not damage data, harass users, or expand access while testing an issue. We investigate according to risk and notify affected people or regulators when required by law.
            </p>
            <p>
              New York’s business data-security rules call for reasonable administrative, technical, and physical safeguards. You can review the <a href="https://ag.ny.gov/resources/organizations/data-breach-reporting/shield-act" target="_blank" rel="noreferrer">New York Attorney General’s SHIELD Act resources</a> and the <a href="https://www.ftc.gov/business-guidance/resources/start-security-guide-business" target="_blank" rel="noreferrer">FTC Start with Security guide</a> for general principles. We continue to improve safeguards based on our scale, provider configuration, and applicable law.
            </p>
          </section>

          <section id="fair-housing" className="legal-section">
            <h2>Fair housing and listing standards</h2>
            <p>
              Anjurentals supports fair and equal housing opportunity. Listings and communications may not deny, limit, harass, or treat people differently because of characteristics protected by law. AI-generated writing cannot be used to avoid fair-housing rules; publishers must review and are responsible for final content. We apply relevant federal, New York State, and local fair-housing standards when reviewing content.
            </p>
            <p>
              You can review the <a href="https://www.hud.gov/helping-americans/fair-housing-act-overview" target="_blank" rel="noreferrer">U.S. Department of Housing and Urban Development’s Fair Housing Act overview</a> and the <a href="https://ag.ny.gov/publications/fair-housing" target="_blank" rel="noreferrer">New York Attorney General’s fair-housing resources</a>. To report suspected discrimination, fraud, or a misleading listing, use the report action on the listing page or <a href="/contact">contact us</a>.
            </p>
          </section>

          <section id="accessibility" className="legal-section">
            <h2>Accessibility, contact, and changes</h2>
            <p>
              We continue to improve keyboard access, mobile layouts, text contrast, and form-error feedback. If you experience an accessibility barrier, need information in another format, or have a question about changes to this page, please <a href="/contact">contact us</a>.
            </p>
            <p>
              We may update this page as features, providers, law, or data practices change. The date at the top will change when we do. Continued use means you have access to the latest version, and we will try to provide meaningful-change notices through an appropriate product or account channel.
            </p>
            <p className="legal-footnote">
              This page is not legal advice, a data-processing agreement, or a rental agreement. We will continue to update it for our operating entity, user locations, data-retention practices, provider contracts, and applicable law, and recommend professional legal review before full commercial operation.
            </p>
          </section>
        </div>
      </div>
    </PublicPageShell>
  );
}

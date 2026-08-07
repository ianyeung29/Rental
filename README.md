# 安居 · Anjurentals rental marketplace pilot

This is a browser-first MVP slice of the Chinese-first North American rental marketplace described in `../PRODUCT.md` and `../RENTAL_MARKETPLACE_PROPOSAL.md`.

## Current slice

- Simplified Chinese-first interface for the current pilot; English copy remains as an internal fallback while the product targets Chinese users.
- Conventional list results with location, rent, rental type, move-in, and additional filters.
- Shareable search URLs preserve location, rent, type, move-in month, feature filters, and sort order across refreshes.
- Synthetic listings clearly labeled as demo inventory.
- Separate location, identity, and availability signals.
- Approximate-area privacy language with no exact address in public content.
- Save listings, searches, and posting drafts with browser persistence plus Neon sync for verified signed-in users.
- Anonymous or unverified users keep a browser-local fallback; verified accounts can carry saved listings, searches, drafts, and inquiries across devices.
- Compare up to two listings in a side-by-side view with bedrooms, bathrooms, feature tags, and a balanced AI conclusion; a labeled local comparison remains available when AI is not configured.
- Listing detail drawer, structured inquiry flow, and a Messages view that combines local preview records with Neon-backed inquiries.
- Phase 2 renter assistance includes a grounded bilingual inquiry-writing helper and a cached commute estimator for drive, public-transit, and walking routes from the public approximate area.
- Five-step poster workflow with autosaved and explicitly savable drafts, private exact-address input, rental terms, photo compression, cover-photo ordering, preview, validation, and cloud publish.
- Chinese-only posting fields for the current pilot, USD rental currency, immediate move-in by default with optional date selection, and expanded feature choices including laundry, air conditioning, dishwasher, balcony, elevator, gym, doorman, and storage.
- AI-assisted bilingual listing polish in Step 3. The server route sends only public listing facts plus non-address location context to OpenAI; the private exact address is used server-side for Google route estimates only and never leaves the server or appears in public output. A labeled local formatter is used when no OpenAI key is configured.
- Cloud-published listings are stored in Neon, listing images are uploaded to Cloudflare R2, and published listings reappear in search results for other browser sessions.
- Email/password accounts use server-side sessions. Listing writes, R2 upload presigning, owner dashboards, and received inquiries are authorization-protected by account ownership.
- Owners can review and edit their own listings, view private address details, reorder or remove photos, pause or republish listings, set an optional public expiration date, renew expired listings for 30 days, and reply to received inquiries by email.
- Listing lifecycle is enforced server-side: paused and expired listings are removed from public search and cannot receive new inquiries or reports; existing legacy `unpublished` rows are treated as paused.
- Signed-in renters can report remote listings; admin-role API routes expose a small moderation queue with report status updates.
- Listing inquiries remain in the renter and owner dashboards and can send Resend notifications and confirmation emails when email delivery is configured.
- Owners can explicitly share the exact address from a scheduled inquiry; renters see it only in their authenticated Messages view, and the reveal is recorded without copying the address into the audit log.
- Responsive desktop/mobile composition with reduced-motion and keyboard-focus handling.
- Installable PWA shell with an offline fallback, an explicit update prompt, local draft recovery, and an iPhone Safari install guide.
- Verified users can opt into browser push notifications for new inquiries, saved-search matches, listing expiry reminders, applications, and tour reminders.

## Current pilot boundary

Browser storage remains the anonymous/unverified fallback. Verified signed-in saved listings, saved searches, posting drafts, accounts, published listings, private address details, media metadata, sessions, and inquiries use Neon; image objects use Cloudflare R2. Owner replies still use `mailto:`, while Resend handles inquiry notification, confirmation, and password-reset email when configured.

See [STAGING.md](STAGING.md) for the deployment checklist and smoke tests.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3010`.

To load the repeatable synthetic database inventory into the configured Neon project:

```bash
npm run db:seed
```

The seed creates four clearly labeled sample listings, their private demo details, and local demo-image metadata. It is safe to run again; it does not create user accounts or real rental inventory.

The database bootstrap applies the listing lifecycle, Phase 1 security/usage tables, PWA notification tables, address-reveal tables, and audit-log tables automatically. If you run migrations manually, apply `db/migrations/005_listing_lifecycle.sql`, `db/migrations/017_phase_one_security_usage.sql`, `db/migrations/018_pwa_retention.sql`, `db/migrations/019_address_reveal.sql`, and `db/migrations/020_audit_logs.sql` after the earlier migration files.

To load synthetic agent profiles for testing the owner’s agent-selection flow:

```bash
npm run db:seed:agents
```

These profiles are explicitly marked as sample profiles and are not verified professionals. Replace them with reviewed agent records before production use.

## Enable AI listing tools

Copy `.env.example` to `.env.local` and add your server-side API key:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
```

The default model is the cost-sensitive GPT-5.6 Luna with low reasoning effort, which is appropriate for fast listing copy polish and two-listing comparison conclusions. Never expose the key in client-side code or commit `.env.local`. Without a key, the posting wizard and Compare Desk still offer clearly labeled local previews; the AI comparison route also requires a signed-in, verified account.

### Optional area context for AI copy

To let the posting wizard add verified, approximate-area references for nearby places and walking time to transportation stations, add a server-only Google Maps Platform key:

```bash
GOOGLE_MAPS_SERVER_API_KEY=your_restricted_server_key
```

Enable Places API (New) and Routes API for that key, restrict it to those APIs, and keep it out of `NEXT_PUBLIC_*` variables. During authenticated listing polish, the server may send the private address to Google only to geocode the route origin and calculate nearby travel times; the address is not sent to OpenAI, persisted in the location-context payload, or shown publicly. If Google cannot locate it, the calculation falls back to the selected approximate area. The poster should review every generated reference before publishing. See Google’s [Places Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search) and [Routes API](https://developers.google.com/maps/documentation/routes) documentation.

The posting wizard lets the poster choose up to three nearby lookup categories. Clearing all categories skips Google Maps for that polish. Successful results are stored in the Neon `rental_location_context_cache` table for seven days; exact-address lookups use a one-way address hash in the cache key and never store the raw address.

## Saved-search email alerts and browser push

Saved searches can be switched to `Every day` from the saved desk. Vercel calls `/api/alerts/digest` once per day using the `CRON_SECRET`; the job matches newly published listings against the saved location, rent, bedroom, bathroom, square-footage, rental-type, move-in, and feature filters. It sends through Resend only when the account and category email preferences allow it, and also creates an in-app notification.

Browser push is optional. Generate one VAPID key pair and add the public key and private key to the local `.env.local` and the Vercel project environment:

```bash
npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:hello@anjurentals.com
```

The public key may be exposed to the browser; the private key must remain server-only. A verified user can enable the device from the notification drawer. Each browser device gets its own subscription, expired subscriptions are cleaned up automatically, and no push message is sent until the user grants permission.

## Enable Resend email verification

Add these server-side values to `.env.local`:

```bash
RESEND_API_KEY=re_your_sending_only_key
RESEND_FROM_EMAIL="Anjurentals <noreply@your-verified-domain.com>"
SITE_CONTACT_EMAIL=your-inbox@example.com
# Optional overrides when contact and feedback use different inboxes
CONTACT_RECIPIENT_EMAIL=your-inbox@example.com
FEEDBACK_RECIPIENT_EMAIL=your-inbox@example.com
APP_URL=http://localhost:3010
```

Registration creates a 24-hour verification token and sends it through Resend. Users can resend the message from the account drawer. Publishing listings, uploading images, polishing copy, sending inquiries, and reporting listings require a verified email. Use a Resend `sending_access` key and verify the sending domain before sending to users; see Resend’s [Next.js guide](https://resend.com/docs/send-with-nextjs), [send API](https://resend.com/docs/api-reference/emails/send-email), and [API-key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).

The public `/contact` and `/feedback` forms also send through Resend. Keep the recipient addresses server-side; the browser can only choose a validated topic and message. `SITE_CONTACT_EMAIL` is the shared fallback, while `CONTACT_RECIPIENT_EMAIL` and `FEEDBACK_RECIPIENT_EMAIL` can route the two forms separately. The sender must be a verified Resend domain, and the user’s valid email is added as `replyTo` so you can answer directly.

### Audit-log encryption and retention

Add a long random server-only value to `.env.local` and the Vercel production environment:

```bash
AUDIT_LOG_ENCRYPTION_KEY=your_long_random_value
```

The key encrypts retained audit-log IP addresses. If it is not configured, the application keeps a one-way IP hash for matching and shows `Encrypted / hash-only` to administrators instead of retaining a decryptable IP. Audit records are retained for 30 days and the scheduled `/api/alerts/audit-retention` job purges older rows.

Password reset is available at `/reset-password`. Reset requests use generic responses to avoid exposing whether an email is registered; the link expires after one hour, and changing a password revokes existing sessions. Login, password-reset, listing-polish, and comparison limits are stored in Neon rather than an in-memory server process.

## Enable Google login

Create a Google OAuth 2.0 Web application client in Google Cloud Console, then add these server-side values to `.env.local`:

```bash
GOOGLE_CLIENT_ID=your_google_web_client_id
GOOGLE_CLIENT_SECRET=your_google_web_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3010/api/auth/google/callback
```

Add the callback above as an exact authorized redirect URI in the Google client. For production, replace it with the public HTTPS callback URL and set `APP_URL` to the production site URL. Google sign-in uses the `openid`, `email`, and `profile` scopes, links a verified Google email to an existing account when appropriate, and creates a Neon-backed session. See Google’s [OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect), [OIDC reference](https://developers.google.com/identity/openid-connect/reference), and [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server). Never commit the client secret or paste it into chat.

## Configure Neon and Cloudflare R2

Add the following server-only values to `.env.local`:

```bash
DATABASE_URL=your_neon_connection_string
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_BUCKET=your_bucket_name
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_PUBLIC_URL=https://your-public-bucket-url
```

The R2 token should be limited to Object Read & Write for the selected bucket. Configure the bucket CORS policy to allow the local app origin and production app origin to use `PUT` for presigned browser uploads. Keep the R2 bucket public URL separate from the S3 API endpoint.

## Enable WeChat JS-SDK sharing

The website can customize the title, thumbnail, and link used by WeChat's built-in share menu when a listing is opened inside WeChat. It cannot open Moments or publish on the user's behalf, so the poster and copied-caption fallback remains available in Chrome, Safari, and when JS-SDK setup is unavailable.

Create or use a WeChat Official Account and add these server-only values to `.env.local` and the Vercel production environment:

```bash
WECHAT_OFFICIAL_ACCOUNT_APP_ID=your_official_account_app_id
WECHAT_OFFICIAL_ACCOUNT_APP_SECRET=your_official_account_app_secret
APP_URL=https://your-production-domain.com
```

In the Official Account admin console, add the exact production hostname under the JS interface safe domain (`JS接口安全域名`). The site calls `/api/wechat/signature` to obtain a server-generated signature; the AppSecret never reaches the browser. Test by opening the listing URL in WeChat itself, not Chrome or Safari, then use the top-right `...` menu and choose `分享到朋友圈`.

## Review agent identity

Agent registration and verification are separate steps. A user chooses `Agent` during registration, verifies the account email, then opens the account avatar and submits the license state, license number, and brokerage under `AGENT IDENTITY`. The application is not approved automatically.

To grant an operations account access to the review desk, set its role once in Neon using the account email:

```sql
UPDATE rental_users
SET role = 'admin', updated_at = NOW()
WHERE email = 'admin@example.com';
```

After signing in with that verified admin account, open the account avatar and choose `Admin workspace`, or go directly to `/admin/agent-verifications`. The desk reads the protected `/api/admin/agent-verifications` queue and provides `Approve verification` and `Return for updates` actions. Approval enables the verified-agent listing capacity; returning an application stores the note and leaves it in the queue for follow-up. Check the submitted license against the relevant state’s public records before approving.

## Phase 1 operations

- Verified accounts can request a password reset from the sign-in drawer; Resend must be configured for the email to arrive.
- Admins can open `/admin/usage` from the account menu to review aggregate OpenAI/Google Maps calls, token counts, cache hits, gross cost estimates, daily activity, and active rate-limit windows.
- Admins can open `/admin/activity` from the account menu to review authenticated and anonymous security signals, including event, timestamp, country, browser, device, route, and a private email snapshot for signed-in accounts. The desk is admin-only and retains records for 30 days.
- Google Maps estimates are intentionally gross list-price estimates and do not subtract monthly free caps. The usage desk never displays API keys, full emails, private addresses, or prompt contents.
- Audit events never store passwords, session tokens, API keys, exact addresses, phone numbers, freeform messages, or AI prompts/content. IP addresses are encrypted with `AUDIT_LOG_ENCRYPTION_KEY`; only verified administrators can read the activity desk.
- Keep `db/migrations/017_phase_one_security_usage.sql` and `db/migrations/020_audit_logs.sql` in the deployment migration set if migrations are applied manually; the current bootstrap also creates these tables automatically.

## Phase 2 core

- The inquiry assistant uses only public listing facts and the renter’s structured answers. It can produce Chinese and English drafts, but the renter remains responsible for reviewing the message before sending it.
- The detail drawer can estimate a route to a school, workplace, landmark, commercial district, or supermarket from the public approximate area. Listing polish can use the private address server-side for more accurate nearby references without exposing it to AI or the public listing; both flows support drive/public transit/walking and cache non-address results for seven days.
- A listing owner can schedule a tour and then explicitly share the private exact address with that inquiry's renter. The renter sees it only after authenticated account loading; the reveal action is permission-checked and audit-recorded without storing an address copy in the event table.
- Commute requests do not persist a destination that looks like a private street address. Do not enter a private address into the destination field.
- The existing Phase 2 foundations for manual agent verification, listing quality checks, price comparisons, owner performance metrics, and labeled promotion requests remain in place. Automated identity/property vendors, OCR/redaction services, and paid promotion checkout are intentionally vendor/legal decisions still to be completed before production use.

## Phase 3 foundation

- Verified renters can maintain a private, reusable application profile from the account desk or directly inside the application drawer. Future applications can reuse contact details, move-in timing, lease preference, household size, pets, employment preference, income-range preference, and an optional general note.
- The profile is stored in Neon and is sent to a listing owner or agent only when the renter submits an application for that specific listing. The product does not yet store identity documents, credit reports, screening results, leases, deposits, or payment details.
- Reusable applications are the first Phase 3 slice. Document vault, compliant third-party screening, jurisdiction-specific leases/e-signature, rent payments, disputes, and property-management feeds remain gated on vendor selection, legal review, and secure private-media design.

## Production checklist

- Configure R2 CORS for the exact production origin and verify the public bucket policy; do not expose the S3 credentials to the browser.
- Set `SITE_CONTACT_EMAIL` (or both recipient overrides) in Vercel so `/contact` and `/feedback` can deliver through Resend.
- Confirm password reset, persistent login throttling, and session revocation against the production Neon project before opening registration publicly.
- Keep the admin activity desk, 30-day audit retention job, rate limits, and documented response procedures monitored before accepting public supply.
- Replace sample inventory with reviewed seed listings for the selected pilot metro.
- Add geocoding, verification, transactional email, and notifications after vendor decisions.
- Add automated authorization, cross-account ownership, exact-address non-disclosure, and upload-orphan cleanup tests.
- Set a review/alert process for the admin usage desk before public launch; AI polish is already behind authentication, per-user usage limits, and recorded operational metrics.

## Useful checks

```bash
npm run lint
npm run build
```

The authenticated API surface is organized as `/api/auth/*`, `/api/my/listings`, `/api/inquiries`, `/api/listings`, and `/api/media/presign`. The browser client never receives `DATABASE_URL`, R2 access keys, or the private listing table directly.

Public information pages are available at `/about`, `/contact`, `/feedback`, `/legal`, and `/sitemap`; Next.js also generates `/sitemap.xml` and `/robots.txt` from the public route list.

The brand, pilot geography, supply policy, and external vendors remain open decisions from the proposal.

# 租住 · Rental marketplace pilot

This is a browser-first MVP slice of the Chinese-first North American rental marketplace described in `../PRODUCT.md` and `../RENTAL_MARKETPLACE_PROPOSAL.md`.

## Current slice

- Simplified Chinese-first interface for the current pilot; English copy remains as an internal fallback while the product targets Chinese users.
- Conventional list results with location, rent, rental type, move-in, and additional filters.
- Shareable search URLs preserve location, rent, type, move-in month, feature filters, and sort order across refreshes.
- Synthetic listings clearly labeled as demo inventory.
- Separate location, identity, and availability signals.
- Approximate-area privacy language with no exact address in public content.
- Save listings and searches with browser persistence.
- Saved searches remain available anonymously in the browser and sync to Neon for verified signed-in users.
- Compare up to two listings in a side-by-side view.
- Listing detail drawer, structured inquiry flow, and a Messages view that combines local preview records with Neon-backed inquiries.
- Five-step poster workflow with autosaved and explicitly savable drafts, private exact-address input, rental terms, photo compression, cover-photo ordering, preview, validation, and cloud publish.
- Chinese-only posting fields for the current pilot, USD rental currency, immediate move-in by default with optional date selection, and expanded feature choices including laundry, air conditioning, dishwasher, balcony, elevator, gym, doorman, and storage.
- AI-assisted bilingual listing polish in Step 3. The server route sends only public listing facts to OpenAI, keeps the exact address out of the request, and falls back to a labeled local formatter when no API key is configured.
- Cloud-published listings are stored in Neon, listing images are uploaded to Cloudflare R2, and published listings reappear in search results for other browser sessions.
- Email/password accounts use server-side sessions. Listing writes, R2 upload presigning, owner dashboards, and received inquiries are authorization-protected by account ownership.
- Owners can review and edit their own listings, view private address details, reorder or remove photos, pause or republish listings, set an optional public expiration date, renew expired listings for 30 days, and reply to received inquiries by email.
- Listing lifecycle is enforced server-side: paused and expired listings are removed from public search and cannot receive new inquiries or reports; existing legacy `unpublished` rows are treated as paused.
- Signed-in renters can report remote listings; admin-role API routes expose a small moderation queue with report status updates.
- Listing inquiries remain in the renter and owner dashboards and can send Resend notifications and confirmation emails when email delivery is configured.
- Responsive desktop/mobile composition with reduced-motion and keyboard-focus handling.

## Current pilot boundary

The posting draft and saved listing hearts remain browser-local for now. Verified signed-in saved searches, accounts, published listings, private address details, media metadata, sessions, and inquiries use Neon; image objects use Cloudflare R2. Owner replies still use `mailto:`, while Resend handles inquiry notification and confirmation email when configured.

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

The database bootstrap applies the listing lifecycle columns automatically. If you run migrations manually, apply `db/migrations/005_listing_lifecycle.sql` after the earlier migration files.

To load synthetic agent profiles for testing the owner’s agent-selection flow:

```bash
npm run db:seed:agents
```

These profiles are explicitly marked as sample profiles and are not verified professionals. Replace them with reviewed agent records before production use.

## Enable AI listing polish

Copy `.env.example` to `.env.local` and add your server-side API key:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
```

The default model is the cost-sensitive GPT-5.6 Luna with low reasoning effort, which is appropriate for fast listing copy polish. Never expose the key in client-side code or commit `.env.local`. Without a key, the posting wizard still offers a clearly labeled local polish preview.

## Enable Resend email verification

Add these server-side values to `.env.local`:

```bash
RESEND_API_KEY=re_your_sending_only_key
RESEND_FROM_EMAIL="Rentals <noreply@your-verified-domain.com>"
APP_URL=http://localhost:3010
```

Registration creates a 24-hour verification token and sends it through Resend. Users can resend the message from the account drawer. Publishing listings, uploading images, polishing copy, sending inquiries, and reporting listings require a verified email. Use a Resend `sending_access` key and verify the sending domain before sending to users; see Resend’s [Next.js guide](https://resend.com/docs/send-with-nextjs), [send API](https://resend.com/docs/api-reference/emails/send-email), and [API-key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).

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

## Production checklist

- Configure R2 CORS for the exact production origin and verify the public bucket policy; do not expose the S3 credentials to the browser.
- Add password reset, login throttling, and session revocation before opening registration publicly.
- Extend the basic moderation queue with admin UI, rate limits, audit logging, and documented response procedures before accepting public supply.
- Replace sample inventory with reviewed seed listings for the selected pilot metro.
- Add geocoding, verification, transactional email, and notifications after vendor decisions.
- Add automated authorization, cross-account ownership, exact-address non-disclosure, and upload-orphan cleanup tests.
- Put the AI polish route behind authentication, per-user usage limits, and operational monitoring before public launch.

## Useful checks

```bash
npm run lint
npm run build
```

The authenticated API surface is organized as `/api/auth/*`, `/api/my/listings`, `/api/inquiries`, `/api/listings`, and `/api/media/presign`. The browser client never receives `DATABASE_URL`, R2 access keys, or the private listing table directly.

The brand, pilot geography, supply policy, and external vendors remain open decisions from the proposal.

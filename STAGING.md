# Staging deployment checklist

The local app is ready to deploy as a Next.js staging environment. Keep staging isolated from production while the inventory is synthetic and the vendor credentials are being verified.

## Recommended staging resources

- A managed Next.js host such as Vercel connected to the GitHub repository.
- A separate Neon branch or database for staging.
- A separate Cloudflare R2 bucket, or a dedicated `staging/` object prefix.
- A verified Resend sender that is safe for test messages.
- A separate Google OAuth Web client with the staging callback URL.

## Environment variables

Set these as server-side environment variables in the staging project. Do not commit `.env.local` or paste secret values into source control.

```text
DATABASE_URL=<Neon staging connection string>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=<staging-bucket>
R2_ACCESS_KEY_ID=<staging-access-key>
R2_SECRET_ACCESS_KEY=<staging-secret-key>
R2_PUBLIC_URL=https://<staging-public-r2-domain>
RESEND_API_KEY=<sending-only-key>
RESEND_FROM_EMAIL=Anjurentals <noreply@verified-domain.example>
SITE_CONTACT_EMAIL=<operations-inbox>
CONTACT_RECIPIENT_EMAIL=<optional-contact-inbox>
FEEDBACK_RECIPIENT_EMAIL=<optional-feedback-inbox>
APP_URL=https://<staging-domain>
GOOGLE_CLIENT_ID=<staging-client-id>
GOOGLE_CLIENT_SECRET=<staging-client-secret>
GOOGLE_REDIRECT_URI=https://<staging-domain>/api/auth/google/callback
OPENAI_API_KEY=<optional-server-side-key>
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
```

## Before the first deploy

1. Create the Neon staging branch and run the SQL files in `db/migrations/` after the base schema has been created.
2. Configure R2 CORS for the exact staging origin and allow browser `PUT` uploads only to the staging bucket/prefix.
3. Add the exact staging Google callback URL to the OAuth client.
4. Set `APP_URL` to the public HTTPS staging URL so verification and inquiry emails point to the right place.
5. Set `SITE_CONTACT_EMAIL` (or the two explicit recipient overrides) so the public contact and feedback forms can deliver through Resend.
6. Run `npm run db:seed` against staging only if synthetic inventory is wanted for QA.

## Smoke test after deploy

- Open the home page and verify the synthetic-label boundary is visible.
- Apply filters, refresh, and confirm the URL preserves the search.
- Open a listing with multiple photos and test thumbnails and next/previous controls.
- Create an account, verify the email, save a search, then reload it.
- Publish a listing, confirm the image appears from R2, and edit/unpublish it.
- Send an inquiry and confirm it appears in both dashboards and in the configured Resend mailbox.
- Verify exact addresses never appear in public listing JSON, page markup, or analytics payloads.

## Production gate

Do not point production at the staging Neon branch or R2 bucket. Before launch, replace sample inventory with reviewed listings, complete versioned migrations for every table, add rate limits and monitoring, and rotate staging credentials.

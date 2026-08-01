# Chinese-First North American Rental Marketplace

Product and implementation proposal — August 1, 2026

## 1. Executive summary

Build a mobile-first, Simplified-Chinese-default rental marketplace for people living in or moving to North America. It should combine the strongest English-marketplace patterns—fast location-and-filter search, rich structured listings, saved alerts, guided posting, centralized leads, verification, and automation—with a distinctive privacy model. Map-based search is intentionally excluded:

> The platform privately verifies the property’s exact address, but public users see only an approximate neighborhood area. A renter contacts the owner or agent in-platform; the poster chooses when to reveal the address, normally while accepting a tour.

The product should not be a translated classifieds board. Its advantage is a complete, structured workflow that reduces uncertainty for renters and repetitive work for posters:

**Discover → compare → contact → qualify → request a tour → reveal address → tour**

For the first release, focus on search, listing creation, messaging, address reveal, tours, trust, and moderation. Delay applications, credit/background screening, leases, deposits, and rent collection until the marketplace has legal review and sufficient usage.

### Recommended MVP business model

- Core browsing, messaging, and standard posting are free.
- Paid, clearly labeled boosts and professional multi-listing tools are prepared in the data model but can launch later.
- Do not charge per lead at the beginning; it encourages low-quality contacts and complicates trust.

### Open decisions before building

1. Pilot geography: one metro is lowest risk; two or three metros improve learning but fragment inventory. Recommended approach: one primary metro plus one invitation-only secondary metro, configured rather than hardcoded.
2. Supply policy: owners and licensed agents are the safest MVP. Tenant sublets/roommate posts can be added once the verification and lawful-content rules are ready.
3. Brand name and domain.
4. Geocoding/approximate-location display, email/SMS, identity/property verification, analytics, and payment vendors.

## 2. Research: what strong English-language products do well

Only English-language, feature-rich products were used as product and design references.

| Product | Strong patterns worth adapting | Product implication |
|---|---|---|
| Zillow Rentals | Persistent location search; high-frequency filters; saved searches and alerts; photo-heavy cards; transparent total-monthly-price cues; one landlord workspace spanning listings, leads, tours, applications, leases, and payments. | Make search and save actions always visible. Give posters one lead pipeline rather than scattered email notifications. Show total recurring cost, not headline rent alone. |
| Apartments.com | AI-assisted discovery; deep amenities; nearby transit, schools, points of interest, and walkability; unit-level price choices; immediate phone/email actions; an all-in-one rental manager. | Combine structured filters with natural-language discovery later. Make the detail page answer practical neighborhood and cost questions before contact. |
| Redfin Rentals | Strong saved searches, recommendations, and cross-network listing distribution. | Design saved search as a first-class object and keep future syndication possible; do not adopt its map-search interaction. |
| Zumper | Fast self-service listing, distribution to partner networks, verified/promoted labels, applications and screening tools. | Build a canonical structured listing that can later syndicate. Keep organic verification separate from paid promotion. |
| Airbnb host tools | Guided and resumable listing setup, high-quality photo guidance, AI room/photo organization, comparable-price suggestions, quick replies, AI answers grounded in listing facts, and approximate public map locations. | Use a conversational wizard with autosave. Automate photo organization and bilingual drafts, but keep the poster in control. Use a shaded approximate area rather than a fake pin. |

Supporting research:

- Zillow documents rental filters, sorting, saved searches, and alerts in its [rental search help](https://zillow.zendesk.com/hc/en-us/articles/216505347-How-do-I-search-for-rentals), while [Zillow Rental Manager](https://www.zillow.com/rental-manager/) brings listings, leads, tours, screening, leases, and payments into one workflow.
- Apartments.com describes filters, nearby schools/transit/walkability, and reusable applications in its [renter search guidance](https://renterhelp.apartments.com/article/559-how-can-i-search-for-an-apartment), and its [Rental Manager](https://www.apartments.com/rental-manager) combines advertising, messaging, screening, leases, rent, maintenance, and expenses.
- Redfin supports rental search, saved searches, and recommendations in its [rental FAQ](https://support.redfin.com/hc/en-us/articles/4517160657563-Finding-Rentals-on-Redfin-FAQ); its rental tools can also [syndicate listings](https://support.redfin.com/hc/en-us/articles/25906255408923-Redfin-Rental-Tools-FAQ).
- Zumper emphasizes posting once and distributing listings across its network in [Zumper Rental Manager](https://www.zumper.com/manage).
- Airbnb’s current host guidance describes a short guided listing process and comparable pricing in [How to get started](https://www.airbnb.com/resources/hosting-homes/a/how-to-get-started-on-airbnb-3), AI photo organization in its [Listings tab](https://www.airbnb.com/resources/hosting-homes/a/introducing-the-listings-tab-638), and listing-grounded AI replies in [Messages](https://www.airbnb.com/resources/hosting-homes/a/respond-faster-in-the-messages-tab-770).
- Most relevant to this product, Airbnb’s [map-location controls](https://www.airbnb.com/help/article/2141) show a shaded approximate area when precise location is disabled, while its [location-verification system](https://www.airbnb.com/help/article/3542) separately verifies that a property exists at the stated location and that the host has access.

### What not to copy

- Do not reproduce the clutter, advertising density, and filter overload of mature portals.
- Do not implement map-based browsing, drawn boundaries, or map/list synchronization.
- Do not expose an exact public address just because most long-term-rental sites do.
- Do not copy Airbnb’s instant-booking assumptions; this product optimizes for a qualified conversation and tour.
- Do not present a paid boost badge as verification.
- Do not launch screening, deposits, or rent payment as superficial checkboxes; each creates serious compliance and support obligations.

## 3. Product strategy

### Core jobs

For renters:

1. Find relevant rentals without translating unfamiliar housing terminology.
2. Understand the real monthly cost, lease conditions, and neighborhood fit.
3. Know whether the poster and location have actually been checked.
4. Contact the right person safely and obtain the exact address when appropriate.

For owners and agents:

1. Turn an address and photos into a complete bilingual listing quickly.
2. Keep the exact address private until they choose to reveal it.
3. Answer repetitive questions automatically without losing control.
4. Manage inquiries and tours in one place.

### North-star metric

**Qualified tour conversations per active verified listing per week.**

This rewards useful matching instead of raw traffic, messages, or listing volume.

### Supporting launch targets

These are proposed targets, not existing benchmarks:

- Median prepared-poster time to publish: under 8 minutes.
- Listing wizard completion: at least 60% of users who finish the property-details step.
- Published listings with address verification: at least 80%.
- Search-to-contact conversion: at least 8%.
- Median first response during local daytime: under 4 hours.
- Listings confirmed available within the last 14 days: at least 90%.
- Confirmed scam reports: below 1 per 1,000 active listings.

## 4. Experience and information architecture

### Public navigation

- 找房 / Find rentals
- 收藏 / Saved
- 消息 / Messages
- 发布房源 / Post a listing
- Language switch: 简体中文 | English
- Account menu

The language switch must preserve the current route, query filters, selected listing, and any draft form state.

### Main routes

```text
/[locale]
  /rentals
  /rentals/[city]
  /listing/[slug]
  /saved
  /messages
  /tours
  /post
  /dashboard/listings
  /dashboard/leads
  /dashboard/tours
  /dashboard/profile
  /safety
  /housing-rights
  /admin/moderation
```

### Search results

Desktop uses a photo-led list or responsive grid with a persistent search/filter bar and an optional comparison drawer. Mobile uses a single-column results list with a bottom filter sheet. There is no map-search mode or map/list synchronization.

Top-level controls:

- Location, university, or landmark
- Monthly price
- Bedrooms/bathrooms
- Entire home / private room / shared room / sublet
- Move-in date and minimum lease term
- More filters
- Save search

More filters:

- Furnished
- Utilities included, with individual utility selection
- Parking type and price
- Laundry
- Pets
- Accessibility features
- Air conditioning/heating
- Outdoor space
- Building amenities
- Verified location only
- Owner vs licensed agent
- Recently confirmed available
- Commute or proximity preferences expressed through neighborhoods, universities, transit stations, or landmarks; exact travel-time search is deferred

Do not include protected-class preference filters. Roommate-specific eligibility fields require jurisdiction-by-jurisdiction legal review before they are added.

### Listing card

Each card should answer the first comparison questions without opening the detail page:

- Large primary photo and photo count
- Monthly rent plus clearly labeled estimated recurring extras
- Bedrooms, bathrooms, size in ft² and optionally m²
- Entire/private/shared/sublet label
- Approximate neighborhood, not street address
- Available date and minimum term
- Top two differentiating amenities
- Separate badges: 身份已验证 / Identity verified, 地址已验证 / Location verified, 持牌经纪 / Licensed agent
- Last availability confirmation
- Save action

Sponsored placement must say “推广 / Sponsored” and must not look like a trust badge.

### Listing detail

Recommended order:

1. Photo gallery with room labels and floor plan.
2. Price, recurring fee breakdown, rental type, availability, and lease term.
3. Primary CTA: 联系发布者 / Contact poster. Secondary CTA: 申请看房 / Request a tour.
4. Verification summary that states exactly what was checked.
5. Structured property facts and amenities.
6. Description in the selected language, with a visible original/translated indicator when relevant.
7. An Airbnb-style approximate location section: neighborhood label and, if useful, a small shaded-area map—not a searchable map or pinpoint.
8. Neighborhood facts, nearby transit, and nearby essentials, described without implying an exact address.
9. Owner/agent profile, response time, active listings, and report action.
10. Safety reminder: do not send a deposit before verifying the property, poster, and lease.

On mobile, the contact/tour actions stay in a compact sticky bottom bar. The page must never leak the address through structured data, metadata, image names, alt text, map requests, or analytics events.

## 5. Exact-address privacy and reveal workflow

This is a product boundary, not a cosmetic preference.

### Public behavior — adapted Airbnb approach

- Display neighborhood and municipality. A listing detail may optionally show an approximate shaded circle, following Airbnb’s privacy pattern; it is informational and never a search interface.
- Never send exact latitude/longitude or the exact address to the browser before authorization.
- Use a stable, server-generated approximate area so the marker does not jump on refresh.
- Increase the privacy radius in low-density areas where a small circle could identify a single home.
- Show “具体地址由发布者在联系后提供 / Exact address shared by the poster after contact.”
- When verified, show “平台已核验地址，公开位置已模糊处理 / Address verified; public location is approximate.”

### Private behavior

1. Poster enters the exact address.
2. Server normalizes and geocodes it.
3. Duplicate and conflicting-listing checks run using a one-way normalized-address fingerprint.
4. The exact address and exact coordinates are stored in a restricted private schema; the public listing stores only neighborhood labels and, if approximate display is enabled, a deliberately coarse public center and radius.
5. The poster completes one available verification method: fresh geolocated photos/video, recent qualifying document, mailed code, property-management feed, or manual review.
6. Verification evidence is stored privately with a short retention policy and limited reviewer access.

### Reveal state machine

```text
hidden
  → renter_requested
  → poster_approved
  → revealed

hidden
  → tour_requested
  → tour_accepted_and_revealed

any pending state
  → declined
```

The reveal action appears as a structured card inside the conversation. It records who revealed the address, to whom, why, and when. A poster can choose manual reveal or automatic reveal when accepting a tour. Revoking access hides it in the product but must be described honestly: information already viewed cannot be made unseen.

### Safety compensation

Hidden addresses can increase scam suspicion, so compensate with:

- Location/property verification before or shortly after publication.
- Separate, precise verification badges.
- Duplicate image, address, phone, and description detection.
- OCR checks for addresses accidentally visible in photos, documents, descriptions, or floor plans.
- EXIF removal from all public images.
- Price-outlier and “payment before viewing” risk flags.
- In-chat warnings when users mention wire transfers, gift cards, cryptocurrency, or off-platform deposits.

The FTC describes copied listings, below-market prices, pressure, stolen identity data, and irreversible payment methods as common rental-scam patterns in its [rental scam guidance](https://consumer.ftc.gov/articles/rental-listing-scams). These patterns should inform risk scoring and safety copy.

## 6. Posting flow: fast, guided, and mostly automated

Use five visible stages, with small screens inside each stage. Every answer autosaves. Posters can leave and resume on any device.

### Stage 1 — Property and role

- Owner or licensed agent
- Exact address, unit, country, and property type
- Address visibility explanation before entry
- Automatic normalization, geocoding, timezone, neighborhood, and duplicate check
- For agents: brokerage and license details

### Stage 2 — Rental terms

- Entire home, private room, shared room, or sublet
- Bedrooms, bathrooms, size
- Monthly rent and currency
- Required recurring fees and utilities
- Deposit and one-time fees as structured fields
- Available date, lease length, furnished status
- Parking, pets, laundry, accessibility, and amenities

Show a live “renter sees” monthly-cost summary. Never hide mandatory recurring charges in free text.

### Stage 3 — Photos and property story

- Multi-file mobile upload with progress, retry, and background draft persistence
- Automatic compression, orientation correction, EXIF removal, duplicate detection, blur/low-light warning, and address OCR warning
- AI proposes room groups and a cover photo; poster can reorder everything
- Optional video and floor plan
- AI drafts a concise Chinese title/description and an English counterpart using only structured facts and poster notes
- Every generated claim is editable; the system must not invent amenities, views, travel times, or prices

### Stage 4 — Contact, privacy, and tours

- In-platform messaging is required; phone/email/WeChat ID are not public by default
- Choose address reveal behavior: manual or when a tour is accepted
- Set reusable tour availability windows and lead time
- Create quick replies for common questions
- Choose notification channels and quiet hours

### Stage 5 — Verify, preview, publish

- Specific verification tasks and status
- Automated completeness and fair-housing review
- Chinese and English previews, desktop and mobile
- Explain any blocked or warned content in plain language
- Publish immediately when low risk; otherwise show the expected review state without promising an unverified review time

### Post-publication automation

- Availability confirmation reminders; one-tap “still available.”
- Automatically pause stale listings after defined unanswered reminders.
- Inbox priority based on unanswered inquiries and scheduled tours.
- Listing quality suggestions based on missing structured facts—not vague scores.
- Suggested replies grounded only in listing data and conversation context; clearly identify automated replies and allow the poster to edit/disable them.
- Translation sync warnings when the poster materially changes one language version.
- Weekly performance summary: impressions, saves, qualified conversations, tour requests, response time, and search-position factors.

## 7. Messaging and tour workflow

### Renter contact form

Start with a short, structured inquiry rather than an empty text box:

- Intended move-in date
- Desired lease length
- Number of occupants
- Pets, if applicable
- Tour preference
- Optional message

Do not request SSN/SIN, credit documents, immigration status, protected characteristics, or financial documents at the inquiry stage.

### Conversation tools

- Bilingual display with optional per-message translation
- Quick replies and grounded suggested answers
- Structured cards for tour request, tour acceptance, address request, address reveal, and listing status
- Read status, attachments with malware scanning, report/block controls
- Masked contact details until users mutually choose to share them
- Automatic banner if the listing becomes unavailable

### Lead dashboard

Columns or filters:

- New
- Replied
- Tour requested
- Tour scheduled
- Address revealed
- Closed / not a fit

Do not algorithmically rank renters by protected or proxy characteristics. If “lead quality” is introduced, it must be transparent, limited to explicit logistics such as move-in timing and complete answers, and legally reviewed.

## 8. Trust, moderation, and equal-housing safeguards

### Verification model

Use separate claims rather than one generic checkmark:

- Email verified
- Phone verified
- Identity verified
- Licensed agent verified
- Property manager verified
- Property/location verified
- Availability recently confirmed

Each badge opens an explanation of what was and was not verified.

### Moderation layers

1. Deterministic validation: missing price, impossible dates, invalid fee totals, contact details in prohibited fields.
2. Similarity detection: reused photos, descriptions, addresses, phone numbers, and accounts.
3. Automated risk/content review: scam phrases, discriminatory preferences, prohibited payment demands, image OCR, extreme price outliers.
4. Human moderation queue with reason codes and an audit trail.
5. Community reporting with urgent fraud and safety paths.

### Equal-housing requirement

The site may market and operate in Simplified Chinese, but housing cannot be restricted to Chinese renters. The U.S. Fair Housing Act prohibits housing discrimination based on race, color, national origin, religion, sex, familial status, and disability, including in advertising; HUD also recognizes multilingual outreach as a legitimate way to reach people with limited English proficiency. See [HUD’s current housing-provider FAQ](https://www.hud.gov/sites/dfiles/FHEO/documents/General%20FAQ%20-%20Housing%20Providers%20and%20Fair%20Housing.pdf) and [Fair Housing rights and obligations](https://www.hud.gov/program_offices/fair_housing_equal_opp/fair_housing_rights_and_obligations).

Canadian requirements vary by province. Ontario, for example, warns listing services and landlords against phrases such as “working people only,” “professionals only,” “adults only,” and other preferences tied to protected grounds in its [fair rental ad guide](https://www.ohrc.on.ca/en/writing-fair-rental-housing-ad-fact-sheet).

Implementation requirements:

- No protected-class filters or preference chips.
- Block clearly discriminatory content before publication and explain why.
- Maintain jurisdiction-aware policy rules; do not assume one U.S./Canada rule set.
- Add equal-housing language and reporting paths.
- Do not build automated applicant approval/denial in the MVP.
- Obtain specialized housing counsel before enabling roommate exceptions, tenant screening, application fees, deposits, leases, or payments.

### Privacy

Collect the minimum necessary personal information, state each purpose, restrict access, set deletion schedules, and support access/deletion requests. Canada’s privacy regulator notes that PIPEDA governs commercial handling of personal information and specifically recommends that rental applications collect only necessary information; it also discourages unnecessary SIN collection. See the regulator’s [PIPEDA overview](https://www.priv.gc.ca/en/privacy-topics/information-and-advice-for-individuals/your-privacy-rights/businesses-and-your-personal-information/) and [rental-sector privacy tips](https://www.priv.gc.ca/en/privacy-topics/landlords-and-tenants/02_05_d_66_tips/).

## 9. Localization and content design

### Language behavior

- Default: `zh-CN` Simplified Chinese.
- Secondary: `en` English.
- Use locale-prefixed routes, canonical URLs, `hreflang`, and localized metadata.
- Remember the language choice in a cookie/account setting.
- Switching language preserves current state.
- Human-translate all product UI, safety, legal, transactional, and error copy.
- AI may draft listing copy and message translations, but must label the source and preserve the original.

### Chinese-first details

- Use natural North American Chinese rental terminology, with short explanations for unfamiliar legal/local terms.
- Show local currency as the source of truth: CAD in Canada and USD in the U.S.
- Support ft² and an optional m² conversion.
- Format dates, times, phone numbers, and addresses by locale without changing their legal value.
- Build layouts for Chinese text density and English expansion; do not hardcode button widths.
- Chinese-first should be expressed through language quality and workflow relevance, not red/gold motifs or cultural clichés.

## 10. Recommended technical architecture

### Application

- Next.js App Router with TypeScript on Vercel.
- Server Components for read-heavy public pages; Client Components only for filters, optional approximate-location display, uploads, chat, and interactive dashboards.
- `next-intl` or an equivalent App Router-compatible i18n layer for `zh-CN` and `en`. Its current documentation supports App Router, Server Components, static rendering, and localized routing: [next-intl](https://next-intl.dev/).
- Schema validation shared between client and server.
- WCAG 2.2 AA and mobile-first responsive behavior.

### Database

- Neon Postgres with pooled connections and the serverless driver.
- Type-safe migrations/queries with Drizzle ORM or an equivalent tool selected at build time.
- Neon branches for preview deployments and isolated migrations. Neon documents isolated database branching in its [workflow primer](https://neon.com/docs/get-started-with-neon/workflow-primer) and serverless connection pooling in its [pooling guide](https://neon.com/docs/connect/connection-pooling).
- Connect Neon and Vercel through the native integration; Vercel can create isolated database branches for preview deployments: [Neon for Vercel](https://vercel.com/marketplace/neon).

### Authentication

- Recommended: evaluate Neon Auth first because it stores auth data in Postgres and branches with preview databases; the current Next.js SDK uses a unified server API and signed-cookie session caching: [Neon Auth update](https://neon.com/docs/changelog/2026-01-30).
- Required sign-in methods for MVP: email magic link or password plus phone verification for posters.
- Add Google/Apple login if it meaningfully improves conversion.
- Defer WeChat login unless the selected provider and account requirements are confirmed; sharing a listing into WeChat is more important for launch than WeChat OAuth.

### Media

- Public listing images/videos: Vercel Blob public storage, using immutable randomized paths.
- Verification documents: Vercel Blob private storage or a dedicated private object store, short-lived signed access, strict staff authorization, and deletion schedules.
- Vercel describes Blob as storage for user-uploaded images/video and distinguishes public from authenticated private stores in its [Blob documentation](https://vercel.com/docs/vercel-blob).
- Generate responsive image variants and never expose verification media in the public CDN path.

### Search and location privacy

- MVP structured search: indexed Postgres fields for country, metro, city, neighborhood, university/landmark tags, rent, rental type, availability, and amenities.
- Add full-text search across both languages with Postgres search/trigram support; keep structured filters authoritative.
- Add natural-language search only after structured search is reliable. Convert the request into visible, editable filter chips so the system is explainable.
- Do not build geospatial or map-based result search.
- Keep geocoding and any optional approximate-location renderer behind a small provider adapter.
- Never send the exact point to a location-display SDK for unrevealed listings.

### Async automation

- Vercel Functions for APIs and server actions.
- Scheduled tasks for expiration, availability reminders, digests, and cleanup.
- A durable job table or queue for image processing, translations, moderation, notifications, and retries.
- All automation jobs need idempotency keys, retry limits, status, error reason, and an admin retry control.

### Observability and analytics

- Error monitoring with sensitive-field scrubbing.
- Privacy-conscious product analytics with typed events.
- Never include exact addresses, exact coordinates, message text, verification data, or document URLs in analytics or logs.
- Track the funnel: search → listing view → contact start → sent inquiry → response → tour request → tour accepted → address revealed.

## 11. Suggested Neon data model

Core tables:

```text
users
profiles
user_roles
poster_verifications

properties
private.property_addresses
property_units
property_verifications

listings
listing_translations
listing_terms
listing_fees
listing_amenities
listing_media
listing_availability_events

saved_listings
saved_searches
search_alert_deliveries

conversations
conversation_members
messages
tour_requests
address_access_grants

reports
moderation_cases
moderation_events
risk_signals

notification_preferences
notifications
automation_jobs

promotion_orders       (prepared, not necessarily launched)
audit_events
```

### Important modeling rules

- `private.property_addresses` contains normalized address components and exact coordinates. Grant access only to a restricted server role.
- `properties` contains only publish-safe data: country, region, city, neighborhood label, optional coarse public center/radius, and an address fingerprint that cannot be reversed.
- Public reads come from explicit views or repository functions that cannot select private fields.
- `address_access_grants` links one listing, one renter, one granting poster, a reason, and timestamps.
- `listing_translations` stores locale, text fields, original locale, source (`human`, `ai_draft`, `translated`), and review status.
- Fees are rows with amount, currency, cadence, required/optional status, and description; do not bury them in JSON or prose.
- Verification records store the verification type, provider/method, result, scope, and expiration—not a universal boolean.
- Use soft status transitions and append-only audit events for publication, moderation, availability, tour, and address-reveal changes.

### Recommended indexes

- B-tree composites for published listings by city, status, available date, price, rental type, and freshness.
- Trigram/full-text indexes for Chinese/English title, neighborhood, university/landmark, and description search.
- Unique/partial constraints to prevent concurrent active duplicates by property, unit, and poster.
- Conversation and message indexes by member and last activity.

## 12. Security requirements

- Private address access enforced on the server and database permissions, not hidden with CSS.
- Encrypt sensitive verification fields at application level where appropriate; rotate keys and keep them outside the database.
- Separate public and private media stores.
- Rate-limit signup, login, posting, messaging, address requests, reports, and uploads.
- Scan uploads for malware and prohibited formats.
- Strip EXIF and sanitize filenames.
- Signed, expiring links for private documents.
- CSRF protection, secure cookies, strict authorization tests, CSP, and safe rich-text handling.
- Immutable security/audit events for staff actions and address reveals.
- Automated tests that assert public APIs, HTML metadata, JSON payloads, maps, logs, and analytics never expose exact addresses.
- Data retention and account deletion workflows from day one.

## 13. MVP scope and roadmap

### Phase 0 — Product, policy, and supply preparation

- Choose pilot metro and supply policy.
- Obtain U.S./Canadian housing and privacy counsel for the selected jurisdictions.
- Finalize listing taxonomy, verification methods, moderation policy, and content rules.
- Recruit seed owners/agents before public launch.
- Decide brand, domain, vendors, and support process.

### Phase 1 — Marketplace MVP

- Simplified Chinese and English shell.
- Authentication and profiles.
- List/grid search, structured filters, listing details, saved listings/searches.
- Guided listing wizard, media upload, bilingual draft, preview, publish lifecycle.
- Exact-address private schema, optional Airbnb-style approximate location on listing details, and request/reveal workflow.
- Messaging, tour requests, notifications.
- Poster listing/lead dashboard.
- Basic verification, moderation, reporting, availability expiry.
- Admin moderation console and audit log.
- SEO landing pages for configured pilot locations.

### Phase 2 — Trust and automation

- Stronger property/identity verification integrations.
- Photo room grouping, quality scoring, OCR redaction warnings, duplicate-media detection.
- Grounded response assistant and translation.
- Commute search and richer neighborhood information.
- Listing quality recommendations, price comparisons, and performance insights.
- Clearly labeled paid boosts and professional account tools.

### Phase 3 — Transactional services

Only after legal and operational readiness:

- Reusable applications and document vault.
- Screening through a compliant third-party provider.
- Jurisdiction-specific leases and e-signature.
- Deposits/rent payments and dispute support.
- Property-management feeds and selected syndication.
- Native apps only if web push, uploads, and messaging cannot meet usage needs.

### Explicit MVP non-goals

- Nationwide inventory on day one.
- Map-based search, map/list result synchronization, radius search, or drawn search boundaries.
- Native iOS/Android apps.
- Automated renter acceptance/rejection.
- Credit/background screening.
- Lease generation, deposits, or rent collection.
- Public phone numbers, emails, WeChat IDs, or exact addresses.
- Unreviewed roommate preference filters.
- Scraping competitor listings.

## 14. Design direction for the builder

This is an operating product, so clarity and speed outrank decorative expression.

- Use a bright, daylight interface with strong contrast, generous image scale, restrained color, and dense information only where comparison benefits from it.
- Listing photography, price/term clarity, and trust signals are the visual anchors. Avoid a generic marketing hero dominating the product.
- Make privacy and verification legible through precise labels and explanatory microcopy, not shields everywhere.
- Chinese typography and English typography must feel equally intentional. Choose a CJK-capable UI system with consistent numerals and weights.
- Avoid red/gold “Chinese” branding, real-estate luxury clichés, glassmorphism, excessive gradients, and endless rounded cards.
- Desktop search should feel fast and comparative; mobile should feel like a focused sequence with one primary action at a time.
- Use motion only to explain filter application, comparison, autosave, upload progress, reveal consent, and tour-state changes.
- Every important flow requires empty, loading, offline/retry, validation, permission, success, expired, unavailable, blocked, and moderation states.

The future builder should establish the final visual world with the user before implementation; this proposal intentionally defines product behavior without locking a brand identity.

## 15. Acceptance criteria for the first production release

The release is not ready unless all of the following are true:

1. A renter can search, filter, save, contact, request a tour, and receive an address reveal in both languages on mobile and desktop.
2. A poster can create, leave, resume, preview, verify, publish, pause, renew, and mark a listing rented.
3. Language switching preserves search and draft state.
4. Mandatory fees appear in a consistent recurring/one-time cost breakdown.
5. Public clients cannot obtain exact addresses or exact coordinates through any page, API, map request, metadata, image, log, or analytics event.
6. Verification badges describe their exact scope.
7. Discriminatory and high-confidence scam content is blocked or queued with an auditable reason.
8. Listings expire or require recurring availability confirmation.
9. Keyboard, screen-reader, zoom, contrast, reduced-motion, and mobile checks meet WCAG 2.2 AA expectations.
10. Authorization, address privacy, uploads, messaging abuse, duplicate listings, and moderation transitions have automated tests.
11. Preview deployments use isolated Neon branches and do not receive production verification documents or unrestricted production personal data.
12. Admin actions and address reveals are auditable.

## 16. Builder handoff prompt

Use this as the opening instruction for the implementation model:

> Build the MVP defined in `PRODUCT.md` and `RENTAL_MARKETPLACE_PROPOSAL.md`. Use Next.js App Router with TypeScript on Vercel and Neon Postgres. The UI defaults to Simplified Chinese and supports complete English switching without losing state. Do not build map-based search. Use conventional list/grid results with structured location and property filters. Adapt Airbnb’s location-privacy approach: exact addresses and coordinates are restricted private data; listing details may receive only a server-generated coarse area, and exact address access occurs only through the audited conversation/tour reveal workflow. Implement the product in vertical slices, starting with schema and authorization, then search/listing detail, posting, messaging/tours/reveal, moderation, and dashboards. Do not implement screening, leases, deposits, or rent collection. Do not invent commercial claims, pricing, users, testimonials, or marketplace inventory. Before UI implementation, confirm pilot geography, supply policy, brand direction, and unresolved vendors with the owner.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed: Neon Postgres for the database and Vercel for hosting. Delegated recommendation for the application layer: Next.js App Router with TypeScript, a serverless Neon driver, and a type-safe ORM. The exact geocoding/location-display, messaging, email/SMS, payment, and identity-verification vendors remain open decisions.

## Users

- Primary renters: Chinese-speaking people living in or moving to North America who want to browse long-term rentals, rooms, sublets, and roommate opportunities in Simplified Chinese.
- Supply users: individual property owners and licensed agents who want a low-friction, mostly automated way to publish and manage rental listings.
- Secondary users: English-speaking renters and posters who switch the interface to English.

## Product Purpose

Create a trustworthy, bilingual rental marketplace where renters can discover suitable homes and start a qualified conversation, while owners and agents can publish a high-quality listing quickly with automation handling repetitive work. Success means an owner can publish with minimal manual writing and a renter can move from search to a useful owner/agent conversation without leaving the platform.

## Positioning

Chinese-first rental discovery with North American marketplace quality: structured bilingual listings, privacy-preserving approximate locations, verified exact addresses kept private, and an in-platform contact-and-reveal workflow that gives owners and agents control without making renters browse low-information classified posts.

## Operating Context

- Renters browse on desktop and mobile, often comparing price, lease type, move-in date, transit/commute, included utilities, furnishing, parking, and pet rules.
- Owners and agents create listings from a phone or desktop, commonly starting with an address and a set of property photos.
- The exact street address must not be publicly exposed. It is provided only when the owner or agent chooses to reveal it during a conversation or tour workflow.
- The service launches in Simplified Chinese by default, with a persistent English switch that preserves the current page, filters, and draft state.

## Capabilities and Constraints

- Public browsing through conventional list/grid results, filters, saved listings, saved-search alerts, listing details, in-platform messaging, tour requests, and owner/agent dashboards. Map-based search is not part of the product.
- Guided, autosaving listing creation with structured fields, photo organization, bilingual AI-assisted copy, validation, preview, moderation, and expiration/renewal.
- Exact address and exact coordinates are private data. Public pages receive only a server-generated approximate area and coarse location label.
- Separate verification signals are required for identity, professional role, and property/address; a generic badge must not imply more than was actually checked.
- The platform is for housing outreach in Chinese, not housing restricted to Chinese people. Listing copy, filters, ranking, and screening must not facilitate unlawful discrimination.
- Initial geography, monetization, brand name, approximate-location/geocoding vendor, verification vendor, and whether renters/roommates may post supply are open decisions.

## Evidence on Hand

- Research and product proposal: `RENTAL_MARKETPLACE_PROPOSAL.md`.
- No existing brand name, logo, production listings, customer testimonials, pricing, or proprietary market data exists. Future work must not fabricate these as commercial facts.

## Product Principles

1. Make trust visible and specific.
2. Keep exact addresses private by design, not by presentation-only hiding.
3. Ask once, reuse structured data everywhere, and automate reversible work.
4. Make Chinese the first-class product language while keeping every workflow fully usable in English.
5. Optimize for successful conversations and tours, not page views or low-quality lead volume.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Support keyboard navigation, visible focus, screen readers, reduced motion, high contrast, descriptive media alternatives, responsive zoom, and clear non-color status cues. Chinese-language outreach must coexist with equal-housing access and jurisdiction-specific anti-discrimination controls.

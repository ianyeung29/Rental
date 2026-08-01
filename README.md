# 租住 · Rental marketplace pilot

This is the first vertical slice of the Chinese-first North American rental marketplace described in `../PRODUCT.md` and `../RENTAL_MARKETPLACE_PROPOSAL.md`.

## Current slice

- Simplified Chinese default with an English switch that preserves the current client state.
- Conventional list results with location, rent, rental type, move-in, and additional filters.
- Synthetic listings clearly labeled as demo inventory.
- Separate location, identity, and availability signals.
- Approximate-area privacy language with no exact address in public content.
- Save listing, save search, compare up to two listings, listing detail drawer, structured inquiry flow, and poster-flow preview.
- Responsive desktop/mobile composition with reduced-motion and keyboard-focus handling.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Intentional next steps

- Add the Neon/Drizzle schema with explicit private address tables and server-only repository functions.
- Add authentication and persistent saved listings/searches.
- Replace sample inventory with moderated seed listings for the selected pilot metro.
- Connect real media storage, geocoding, verification, messaging, and notifications after vendor decisions.
- Add automated authorization and exact-address non-disclosure tests before production use.

The brand, pilot geography, supply policy, and external vendors remain open decisions from the proposal.

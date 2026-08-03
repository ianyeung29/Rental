---
name: Civic Signal Desk rental marketplace
description: A bright, bilingual rental search that makes status, cost, and address privacy legible.
colors:
  primary: "#2768F0"
  primary-deep: "#1D4FC0"
  visibility-lime: "#D7E85D"
  ink: "#142A44"
  neutral-bg: "#F6F4EF"
  surface: "#FFFDF9"
  blue-wash: "#EDF2F8"
  divider: "#DEDFD9"
  muted: "#637384"
  coral-save: "#E28C61"
typography:
  display:
    fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "clamp(3rem, 6vw, 5.9rem)"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.065em"
  headline:
    fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "clamp(20px, 2vw, 26px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.045em"
  body:
    fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.72
  label:
    fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.14em"
rounded:
  square: "0px"
  circle: "50%"
spacing:
  xs: "6px"
  sm: "9px"
  md: "14px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.square}"
    padding: "0 14px"
    height: "44px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 14px"
    height: "42px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 11px"
    height: "43px"
  listing-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "22px 24px 18px"

# Design System: Civic Signal Desk rental marketplace

## Overview

**Creative North Star: “The Civic Signal Desk.”**

This interface borrows the clarity of a multilingual public-service counter, an availability board, and a well-kept folder system. It is an operating surface first: the renter should be able to scan, filter, compare, and understand the next safe action without wading through a marketing hero or a low-information classified feed.

The world is porcelain paper, enamel blue, visibility lime, and tabbed panels. Listing photography supplies warmth and human scale; status labels supply confidence. The product is Chinese-first without red/gold cultural shorthand. Surfaces are flat and squared at rest, with depth reserved for drawers and transient feedback.

**Key Characteristics:**

- A split search workbench with filters on the left and evidence-rich listings on the right.
- Explicit synthetic-inventory and approximate-area language instead of invented marketplace authority.
- Separate location, identity, and availability signals.
- One strong action per state: search, compare, view, contact, or publish.

## Colors

The palette treats blue as the navigation and action signal, lime as visibility and confirmation, and cool paper neutrals as the working surface.

### Primary

- **Enamel Signal Blue** (#2768F0): Primary search, contact, link, and active-navigation action.
- **Deep Signal Blue** (#1D4FC0): Hover, text links, and high-contrast signal copy.

### Secondary

- **Visibility Lime** (#D7E85D): Availability confirmation, current-stage emphasis, and the small working-status mark.
- **Save Coral** (#E28C61): Saved-listing state only; never a verification or error signal.

### Neutral

- **Desk Ink** (#142A44): Headings, primary copy, top-level action surfaces, and the dark comparison bar.
- **Porcelain Paper** (#F6F4EF): The page canvas and quiet filter surfaces.
- **Warm Surface** (#FFFDF9): Listing cards, fields, and drawer interiors.
- **Blue Wash** (#EDF2F8): Privacy, synthetic-data, and explanatory callouts.
- **Divider Gray** (#DEDFD9): Structural rules and card borders.
- **Working Muted** (#637384): Supporting copy, metadata, and secondary labels.

**The Signal Separation Rule.** Blue means action or navigation; lime means a confirmed or current state; coral means saved by the renter. Do not use a generic badge color to imply a verification claim.

## Typography

**Display Font:** DM Sans with Noto Sans SC, PingFang SC, Microsoft YaHei, and system fallbacks.

**Body Font:** The same paired stack keeps Latin and Simplified Chinese in one workhorse voice.

**Character:** Dense Chinese display forms are allowed to carry the first-viewport thesis, while supporting copy stays compact and calm. Labels use short uppercase English markers only where they function as desk notation.

### Hierarchy

- **Display** (600, `clamp(3rem, 6vw, 5.9rem)`, `0.96` line-height): First-viewport thesis; its scale is the signal, not decoration.
- **Headline** (700, `clamp(20px, 2vw, 26px)`, `1.12` line-height): Listing titles and workbench headings.
- **Title** (700, `21px`, compact line-height): Filter, detail, and drawer section titles.
- **Body** (400, `16px`, `1.72` line-height): Introductory and explanatory copy; keep long text near 65–75ch.
- **Label** (700, `10–12px`, `0.06–0.14em` tracking): Metadata, status, filter labels, and desk notation.

**The Two-Language Measure Rule.** Never size controls around a Chinese string alone. English expansion and Chinese density must fit the same field, button, and navigation rhythm.

## Layout

The desktop surface uses a 1480px maximum canvas with 32px outer padding. The first operating view is a two-column workbench: a 276px sticky filter desk and a flexible results column separated by 24px. Listings use a 31% media column and a structured evidence column. A three-column principle rail closes the surface.

At 840px, the workbench becomes one column and the filter desk becomes a normal flow section. At 600px, the header becomes a compact two-row system, cards stack their image above the evidence, actions become full-width, and drawers occupy the full viewport width. The mobile filter is a focused vertical sequence rather than a desktop sidebar compressed into a narrow strip.

## Elevation & Depth

The default world is flat and structural: borders, white surfaces, and tonal blue wash carry hierarchy. A single soft shadow vocabulary is reserved for drawers and toasts that must sit above the work surface; listing cards do not float by default. Motion is used once on workbench arrival, then as restrained state transitions for image hover, drawers, and feedback.

### Shadow Vocabulary

- **Overlay lift** (`0 18px 46px rgba(20, 42, 68, 0.1)`): Drawer and toast separation from the page.

**The Flat-by-Default Rule.** Do not add a shadow to a listing card to make it feel premium; the border and image provide the structure.

## Shapes

Primary cards, buttons, fields, chips, and panels use square corners (`0px`) to keep the interface closer to signage and a paper desk than a collection of floating app bubbles. Circular silhouettes are reserved for the account avatar, save action, and small status dots. Borders are 1px and cool gray; the only thick visual edge is the active navigation underline.

## Components

### Buttons

- **Primary:** Enamel Signal Blue fill, white text, 44px height, square corners, and 8px internal gap for an inline icon.
- **Outline:** Transparent/white surface with a 1px structural border, 42px height, and blue wash on hover or selected state.
- **Text:** No container; used for reset, link, and explanation actions. Keep the action verb visible.
- **Hover / Focus:** Blue shifts to Deep Signal Blue; focus uses a 3px translucent blue outline with 3px offset.

### Chips

- **Style:** Paper background, muted text, and compact 4–6px padding. Chips are for listing facts and filters, not page structure.
- **State:** Active filter chips use blue border and Blue Wash; listing fact chips remain neutral.

### Cards / Containers

- **Listing card:** White, square-cornered, 1px divider border, 31% image column, 22–24px internal evidence padding.
- **Filter desk:** White, square-cornered, 1px border, 22px padding, sticky only on desktop.
- **Callout:** Blue Wash with an explicit reason or privacy boundary; never use it for decorative color.

### Inputs / Fields

- **Style:** White 43px fields with square corners, 1px line, short labels, and generous 11px horizontal padding.
- **Focus:** Border becomes Enamel Signal Blue with a restrained 3px translucent ring.
- **Error / Empty:** Empty results explain the condition and give one clear recovery action. Production validation will extend this pattern.

### Navigation

- **Desktop:** White sticky header, brand mark at left, compact utility links, language switch, poster action, and account avatar. The active page uses a 3px blue underline.
- **Mobile:** Brand and utility actions stay in the top row; primary navigation moves to a horizontal second row so Chinese and English labels remain readable.

### Privacy Signal

The approximate-area note, lock icon, and `Exact address stays private` copy recur across filters, listing evidence, details, and inquiry. The signature is explanatory rather than ornamental: every privacy statement tells the renter what is visible now and what unlocks a later reveal.

## Do's and Don'ts

### Do:

- **Do** keep synthetic inventory visibly labeled until real, moderated listings exist.
- **Do** show total recurring and one-time cost structure beside the headline rent as structured data becomes available.
- **Do** keep location, identity, and availability verification claims separate and explain their scope.
- **Do** let listing photography carry warmth while the interface carries clarity.
- **Do** preserve language and filter state when the locale switch changes copy.

### Don't:

- **Don't** expose exact addresses or exact coordinates in public listing UI, metadata, or analytics.
- **Don't** use a red/gold cultural theme, luxury-real-estate gloss, glassmorphism, or decorative gradients.
- **Don't** use a generic checkmark badge to imply a verification scope that was not performed.
- **Don't** introduce map search, protected-class filters, screening, deposits, or rent collection into this first surface.
- **Don't** turn every fact into a rounded card; the workbench is a system of desks, dividers, and clear actions.

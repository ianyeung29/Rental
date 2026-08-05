---
name: Anjurentals rental marketplace
description: A bright bilingual rental workbench that makes price, availability, privacy, and next actions legible.
colors:
  primary: "#2768F0"
  primary-deep: "#1D4FC0"
  visibility-lime: "#D7E85D"
  lime-dark: "#6E7D18"
  ink: "#142A44"
  paper: "#F6F4EF"
  paper-deep: "#EBE8DF"
  panel: "#FFFDF9"
  blue-wash: "#EDF2F8"
  line: "#DEDFD9"
  line-strong: "#BCC5C5"
  muted: "#617080"
  soft-muted: "#83909A"
  saved-coral: "#E28C61"
typography:
  display:
    fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "clamp(3rem, 6vw, 5.9rem)"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.065em"
  headline:
    fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "clamp(21px, 2.2vw, 29px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.045em"
  title:
    fontFamily: "DM Sans, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.04em"
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
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 11px"
    height: "43px"
  listing-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "30px 32px 24px"
  feature-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    rounded: "{rounded.square}"
    padding: "0 8px"
    height: "30px"
  privacy-callout:
    backgroundColor: "{colors.blue-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "14px"
---

# Design System: Anjurentals rental marketplace

## Overview

**Creative North Star: "The Civic Signal Desk"**

Anjurentals (安居) is an operating surface first: a clear, bilingual rental workbench that feels closer to a multilingual public-service counter, an availability board, and a well-kept folder system than to a promotional real-estate feed. Renters should be able to scan, filter, compare, browse photos, and understand the next safe action without losing the important evidence in decorative UI.

The current implementation uses porcelain paper, enamel blue, visibility lime, and tabbed panels. Listing photography supplies warmth and human scale; structured facts, privacy notes, and trust signals supply confidence. The Chinese-first product has a persistent English switch, but the visual system does not use red/gold cultural shorthand, luxury gloss, glassmorphism, or decorative gradients. Surfaces are flat and squared at rest, with depth reserved for drawers, mobile filter overlays, public forms, and transient feedback.

**Key Characteristics:**

- A split search workbench with a 276px filter desk and evidence-rich results.
- Explicit synthetic-inventory, approximate-area, and exact-address privacy language.
- Location shortcuts, feature tags, gallery browsing, and structured facts that keep decisions scannable.
- One strong action per state: search, compare, view, contact, publish, or save.

## Colors

The palette makes blue the action and navigation signal, lime the current or confirmed state, coral the renter's saved state, and paper neutrals the working surface.

### Primary

- **Enamel Signal Blue** (#2768F0): Search, contact, primary links, active navigation, selected controls, and focus-adjacent emphasis.
- **Deep Signal Blue** (#1D4FC0): Hover states, high-contrast links, and action text on pale backgrounds.

### Secondary

- **Visibility Lime** (#D7E85D): Current workflow stages, availability confirmation, publish emphasis, and the small working-status mark.
- **Lime Marker** (#6E7D18): Text and icon contrast on lime surfaces and confirmed-state labels.

### Tertiary

- **Save Coral** (#E28C61): Saved-listing state only; it is not an error, verification, or warning color.

### Neutral

- **Desk Ink** (#142A44): Headings, primary copy, dark compare bars, and high-contrast actions.
- **Porcelain Paper** (#F6F4EF): Page canvas, quiet filter surfaces, and secondary chip surfaces.
- **Paper Deep** (#EBE8DF): Image placeholders and quiet media wells.
- **Warm Panel** (#FFFDF9): Listing cards, drawers, fields, and public-surface containers.
- **Blue Wash** (#EDF2F8): Privacy, synthetic-data, AI-assistance, and explanatory callouts.
- **Divider Gray** (#DEDFD9): Structural rules and card borders.
- **Strong Divider** (#BCC5C5): Form strokes, outlined controls, and stronger section boundaries.
- **Working Muted** (#617080): Metadata, supporting copy, and secondary labels.
- **Soft Muted** (#83909A): Quiet notation, helper text, and low-priority status detail.

**The Signal Separation Rule.** Blue means action or navigation; lime means a confirmed or current state; coral means saved by the renter. A badge must never imply a verification scope that was not actually performed.

## Typography

**Display Font:** DM Sans with Noto Sans SC, PingFang SC, Microsoft YaHei, and system fallbacks.

**Body Font:** The same paired stack keeps Latin and Simplified Chinese in one workhorse voice.

**Character:** Display text is compact and decisive; body copy is calm, readable, and generous enough for Chinese and English expansion. Small uppercase English labels function as desk notation rather than as decorative branding.

### Hierarchy

- **Display** (600, `clamp(3rem, 6vw, 5.9rem)`, `0.96` line-height): First-viewport thesis and major operating headings.
- **Headline** (700, `clamp(21px, 2.2vw, 29px)`, `1.08` line-height): Listing titles and prominent result headings.
- **Title** (700, `21px`, `1.12` line-height): Filter, drawer, compare, and section headings.
- **Body** (400, `16px`, `1.72` line-height): Explanatory copy and public information surfaces; keep long text close to 65-75ch.
- **Label** (700, `10-12px`, `0.06-0.14em` tracking): Metadata, status, filter labels, navigation notation, and compact controls.

**The Two-Language Measure Rule.** Never size a control around a Chinese string alone. English expansion and Chinese density must fit the same field, button, navigation rhythm, and mobile action row.

## Layout

The main marketplace uses a 1480px maximum canvas with 32px desktop gutters. Its primary workbench is a 276px filter desk plus a flexible results column separated by 24px. The filter desk uses a 22px interior rhythm and remains sticky on desktop. Results are stacked listing cards with a minimum 280px media column that occupies roughly 37% of the card; cards have a structured evidence column for price, lease facts, feature tags, trust signals, privacy, and actions.

At 1080px, outer padding tightens and the card media column reduces to 36%. At 840px, the workbench becomes one column, the filter form uses two columns for compact criteria, and the listing media column expands to 40%. At 600px, the header becomes a compact two-row system, cards stack image above evidence, actions become full-width, and the filter desk becomes a right-side drawer up to 370px wide with a scrim. The public information surfaces use a quieter 1180px canvas and collapse their split layouts at the same breakpoints.

Spacing follows a compact desk rhythm: 6px, 9px, 14px, 24px, and 32px are the reusable small-to-large steps, with 16px mobile gutters and larger section bands for public pages. Horizontal rules, not floating containers, carry most of the page structure.

## Elevation & Depth

The default world is flat and structural: borders, white panels, blue wash, and image scale carry hierarchy. The shared shadow (`0 20px 60px rgba(20, 42, 68, 0.14)`) is reserved for drawers, public forms, and toasts that must sit above the work surface. Listing cards use a restrained hover lift only as a state response; the normal card has no shadow. Image galleries use a deep overlay only in fullscreen mode.

### Shadow Vocabulary

- **Overlay lift** (`0 20px 60px rgba(20, 42, 68, 0.14)`): Drawers, public forms, and transient toast feedback.
- **Listing hover** (`0 14px 30px rgba(20, 42, 68, 0.08)`): A small result-card hover response; never the resting state.
- **Filter drawer lift** (`-18px 0 44px rgba(20, 42, 68, 0.16)`): Mobile filter separation from the scrimmed results page.

**The Flat-by-Default Rule.** Do not add a shadow to a listing card to make it feel premium; the border, image, and evidence hierarchy provide the structure.

## Shapes

Buttons, cards, fields, chips, panels, drawers, and form controls use square corners (`0px`) to keep the interface closer to signage and a paper desk than to a collection of floating app bubbles. Circular silhouettes are reserved for the account avatar, save action, language dot, and small status marks (`50%`). Borders are 1px in cool gray; the active navigation underline and featured-card top edge are the only intentionally heavier structural accents.

## Components

### Buttons

- **Shape:** Square corners (0px), compact inline icon gap, and clear action verbs.
- **Primary:** Enamel Signal Blue fill, white text, 44px minimum height, and 0 14px horizontal padding.
- **Outline:** Transparent or white surface, 1px strong-divider border, 42px minimum height, and blue-wash selected/hover state.
- **Text:** Borderless blue action for reset, link, and explanation actions; keep the verb visible.
- **Hover / Focus:** Primary blue shifts to Deep Signal Blue. Focus uses a 3px translucent blue outline with a 3px offset.

### Chips

- **Style:** Feature chips are paper-toned, square, compact, and separated by 7px gaps. Listing tags use blue wash and blue top emphasis, with lime-toned alternation for visual grouping.
- **State:** Selected filter chips use a blue border and blue wash. A chip describes a fact or filter; it does not replace a heading or status explanation.

### Cards / Containers

- **Listing card:** Warm panel, square corners, 1px divider border, 37% media column at desktop, and 30px 32px 24px evidence padding.
- **Filter desk:** Warm panel, square corners, 1px border, 22px padding, sticky on desktop, two-column criteria at tablet widths, and a full-height drawer on mobile.
- **Public form / callout:** Strong-divider border, warm panel or blue wash, and enough padding to make required fields and safety notes easy to scan.
- **Compare summary:** Blue wash with a 3px blue top edge; it is a conclusion surface, not a decorative card.

### Inputs / Fields

- **Style:** White 43px fields with square corners, 1px strong-divider strokes, short labels, and 11px horizontal padding. Public forms use 47px fields and 28px container padding.
- **Focus:** Border becomes Enamel Signal Blue with a restrained 3px translucent blue ring.
- **Error / Empty:** Use explicit bordered status panels with muted explanatory text and one recovery action. Do not rely on color alone.

### Navigation

- **Desktop:** Sticky warm-panel header, brand mark at left, compact utility links, language switch, lime publish action, and circular account avatar. The active page uses a 3px blue underline.
- **Mobile:** Brand and utility actions remain in the top row; primary navigation moves to a horizontally scrollable second row so Chinese and English labels stay readable.

### Listing Gallery

The result card supports previous/next controls, touch swiping, a live photo count, and an image button that opens the detail drawer. The detail gallery adds thumbnails, fullscreen viewing, keyboard arrows, Escape to close, and a privacy note over approximate-area media. Gallery controls are square and high-contrast against the photo.

### Privacy and Trust Signal

The approximate-area note, lock icon, synthetic-inventory notice, and separate location/availability/email/photo signals recur across filters, results, details, and inquiry flows. The signature is explanatory rather than ornamental: every privacy statement tells the renter what is visible now and what can be revealed later.

## Do's and Don'ts

### Do:

- **Do** keep synthetic inventory visibly labeled until real, moderated listings exist.
- **Do** keep location, identity, availability, email, and property verification claims separate and state their scope.
- **Do** let listing photography carry warmth while the interface carries clarity.
- **Do** preserve filters, drafts, and the current page when the language switch changes copy.
- **Do** show exact bedroom, bathroom, and optional square-foot values as structured facts when supplied.
- **Do** maintain visible focus, keyboard access, reduced-motion behavior, and non-color status cues.

### Don't:

- **Don't** expose exact addresses or exact coordinates in public listing UI, metadata, or analytics.
- **Don't** use red/gold cultural shorthand, luxury-real-estate gloss, glassmorphism, or decorative gradients.
- **Don't** use a generic checkmark badge to imply a verification scope that was not performed.
- **Don't** turn every fact into a rounded card; the workbench is a system of desks, dividers, and clear actions.
- **Don't** make English or Chinese expansion overflow a field, chip, navigation item, or mobile action row.
- **Don't** use shadows or bright accents as decoration when a divider, label, or explicit explanation will communicate the state.

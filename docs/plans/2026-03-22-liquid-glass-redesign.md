# ArtTok Liquid Glass Redesign — Full Design Document

**Date:** 2026-03-22
**Status:** Approved
**Concept:** "Museum at Night" — glass surfaces where artwork light radiates through the UI

---

## 1. Design Philosophy

ArtTok's glass isn't generic frosted plastic. It's the feeling of looking at art through gallery glass in a dark museum — reflective, luminous, with the artwork's own colors bleeding through every surface. The accent glow isn't decorative; it's the artwork *radiating* through the UI.

**Layout model:** TikTok/Reels hybrid — full-bleed artwork, floating glass action buttons, compact glass info strip. Maximum artwork real estate with premium glass chrome.

**Glass intensity:** Bold / Liquid Glass — heavy blur, prominent luminous borders, accent-colored glow and refraction, visible specular highlights.

**Accent color:** Per-artwork, derived from `art.id` hue. Every card feels unique.

---

## 2. Design System — Tokens & Primitives

### 2.1 Typography

| Role | Font | Fallback | Usage |
|------|------|----------|-------|
| Display | `"Playfair Display"` | `Georgia, serif` | Titles, headings, brand |
| Body | `"DM Sans"` | `system-ui, sans-serif` | Body text, labels, UI |

- Load via Google Fonts: `Playfair Display:700,800` + `DM Sans:400,500,600`
- Serif/sans pairing = "high art meets modern tech"

### 2.2 Glass Elevation System

Three tiers of glass, creating visual hierarchy:

| Level | Name | Background | Blur | Border | Use |
|-------|------|-----------|------|--------|-----|
| L1 | Background | `rgba(255,255,255,0.04)` | `24px` | `rgba(255,255,255,0.08)` | Nav, page headers |
| L2 | Surface | `rgba(255,255,255,0.08)` | `32px` | `rgba(255,255,255,0.15)` | Info strip, panels, cards |
| L3 | Interactive | `rgba(255,255,255,0.12)` | `16px` | `rgba(255,255,255,0.25)` | Buttons, active states |

### 2.3 CSS Custom Properties

```css
:root {
  /* Typography */
  --font-display: "Playfair Display", Georgia, serif;
  --font-body: "DM Sans", system-ui, sans-serif;

  /* Glass Level 1 — Background */
  --glass-l1-bg: rgba(255, 255, 255, 0.04);
  --glass-l1-blur: 24px;
  --glass-l1-border: rgba(255, 255, 255, 0.08);

  /* Glass Level 2 — Surface */
  --glass-l2-bg: rgba(255, 255, 255, 0.08);
  --glass-l2-blur: 32px;
  --glass-l2-border: rgba(255, 255, 255, 0.15);

  /* Glass Level 3 — Interactive */
  --glass-l3-bg: rgba(255, 255, 255, 0.12);
  --glass-l3-blur: 16px;
  --glass-l3-border: rgba(255, 255, 255, 0.25);
  --glass-l3-border-bright: rgba(255, 255, 255, 0.35);

  /* Shared glass effects */
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --glass-shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.5);
  --glass-noise-opacity: 0.03;
  --glass-specular: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.05) 40%,
    transparent 60%
  );

  /* Per-artwork accent (overridden inline per card) */
  --accent-h: 0;
  --accent-s: 74%;
  --accent-l: 58%;
  --accent-rgb: 227, 73, 91; /* computed from HSL */
  --accent: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
  --accent-glow: 0 0 20px hsla(var(--accent-h), 80%, 60%, 0.3);
  --accent-bleed: radial-gradient(
    ellipse at bottom center,
    hsla(var(--accent-h), 80%, 60%, 0.12) 0%,
    transparent 70%
  );

  /* Surfaces */
  --bg-primary: #050505;
  --text-primary: #f5f5f5;
  --text-secondary: rgba(245, 245, 245, 0.7);
  --text-tertiary: rgba(245, 245, 245, 0.45);

  /* Radii */
  --radius-glass-panel: 24px;
  --radius-glass-card: 16px;
  --radius-glass-pill: 999px;
  --radius-glass-button: 50%;

  /* Motion */
  --ease-glass: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-glass: 0.3s;
}
```

### 2.4 Noise Texture

Inline SVG data URI applied as a pseudo-element over all glass surfaces:

```css
.glass::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: var(--glass-noise-opacity);
  pointer-events: none;
  mix-blend-mode: overlay;
  z-index: 1;
}
```

### 2.5 Specular Highlight

Applied as a pseudo-element on glass surfaces — simulates light catching curved glass:

```css
.glass::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--glass-specular);
  pointer-events: none;
  z-index: 2;
  transition: background-position var(--duration-glass) var(--ease-glass);
}
```

On hover, shift the gradient position to simulate light movement.

---

## 3. Page-by-Page Redesign

### 3.1 Feed Page — ArtCard

**Current problems:**
- Artwork sits in lower half with huge dark void above
- Info section takes ~40% of viewport, competing with artwork
- Action buttons visually disconnected from info
- "ARTWORK DETAILS" button looks like primary CTA
- Museum credit is orphaned text
- No scroll progress indicator
- No loading skeleton
- No double-tap discoverability

**New layout (top to bottom):**

```
┌─────────────────────────────┐
│ [ARTTOK]        [🔍] [⚙]  │  ← Glass L1 header
│                             │
│                             │
│      ┌───────────────┐      │
│      │               │      │
│      │   ARTWORK     │      │  ← Image fills 70-75% of viewport
│      │   IMAGE       │      │
│      │               │      │
│      │        ♥ burst│      │
│      └───────────────┘      │
│  #tag                       │  ← Glass pill badge
│                        [♥]  │
│                       Save  │  ← Glass L3 action buttons
│ ┌─ glass info strip ──────┐│       (right column)
│ │ Title              [↑]  ││
│ │ Artist             Share││
│ │ Description...      [⤢] ││
│ │ [Created] [Culture] Full││
│ │ Museum credit · Details ││
│ └─────────────────────────┘│
│ ┌─ glass pill nav ────────┐│  ← Floating glass L1 pill
│ │ 🏠  🔍  ⊞  ♥           ││
│ └─────────────────────────┘│
└─────────────────────────────┘
```

**Info strip specs:**
- Glass L2 surface
- Rounded top corners (`24px`), flat bottom (meets nav area)
- Max height: 25% of viewport
- Accent bleed gradient tinting the glass from the artwork color
- Staggered entrance animation: title (0ms) → artist (80ms) → description (160ms) → facts (240ms)
- Museum credit: single line, `--text-tertiary`, inside the strip at bottom
- "Artwork details" becomes a small glass L3 pill, secondary style

**Action buttons:**
- Glass L3 circles, positioned right side, vertically centered with info strip
- Accent glow on hover
- Like button: subtle breathing glow animation on idle (3s cycle, box-shadow opacity pulse)
- Active like: luminous accent fill with bright border
- Labels below each button: `--font-body`, 0.65rem, uppercase

**Badge:**
- Glass L1 pill, top-left of image area
- Accent-tinted border
- Smaller: 0.68rem

**Scroll progress:**
- Thin vertical dots on right edge, or a minimal progress bar at top
- Glass-styled, shows position in feed

**Loading state:**
- Shimmer skeleton: glass rectangles pulsing with a gradient sweep

### 3.2 Feed Page — Expanded Details (Bottom Sheet)

**Current problems:**
- Expanding pushes artwork completely off screen
- Detail items duplicate quick facts
- Action buttons get pushed off-screen
- No way to dismiss by tapping outside

**New behavior:**
- Details expand as a **glass bottom sheet overlay** sliding up over the artwork
- Sheet covers max 60% of viewport — artwork remains visible behind the glass
- Quick facts disappear when detail sheet is open (no duplication)
- Detail grid: 2-column for short values, full-width for long values
- Glass L2 surface with accent bleed
- Dismiss: swipe down, tap outside, or tap close button
- Smooth spring animation for open/close

```
┌─────────────────────────────┐
│                             │
│      ┌───────────────┐      │
│      │   ARTWORK     │      │  ← Still visible (40% viewport)
│      │   (dimmed)    │      │
│      └───────────────┘      │
│ ┌─ glass detail sheet ─────┐│
│ │ ── drag handle ──        ││  ← Small glass pill indicator
│ │                          ││
│ │ Title                    ││
│ │ Artist                   ││
│ │                          ││
│ │ [Created    ] [Culture ] ││  ← 2-col glass L2 cards
│ │ [Classification        ] ││
│ │ [Medium                ] ││  ← Full-width for long text
│ │ [Dimensions            ] ││
│ │                          ││
│ │ 🔗 View at Harvard      ││  ← Glass pill link
│ └──────────────────────────┘│
│ ┌─ nav ───────────────────┐│
│ └─────────────────────────┘│
└─────────────────────────────┘
```

### 3.3 Liked Art Page

**Current problems:**
- Plain header, no personality
- Unlike buttons are visually heavy/distracting
- No sort/filter options
- No tap feedback on cards
- Card info text crammed against edges
- Generic empty state

**New design:**

**Header:**
- Glass L1 sticky header
- "Liked Art" in `--font-display`, 1.5rem
- Count as glass L3 pill with accent glow
- Back arrow as glass circle button

**Sort/Filter row:**
- Horizontal scroll row of glass L1 pills below header
- Options: "Recent", "Artist", "Culture", "Title"
- Active pill: Glass L3 with accent glow

**Grid cards:**
- Glass L2 cards with `--radius-glass-card` (16px)
- Image fills top, rounded top corners
- Info section: glass interior padding (0.85rem), title in `--font-display` 0.9rem, artist in `--font-body` 0.75rem `--text-secondary`
- Unlike button: small glass circle, **only visible on hover (desktop) or long-press (mobile)** — reduces visual noise
- Tap feedback: scale(0.97) + accent glow pulse
- Hover: `translateY(-4px)` lift + glass border brightens

**Staggered entrance:**
- Cards animate in with staggered cascade (fade + slide up, 50ms delay per card)

**Empty state:**
- Centered glass L2 card
- Large outline heart icon
- "Your collection is empty"
- "Double-tap artworks in the feed to start collecting"
- Glass L3 CTA pill: "Explore the feed"

**Responsive grid:**
- Mobile: 2 columns
- Tablet (768px+): 3 columns
- Desktop (1024px+): 4 columns

### 3.4 Search Page

**Current problems:**
- Plain header, generic search input
- No clear button on input
- No live search / suggestions
- Results count is orphaned text
- No filter/sort on results
- No loading skeleton
- No empty state suggestions
- No image fallback

**New design:**

**Header:**
- Glass L1 sticky header
- Search input integrated into header: glass L2 styled, search icon inside left, clear (X) button right when text present
- Accent-colored focus ring glow on the input
- Round corners (`--radius-glass-pill`)

**Filter row:**
- Below header, horizontal scroll of glass L1 pills
- Options: "All", "Paintings", "Sculptures", "Drawings", "Photographs", "Prints"
- Active: glass L3 with accent

**Results count:**
- Glass L1 pill: "204 results" — positioned below filters

**Result cards:**
- Same glass L2 treatment as liked page cards
- Text hierarchy: title `--font-display` bold, artist `--font-body` medium, meta (culture + date) small `--text-tertiary`
- Staggered entrance animation
- Hover: lift + glow

**Loading state:**
- Glass skeleton grid (8 placeholder cards with shimmer)

**Empty state (no query):**
- "Discover masterpieces" heading
- Suggested search terms as tappable glass pills: "Impressionism", "Japanese", "Rembrandt", "Sculpture", "Renaissance"

**Empty state (no results):**
- "No artworks found for [query]"
- Suggestion pills for related terms

**Image fallback:**
- Glass placeholder with small artwork icon when image fails to load

### 3.5 Browse / Categories Page

**Current problems (biggest overhaul needed):**
- Wall of identical text chips — no visual interest
- No imagery at all
- No hierarchy between popular (91k) and niche (200) categories
- Overwhelming — 30+ chips at once
- No search/filter within categories
- No preview of contents

**New design:**

**Header:**
- Glass L1 sticky header
- "Browse" in `--font-display`
- Search/filter input: glass L2 pill for quickly finding a category

**Hero categories (top section):**
- Top 6-8 categories by count displayed as **large glass L2 cards in a 2-column grid**
- Each card has a representative artwork image as background (fetched from the category's first result)
- Culture name overlaid in `--font-display`, bold, with text shadow
- Count as small glass pill in corner
- Glass overlay on the image with accent bleed
- Tapping navigates to search with that filter

```
┌──────────┐ ┌──────────┐
│ 🖼 bg    │ │ 🖼 bg    │
│          │ │          │
│ American │ │ German   │
│ 91,333   │ │ 38,786   │
└──────────┘ └──────────┘
┌──────────┐ ┌──────────┐
│ French   │ │ Italian  │
│ 26,046   │ │ 12,517   │
└──────────┘ └──────────┘
```

**Remaining categories:**
- Section divider with decorative accent line
- Glass L1 chips, but with **size variation based on count**:
  - High count (>5000): larger pill, `--font-body` 0.9rem
  - Medium count (1000-5000): standard pill, 0.82rem
  - Low count (<1000): compact pill, 0.75rem
- Creates a tag-cloud visual effect — popular categories naturally draw the eye
- Each chip has a subtle warm/cool tint based on category type

**Section titles:**
- "BY CULTURE", "BY CLASSIFICATION", "BY CENTURY"
- Larger text (1rem), `--font-display`, with a thin accent-colored line beneath
- Sticky within scroll so you always know which section you're in

**Responsive:**
- Hero cards: 2 columns on mobile, 3 on tablet, 4 on desktop
- Chip area: flex-wrap with natural flow

### 3.6 Artwork Detail Page

**Current state (from code, not screenshotted):**
- Plain layout, basic styling
- Image, then text blocks below

**New design:**

**Header:**
- Glass L1 sticky, with back button as glass circle + page title truncated

**Hero image:**
- Full-width, max 50vh, with glass frame effect (subtle inner shadow + glass border)
- Tap to zoom (existing behavior, keep)

**Info section:**
- Glass L2 card below image
- Title in `--font-display`, 1.75rem
- Artist in `--font-body`, `--text-secondary`
- Description: `--font-body`, 0.95rem, with read more toggle

**Metadata grid:**
- Glass L2 cards in 2-column grid
- Each card: label (small, uppercase, `--text-tertiary`) + value

**Actions row:**
- Glass L3 pill buttons: "Save", "Share"
- Active like: accent fill with glow
- Museum link: glass pill with external link icon

**Color palette (existing feature):**
- Swatches become glass circles with the color as a glow behind them (not filled squares)
- Tapping copies hex and briefly tints the header glass with that color

**Scale reference (existing feature):**
- Glass L2 card containing the human + artwork comparison

### 3.7 Bottom Nav (Global)

**Current:** Full-width bar, edge-to-edge, white/grey active state.

**New design:**
- **Floating glass L1 pill**, centered horizontally
- Horizontal margin: `1rem` from each edge
- Bottom margin: `max(0.75rem, env(safe-area-inset-bottom))`
- Border-radius: `24px`
- Height: ~56px

**Items:**
- Icons: outlined (stroke) when inactive, filled when active
- Active item: accent-colored glow dot (4px circle) beneath icon
- Icon color: `--text-tertiary` inactive → `--text-primary` active
- Tap animation: scale(0.9) → scale(1.0) spring
- Labels: `--font-body`, 0.6rem, uppercase

**Icon updates:**
- Home: house (keep)
- Search: magnifier (keep)
- Browse: compass icon (replacing 4-squares — better communicates exploration)
- Liked: heart (keep), outlined inactive / filled active

### 3.8 Liked Panel (Slide-out, Feed Page)

**Current:** Slide-from-right panel with opaque dark bg.

**New design:**
- Glass L2 full-height panel
- Heavy blur showing the feed behind it
- Glass close button (circle, top-right)
- Items: glass L1 cards with rounded corners
- Accent bleed on each item from the artwork's hue
- Empty state: glass card with heart icon + prompt

---

## 4. Global UI/UX Improvements

### 4.1 Loading States
- **Feed:** Glass skeleton card — shimmer gradient sweep over glass rectangles (image area, title bar, fact pills)
- **Grid pages:** 6-8 glass skeleton cards in grid
- **Detail page:** Glass skeleton for image + info blocks
- Shimmer: `@keyframes` moving a light gradient across glass surfaces

### 4.2 Error States
- Glass L2 card centered on page
- Error icon + message + glass L3 "Try again" pill button
- Accent-red tint for error severity

### 4.3 Toast Notifications
- Glass L2 pill, appears from bottom center above nav
- "Liked!", "Link copied!", "Share canceled"
- Auto-dismiss after 2s with fade-out
- Accent glow matching the action (heart color for like, neutral for copy)

### 4.4 Page Transitions
- Cross-page: fade (150ms) + subtle slide (8px vertical)
- CSS `view-transition-api` if supported, fallback to React transition group

### 4.5 Scrollbar Styling
- Feed: hide scrollbar entirely (`scrollbar-width: none`)
- Grid pages: thin glass-styled scrollbar (`4px`, `rgba(255,255,255,0.1)` thumb)

### 4.6 Pull-to-Refresh (Feed)
- Glass spinner animation at top
- Circular glass indicator that fills as you pull

### 4.7 Image Fallback
- Glass placeholder card with centered artwork outline icon
- Shown when image fails to load or during lazy load

---

## 5. Motion & Animation Spec

### 5.1 Staggered Info Reveal (ArtCard)
```css
.art-card__info > * {
  opacity: 0;
  transform: translateY(12px);
  animation: glass-reveal 0.5s var(--ease-glass) forwards;
}
.art-card__info > *:nth-child(1) { animation-delay: 0ms; }
.art-card__info > *:nth-child(2) { animation-delay: 80ms; }
.art-card__info > *:nth-child(3) { animation-delay: 160ms; }
.art-card__info > *:nth-child(4) { animation-delay: 240ms; }

@keyframes glass-reveal {
  to { opacity: 1; transform: translateY(0); }
}
```

### 5.2 Like Button Breathing Glow
```css
@keyframes glass-breathe {
  0%, 100% { box-shadow: var(--glass-shadow), 0 0 12px hsla(var(--accent-h), 80%, 60%, 0.15); }
  50% { box-shadow: var(--glass-shadow), 0 0 24px hsla(var(--accent-h), 80%, 60%, 0.35); }
}
.art-card__action-button--like:not(.is-active) {
  animation: glass-breathe 3s ease-in-out infinite;
}
```

### 5.3 Grid Card Entrance
```css
.grid-card {
  opacity: 0;
  transform: translateY(16px);
  animation: card-enter 0.4s var(--ease-glass) forwards;
}
/* Delay set via inline style: style="animation-delay: ${index * 50}ms" */

@keyframes card-enter {
  to { opacity: 1; transform: translateY(0); }
}
```

### 5.4 Bottom Sheet (Detail Expand)
```css
.detail-sheet {
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.detail-sheet.is-open {
  transform: translateY(0);
}
```

### 5.5 Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  /* Glass blur and glow preserved — they are visual, not motion */
}
```

---

## 6. Files Changed

### CSS
- `src/App.css` — Full rewrite of all styles (~1500 lines → estimated ~1800 lines with glass system)

### Components (TSX changes)
- `src/components/ArtCard.tsx` — Glass classes, bottom sheet details, skeleton loader
- `src/components/BottomNav.tsx` — Floating pill layout, new icons, active glow
- `src/components/LikedArtPanel.tsx` — Glass panel treatment
- `src/pages/FeedPage.tsx` — Skeleton loader, scroll progress, pull-to-refresh
- `src/pages/ArtworkDetailPage.tsx` — Glass cards, color palette glow, metadata grid
- `src/pages/SearchPage.tsx` — Glass input, filter pills, skeleton, empty states
- `src/pages/LikedPage.tsx` — Glass cards, sort pills, empty state, staggered animation
- `src/pages/CategoriesPage.tsx` — Hero cards, sized chips, search filter, section headers

### New Files
- None required — all changes are to existing files

### Static Assets
- Google Fonts link added to `index.html`: Playfair Display + DM Sans

---

## 7. Performance Considerations

- `backdrop-filter: blur()` is GPU-accelerated but expensive on many elements. Limit to visible elements; use `will-change: backdrop-filter` sparingly
- Noise texture SVG is tiny inline data URI — no network request
- Staggered animations use CSS-only — no JS animation library needed
- Google Fonts: use `display=swap` + preconnect for fast loading
- Image lazy loading already in place — keep
- Skeleton loaders prevent layout shift (CLS)

---

## 8. Browser Support

- `backdrop-filter`: Chrome 76+, Safari 9+, Firefox 103+. Fallback: solid semi-transparent bg without blur
- `scroll-snap`: Already in use, well-supported
- CSS custom properties: All modern browsers
- `@keyframes` / animations: Universal
- `view-transition-api`: Progressive enhancement only (Chrome 111+)

---

## 9. Accessibility

- All glass surfaces maintain minimum 4.5:1 contrast ratio for text (WCAG AA)
- Focus indicators: accent-colored glow ring (2px) on all interactive elements — visible through glass
- `prefers-reduced-motion`: All animations disabled, glass visual effects preserved
- ARIA labels maintained on all buttons and actions
- Keyboard navigation: Tab order follows visual layout
- Bottom sheet: focus trap when open, Escape to close
- Screen reader: Glass is purely visual — no semantic impact

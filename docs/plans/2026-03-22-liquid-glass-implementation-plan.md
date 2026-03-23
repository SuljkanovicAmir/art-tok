# Liquid Glass Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign ArtTok's entire UI with bold liquid glass / glassmorphism aesthetic inspired by TikTok + Instagram Reels, using per-artwork accent colors, serif/sans typography pairing, and 3-tier glass elevation system.

**Architecture:** CSS-first approach — rewrite `App.css` and `index.css` with glass design tokens and component styles. Minimal TSX changes — mostly adding CSS classes, skeleton loaders, and restructuring the ArtCard info/details section into a bottom-sheet overlay. No new dependencies except Google Fonts.

**Tech Stack:** Plain CSS (custom properties, backdrop-filter, @keyframes), React 19, TypeScript 5, existing component structure.

**Design doc:** `docs/plans/2026-03-22-liquid-glass-redesign.md`

---

## Task 1: Add Google Fonts and Update Base Tokens

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

**Step 1: Add Google Fonts preconnect and stylesheet to index.html**

Add to `<head>` in `index.html`, before the `<title>` tag:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

Also update `<title>` to `ArtTok — Discover Art`.

**Step 2: Rewrite `src/index.css` with glass design tokens**

Replace the entire contents of `src/index.css` with the glass design system foundation:

```css
:root {
  color-scheme: dark;

  /* ── Typography ── */
  --font-display: "Playfair Display", Georgia, "Times New Roman", serif;
  --font-body: "DM Sans", system-ui, -apple-system, sans-serif;

  /* ── Glass Level 1 — Background (nav, headers) ── */
  --glass-l1-bg: rgba(255, 255, 255, 0.04);
  --glass-l1-blur: 24px;
  --glass-l1-border: rgba(255, 255, 255, 0.08);

  /* ── Glass Level 2 — Surface (info strip, panels, cards) ── */
  --glass-l2-bg: rgba(255, 255, 255, 0.08);
  --glass-l2-blur: 32px;
  --glass-l2-border: rgba(255, 255, 255, 0.15);

  /* ── Glass Level 3 — Interactive (buttons, active states) ── */
  --glass-l3-bg: rgba(255, 255, 255, 0.12);
  --glass-l3-blur: 16px;
  --glass-l3-border: rgba(255, 255, 255, 0.25);
  --glass-l3-border-bright: rgba(255, 255, 255, 0.35);

  /* ── Shared glass effects ── */
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --glass-shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.5);
  --glass-noise-opacity: 0.03;
  --glass-specular: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.05) 40%,
    transparent 60%
  );

  /* ── Per-artwork accent (defaults, overridden per card) ── */
  --accent-h: 0;
  --accent-s: 74%;
  --accent-l: 58%;
  --accent: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
  --accent-soft: hsla(var(--accent-h), 86%, 62%, 0.32);
  --accent-surface: hsla(var(--accent-h), 92%, 68%, 0.16);
  --accent-glow: 0 0 20px hsla(var(--accent-h), 80%, 60%, 0.3);
  --accent-glow-strong: 0 0 32px hsla(var(--accent-h), 80%, 60%, 0.45);

  /* ── Surfaces ── */
  --bg-primary: #050505;
  --text-primary: #f5f5f5;
  --text-secondary: rgba(245, 245, 245, 0.7);
  --text-tertiary: rgba(245, 245, 245, 0.45);

  /* ── Radii ── */
  --radius-panel: 24px;
  --radius-card: 16px;
  --radius-pill: 999px;
  --radius-button: 50%;

  /* ── Motion ── */
  --ease-glass: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-fast: 0.15s;
  --duration-normal: 0.3s;
  --duration-slow: 0.5s;

  background-color: var(--bg-primary);
  color: var(--text-primary);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  height: 100%;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button {
  font: inherit;
  font-family: var(--font-body);
  cursor: pointer;
}

img {
  display: block;
  max-width: 100%;
}

/* ── Noise texture overlay (applied via .glass-noise class) ── */
.glass-noise::after {
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

/* ── Shared keyframes ── */
@keyframes glass-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glass-breathe {
  0%, 100% {
    box-shadow: var(--glass-shadow), 0 0 12px hsla(var(--accent-h), 80%, 60%, 0.15);
  }
  50% {
    box-shadow: var(--glass-shadow), 0 0 24px hsla(var(--accent-h), 80%, 60%, 0.35);
  }
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 3: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS — no errors, CSS-only changes.

**Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "feat: add glass design system tokens and Google Fonts"
```

---

## Task 2: Rewrite Feed Header + Bottom Nav (Glass L1)

**Files:**
- Modify: `src/App.css` (header and bottom-nav sections)
- Modify: `src/components/BottomNav.tsx` (floating pill + new icons)
- Modify: `src/pages/FeedPage.tsx` (add glass-noise class to header)

**Step 1: Rewrite `.art-feed__header` styles in `src/App.css`**

Replace lines 11-66 (`.art-feed__header` through `.art-feed__icon-button.is-active`) with glass L1 header:

```css
.art-feed__header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--feed-header-height);
  padding: 0.75rem 1.15rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 20;
  background: var(--glass-l1-bg);
  backdrop-filter: blur(var(--glass-l1-blur));
  -webkit-backdrop-filter: blur(var(--glass-l1-blur));
  border-bottom: 1px solid var(--glass-l1-border);
  box-shadow: var(--glass-shadow);
}

.art-feed__brand {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.28rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-shadow: 0 0 20px hsla(var(--accent-h), 80%, 60%, 0.3);
}

.art-feed__header-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.art-feed__icon-button {
  border: 1px solid var(--glass-l3-border);
  background: var(--glass-l3-bg);
  backdrop-filter: blur(var(--glass-l3-blur));
  -webkit-backdrop-filter: blur(var(--glass-l3-blur));
  color: inherit;
  border-radius: var(--radius-button);
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  box-shadow: var(--glass-shadow);
  transition: background var(--duration-normal) var(--ease-glass),
    transform var(--duration-fast) var(--ease-glass),
    border-color var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass);
  position: relative;
  overflow: hidden;
}

.art-feed__icon-button::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--glass-specular);
  pointer-events: none;
  z-index: 1;
}

.art-feed__icon-button svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: currentColor;
  position: relative;
  z-index: 2;
}

.art-feed__icon-button:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--glass-l3-border-bright);
  box-shadow: var(--glass-shadow), var(--accent-glow);
}

.art-feed__icon-button:active {
  transform: scale(0.94);
}

.art-feed__icon-button.is-active {
  background: var(--accent);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: var(--glass-shadow-elevated), var(--accent-glow-strong);
}
```

**Step 2: Rewrite bottom nav styles in `src/App.css`**

Replace the `.bottom-nav` section (lines 1477-1510) with floating glass pill:

```css
/* ── Bottom Navigation — Floating Glass Pill ── */
.bottom-nav {
  position: fixed;
  bottom: max(0.75rem, env(safe-area-inset-bottom));
  left: 1rem;
  right: 1rem;
  z-index: 100;
  background: var(--glass-l1-bg);
  backdrop-filter: blur(var(--glass-l1-blur));
  -webkit-backdrop-filter: blur(var(--glass-l1-blur));
  border: 1px solid var(--glass-l1-border);
  border-top-color: var(--glass-l3-border);
  border-radius: var(--radius-panel);
  box-shadow: var(--glass-shadow-elevated);
  display: flex;
  justify-content: space-around;
  padding: 0.45rem 0.5rem;
  max-width: 400px;
  margin: 0 auto;
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
}

.bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0.75rem;
  color: var(--text-tertiary);
  text-decoration: none;
  font-family: var(--font-body);
  font-size: 0.6rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: color var(--duration-normal) var(--ease-glass),
    transform var(--duration-fast) var(--ease-glass);
  position: relative;
}

.bottom-nav__item.is-active {
  color: var(--text-primary);
}

.bottom-nav__item.is-active::after {
  content: "";
  position: absolute;
  bottom: -0.15rem;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px hsla(var(--accent-h), 80%, 60%, 0.6);
}

.bottom-nav__item:active {
  transform: scale(0.9);
}

.bottom-nav__item svg {
  width: 22px;
  height: 22px;
}
```

**Step 3: Update BottomNav.tsx icons — outlined inactive, filled active**

In `src/components/BottomNav.tsx`, update the nav items to use outline (stroke) icons by default, and replace the Browse icon with a compass:

```tsx
import { Link, useLocation } from "react-router-dom";

const navItems = [
  {
    path: "/",
    label: "Home",
    activeIcon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8z" />
      </svg>
    ),
    inactiveIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 11l9-8 9 8M5 10v9h4v-6h6v6h4v-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: "/search",
    label: "Search",
    activeIcon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z" />
      </svg>
    ),
    inactiveIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    path: "/categories",
    label: "Browse",
    activeIcon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
    inactiveIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    path: "/liked",
    label: "Liked",
    activeIcon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
    inactiveIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bottom-nav glass-noise" aria-label="Main navigation">
      {navItems.map((item) => {
        const isActive =
          item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav__item${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive ? item.activeIcon : item.inactiveIcon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 4: Add `glass-noise` class to feed header in FeedPage.tsx**

In `src/pages/FeedPage.tsx`, line 51, add `glass-noise` class:

```tsx
<header className="art-feed__header glass-noise">
```

**Step 5: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 6: Commit**

```bash
git add src/App.css src/components/BottomNav.tsx src/pages/FeedPage.tsx
git commit -m "feat: glass L1 header and floating pill bottom nav"
```

---

## Task 3: Rewrite ArtCard — Glass Info Strip + Action Buttons

**Files:**
- Modify: `src/App.css` (`.art-card` section, lines 88-472)
- Modify: `src/components/ArtCard.tsx` (restructure info as glass strip, add glass classes)

**Step 1: Rewrite ArtCard CSS in `src/App.css`**

Replace the entire `.art-card` block (lines 88-472) with:

```css
/* ── ArtCard ── */
.art-card {
  --accent-h: 0;
  --accent-s: 74%;
  --accent-l: 58%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100%;
  margin: 0;
  scroll-snap-align: start;
  overflow: hidden;
  background: var(--bg-primary);
  isolation: isolate;
}

/* ── Media area ── */
.art-card__media {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 1.2rem;
  cursor: pointer;
  z-index: 1;
}

.art-card__image {
  position: relative;
  max-width: 100%;
  max-height: 75vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 20px;
  box-shadow: 0 26px 60px rgba(0, 0, 0, 0.5);
  z-index: 1;
}

/* ── Badge ── */
.art-card__badge {
  position: absolute;
  top: 1.15rem;
  left: 1.3rem;
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-pill);
  background: var(--glass-l1-bg);
  backdrop-filter: blur(var(--glass-l1-blur));
  -webkit-backdrop-filter: blur(var(--glass-l1-blur));
  border: 1px solid var(--glass-l1-border);
  font-family: var(--font-body);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), var(--accent-glow);
  z-index: 3;
}

/* ── Like burst ── */
.art-card__like-burst {
  position: absolute;
  display: grid;
  place-items: center;
  color: var(--accent);
  transform-origin: center;
  animation: art-card-like-burst 0.7s ease forwards;
  z-index: 3;
  top: 50%;
  left: 50%;
  filter: drop-shadow(0 0 20px hsla(var(--accent-h), 80%, 60%, 0.6));
}

.art-card__like-burst svg {
  width: 3.2rem;
  height: 3.2rem;
  fill: currentColor;
}

@keyframes art-card-like-burst {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  35% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
}

/* ── Glass info strip ── */
.art-card__info {
  position: absolute;
  inset: auto 0 0 0;
  padding: 1.6rem 5rem 2rem 1.25rem;
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border-top: 1px solid var(--glass-l2-border);
  border-top-left-radius: var(--radius-panel);
  border-top-right-radius: var(--radius-panel);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  align-items: flex-start;
  z-index: 3;
  overflow: hidden;
}

/* Accent bleed — artwork color radiating through glass */
.art-card__info::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    ellipse at bottom center,
    hsla(var(--accent-h), 80%, 60%, 0.1) 0%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

/* Specular highlight */
.art-card__info::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 30%,
    rgba(255, 255, 255, 0.15) 70%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 2;
}

/* Staggered reveal animation */
.art-card__info > * {
  position: relative;
  z-index: 1;
  opacity: 0;
  transform: translateY(10px);
  animation: glass-reveal var(--duration-slow) var(--ease-glass) forwards;
}
.art-card__info > *:nth-child(1) { animation-delay: 0ms; }
.art-card__info > *:nth-child(2) { animation-delay: 80ms; }
.art-card__info > *:nth-child(3) { animation-delay: 160ms; }
.art-card__info > *:nth-child(4) { animation-delay: 240ms; }
.art-card__info > *:nth-child(5) { animation-delay: 320ms; }

/* ── Title group ── */
.art-card__title-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.art-card__title {
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 5vw, 1.7rem);
  font-weight: 700;
  letter-spacing: 0.01em;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.7);
}

.art-card__title-link {
  color: inherit;
  text-decoration: none;
}

.art-card__artist {
  font-family: var(--font-body);
  font-size: clamp(0.88rem, 3.5vw, 1rem);
  letter-spacing: 0.03em;
  color: var(--text-secondary);
}

/* ── Description ── */
.art-card__description {
  font-family: var(--font-body);
  font-size: 0.88rem;
  line-height: 1.55;
  color: rgba(245, 245, 245, 0.85);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.art-card__description.is-expanded {
  display: block;
}

.art-card__description-toggle {
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: var(--font-body);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.68rem;
  margin-left: 0.4rem;
}

/* ── Quick facts pills ── */
.art-card__quick-facts {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.78rem;
}

.art-card__quick-facts li {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-pill);
  background: var(--glass-l3-bg);
  backdrop-filter: blur(var(--glass-l3-blur));
  -webkit-backdrop-filter: blur(var(--glass-l3-blur));
  border: 1px solid var(--glass-l3-border);
  letter-spacing: 0.03em;
  color: rgba(245, 245, 245, 0.85);
  max-width: 100%;
}

.art-card__quick-facts-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.65;
}

.art-card__quick-facts-value {
  font-weight: 600;
  word-break: break-word;
}

/* ── Details toggle + museum link — glass pills ── */
.art-card__details {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: 100%;
}

.art-card__details-toggle {
  border: 1px solid var(--glass-l3-border);
  background: var(--glass-l3-bg);
  backdrop-filter: blur(var(--glass-l3-blur));
  -webkit-backdrop-filter: blur(var(--glass-l3-blur));
  color: var(--text-primary);
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-pill);
  font-family: var(--font-body);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: background var(--duration-normal) var(--ease-glass),
    border-color var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass);
}

.art-card__details-toggle:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--glass-l3-border-bright);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), var(--accent-glow);
}

.art-card__details.is-open .art-card__details-toggle {
  background: rgba(255, 255, 255, 0.2);
  border-color: var(--glass-l3-border-bright);
}

.art-card__details-grid {
  display: grid;
  gap: 0.5rem;
  width: 100%;
}

.art-card__details-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-card);
  background: var(--glass-l2-bg);
  border: 1px solid var(--glass-l2-border);
}

.art-card__details-item dt {
  font-family: var(--font-body);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--text-tertiary);
}

.art-card__details-item dd {
  font-family: var(--font-body);
  font-weight: 500;
  line-height: 1.4;
  color: rgba(245, 245, 245, 0.88);
  word-break: break-word;
}

.art-card__museum-link {
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-l3-border);
  background: var(--glass-l3-bg);
  backdrop-filter: blur(var(--glass-l3-blur));
  -webkit-backdrop-filter: blur(var(--glass-l3-blur));
  color: var(--text-primary);
  padding: 0.4rem 1rem;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-decoration: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: background var(--duration-normal) var(--ease-glass),
    border-color var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass);
}

.art-card__museum-link:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--glass-l3-border-bright);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), var(--accent-glow);
}

/* ── Action buttons — glass L3 ── */
.art-card__actions {
  position: absolute;
  bottom: 8rem;
  right: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  align-items: center;
  z-index: 4;
}

.art-card__action {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  color: rgba(245, 245, 245, 0.9);
}

.art-card__action-label {
  font-family: var(--font-body);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.7);
}

.art-card__action-button {
  width: 2.85rem;
  height: 2.85rem;
  border-radius: var(--radius-button);
  border: 1px solid var(--glass-l3-border);
  background: var(--glass-l3-bg);
  backdrop-filter: blur(var(--glass-l3-blur));
  -webkit-backdrop-filter: blur(var(--glass-l3-blur));
  color: inherit;
  display: grid;
  place-items: center;
  box-shadow: var(--glass-shadow);
  transition: transform var(--duration-fast) var(--ease-glass),
    background var(--duration-normal) var(--ease-glass),
    border-color var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass),
    color var(--duration-normal) var(--ease-glass);
  position: relative;
  overflow: hidden;
}

/* Specular on buttons */
.art-card__action-button::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--glass-specular);
  pointer-events: none;
  z-index: 1;
}

.art-card__action-button:hover {
  transform: translateY(-2px) scale(1.06);
  background: rgba(255, 255, 255, 0.2);
  border-color: var(--glass-l3-border-bright);
  box-shadow: var(--glass-shadow-elevated), var(--accent-glow);
}

.art-card__action-button:active {
  transform: scale(0.92);
}

.art-card__action-button.is-active {
  background: var(--accent);
  border-color: rgba(255, 255, 255, 0.5);
  color: var(--bg-primary);
  box-shadow: var(--glass-shadow-elevated), var(--accent-glow-strong);
}

/* Breathing glow on like button when not active */
.art-card__action-button--like:not(.is-active) {
  animation: glass-breathe 3s ease-in-out infinite;
}

.art-card__action-button--link {
  text-decoration: none;
}

.art-card__action-svg {
  width: 1.35rem;
  height: 1.35rem;
  fill: currentColor;
  position: relative;
  z-index: 2;
}

.art-card__share-feedback {
  position: absolute;
  right: calc(100% + 0.5rem);
  top: 50%;
  transform: translateY(-50%);
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border: 1px solid var(--glass-l2-border);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
  font-family: var(--font-body);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: var(--glass-shadow);
}
```

**Step 2: Update ArtCard.tsx — add like button class and accent HSL custom properties**

In `src/components/ArtCard.tsx`:

a) Update the `accentStyle` computation (around line 122-127) to use the new CSS custom property format:

```tsx
const hue = Math.abs(art.id) % 360;
const accentStyle = {
  "--accent-h": String(hue),
  "--accent-s": "74%",
  "--accent-l": "58%",
} as CSSProperties;
```

b) Add `art-card__action-button--like` class to the like button (around line 256):

```tsx
className={`art-card__action-button art-card__action-button--like ${isLiked ? "is-active" : ""}`.trim()}
```

**Step 3: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 4: Commit**

```bash
git add src/App.css src/components/ArtCard.tsx
git commit -m "feat: glass ArtCard info strip and action buttons with accent bleed"
```

---

## Task 4: Glass Skeleton Loader + Feed Loading States

**Files:**
- Modify: `src/App.css` (add skeleton styles)
- Modify: `src/pages/FeedPage.tsx` (skeleton component for loading)

**Step 1: Add skeleton loader CSS to `src/App.css`**

Add after the art-card section:

```css
/* ── Skeleton Loader ── */
.skeleton {
  position: relative;
  height: 100vh;
  width: 100%;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.25rem;
  background: var(--bg-primary);
}

.skeleton__image {
  position: absolute;
  inset: 10% 10% 30% 10%;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.skeleton__image::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

.skeleton__info {
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border: 1px solid var(--glass-l2-border);
  border-radius: var(--radius-panel) var(--radius-panel) 0 0;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.skeleton__line {
  height: 0.85rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  position: relative;
}

.skeleton__line::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

.skeleton__line--title {
  width: 70%;
  height: 1.2rem;
}

.skeleton__line--subtitle {
  width: 45%;
  height: 0.75rem;
}

.skeleton__line--short {
  width: 30%;
}

.skeleton__pills {
  display: flex;
  gap: 0.4rem;
}

.skeleton__pill {
  width: 80px;
  height: 1.6rem;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  position: relative;
}

.skeleton__pill::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

/* ── Feed status messages — glass styled ── */
.art-feed__status {
  margin: 0 auto;
  text-align: center;
  padding: 0.85rem 1.25rem;
  color: var(--text-secondary);
  font-family: var(--font-body);
}

.art-feed__status--floating {
  position: sticky;
  bottom: 5rem;
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border: 1px solid var(--glass-l2-border);
  border-radius: var(--radius-pill);
  width: fit-content;
  box-shadow: var(--glass-shadow);
}

.art-feed__error {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border: 1px solid var(--glass-l2-border);
  padding: 1.5rem 1.75rem;
  border-radius: var(--radius-panel);
  text-align: center;
  box-shadow: var(--glass-shadow-elevated);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  font-family: var(--font-body);
}

.art-feed__error button {
  border: 1px solid var(--glass-l3-border);
  background: var(--glass-l3-bg);
  color: inherit;
  padding: 0.45rem 1rem;
  border-radius: var(--radius-pill);
  font-family: var(--font-body);
  transition: background var(--duration-normal) var(--ease-glass);
}

.art-feed__error button:hover {
  background: rgba(255, 255, 255, 0.18);
}
```

**Step 2: Add skeleton component to FeedPage.tsx**

In `src/pages/FeedPage.tsx`, add a `FeedSkeleton` component before the `FeedPage` function:

```tsx
function FeedSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton__image" />
      <div className="skeleton__info">
        <div className="skeleton__line skeleton__line--title" />
        <div className="skeleton__line skeleton__line--subtitle" />
        <div className="skeleton__line" />
        <div className="skeleton__pills">
          <div className="skeleton__pill" />
          <div className="skeleton__pill" />
          <div className="skeleton__pill" />
        </div>
      </div>
    </div>
  );
}
```

Then replace the loading state (line 73-75) with:

```tsx
{isInitialLoad && <FeedSkeleton />}
```

**Step 3: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 4: Commit**

```bash
git add src/App.css src/pages/FeedPage.tsx
git commit -m "feat: glass skeleton loader and glass-styled feed status messages"
```

---

## Task 5: Glass Page Headers (Search, Liked, Categories, Detail)

**Files:**
- Modify: `src/App.css` (rewrite all page header styles)

**Step 1: Rewrite all page header/common styles with glass treatment**

Replace the search-page, liked-page, categories-page, and detail-page header styles in `src/App.css` with glass L1 variants. Each page's header gets:

- `background: var(--glass-l1-bg)` + `backdrop-filter: blur(var(--glass-l1-blur))`
- `border-bottom: 1px solid var(--glass-l1-border)`
- `box-shadow: var(--glass-shadow)`
- Headings use `font-family: var(--font-display)`
- Back links become glass pill style
- All text uses `var(--font-body)` by default

Apply glass treatment to all page-level elements:
- Search input: glass L2 with accent focus glow
- Search submit button: glass L3
- Result cards: glass L2 with card-enter animation and hover lift
- Liked cards: glass L2 with hover glow
- Category chips: glass L1 with size variation based on count
- Category section titles: `var(--font-display)` with accent underline
- Detail page metadata cards: glass L2
- Detail page action buttons: glass L3 pills
- All empty states: glass L2 centered cards
- All status/loading messages: use `var(--font-body)`, `var(--text-secondary)`
- Count badges: glass L3 pills

The CSS for each page should follow the same pattern as the ArtCard — glass backgrounds, glass borders, glass blur, accent glows on hover, specular highlights where appropriate.

Key changes per page:

**Search page:** Glass search bar integrated into header, glass result cards, staggered card entrance. Search input gets `box-shadow: 0 0 0 2px hsla(var(--accent-h), 80%, 60%, 0.3)` on focus.

**Liked page:** Glass header with count pill, glass grid cards with hover lift (`translateY(-4px)`), unlike button only `opacity: 0` → `opacity: 1` on card hover.

**Categories page:** Glass section headers with accent line, chips get `font-size` variation (larger for counts >5000, smaller for <1000).

**Detail page:** Glass sticky header, glass metadata cards in 2-column grid, glass action pills, color palette swatches as glass circles with colored glow.

**Step 2: Update the responsive media queries**

Ensure all `@media` blocks reference the same glass tokens. Desktop cards get `border-radius: var(--radius-panel)` and `border: 1px solid var(--glass-l2-border)`.

**Step 3: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 4: Commit**

```bash
git add src/App.css
git commit -m "feat: glass treatment for all page headers and content areas"
```

---

## Task 6: Glass Grid Cards + Staggered Animations (Search, Liked)

**Files:**
- Modify: `src/pages/SearchPage.tsx` (staggered animation delay, empty state)
- Modify: `src/pages/LikedPage.tsx` (staggered animation, empty state, hover unlike)

**Step 1: Add staggered animation delay to search result cards**

In `src/pages/SearchPage.tsx`, add inline `animationDelay` to each result card:

```tsx
{results.map((art, index) => (
  <div
    className="search-result-card"
    key={art.id}
    style={{ animationDelay: `${index * 50}ms` }}
  >
```

Update the empty state (no query) to show glass suggestion pills:

```tsx
{!error && !hasSearched && (
  <div className="search-page__empty">
    <p className="search-page__empty-title">Discover masterpieces</p>
    <div className="search-page__suggestions">
      {["Impressionism", "Japanese", "Rembrandt", "Sculpture", "Renaissance"].map((term) => (
        <button
          key={term}
          type="button"
          className="search-page__suggestion"
          onClick={() => { setInput(term); setKeywordParams({ keyword: term }); }}
        >
          {term}
        </button>
      ))}
    </div>
  </div>
)}
```

**Step 2: Add staggered animation to liked page cards**

In `src/pages/LikedPage.tsx`, add inline `animationDelay`:

```tsx
{artworks.map((piece, index) => (
  <LikedCard key={piece.id} piece={piece} index={index} />
))}
```

Update `LikedCard` to accept and use `index`:

```tsx
function LikedCard({ piece, index }: { piece: ArtPiece; index: number }) {
  // ...
  return (
    <div className="liked-card" style={{ animationDelay: `${index * 50}ms` }}>
```

Update the empty state to be a glass card:

```tsx
<div className="liked-page__empty">
  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
  <p>Your collection is empty</p>
  <p className="liked-page__empty-hint">Double-tap artworks in the feed to start collecting</p>
  <Link to="/" className="liked-page__empty-cta">Explore the feed</Link>
</div>
```

**Step 3: Add corresponding CSS for suggestions and empty state CTA**

Add to `src/App.css`:

```css
.search-page__empty-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin-bottom: 1rem;
}

.search-page__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.search-page__suggestion {
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border: 1px solid var(--glass-l2-border);
  border-radius: var(--radius-pill);
  color: var(--text-primary);
  padding: 0.45rem 1rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  transition: background var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass);
}

.search-page__suggestion:hover {
  background: rgba(255, 255, 255, 0.14);
  box-shadow: var(--accent-glow);
}

.liked-page__empty-hint {
  font-size: 0.82rem;
  color: var(--text-tertiary);
}

.liked-page__empty-cta {
  display: inline-block;
  margin-top: 0.5rem;
  background: var(--glass-l3-bg);
  backdrop-filter: blur(var(--glass-l3-blur));
  -webkit-backdrop-filter: blur(var(--glass-l3-blur));
  border: 1px solid var(--glass-l3-border);
  border-radius: var(--radius-pill);
  color: var(--text-primary);
  padding: 0.5rem 1.25rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: background var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass);
}

.liked-page__empty-cta:hover {
  background: rgba(255, 255, 255, 0.18);
  box-shadow: var(--accent-glow);
}
```

**Step 4: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.css src/pages/SearchPage.tsx src/pages/LikedPage.tsx
git commit -m "feat: staggered card animations and glass empty states"
```

---

## Task 7: Categories Page Overhaul — Hero Cards + Sized Chips

**Files:**
- Modify: `src/pages/CategoriesPage.tsx` (hero cards, sized chips, search filter)
- Modify: `src/App.css` (hero card styles, chip sizing)

**Step 1: Update CategoriesPage.tsx**

Restructure to show top categories as hero cards with images, remaining as sized glass chips, with a search/filter input:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useFacetsQuery } from "../hooks/useFacetsQuery";

const HERO_COUNT = 6;

export default function CategoriesPage() {
  const { data: sections, isLoading, error } = useFacetsQuery();
  const [filter, setFilter] = useState("");

  const filterLower = filter.toLowerCase();

  return (
    <div className="categories-page">
      <header className="categories-page__header glass-noise">
        <Link to="/" className="categories-page__back" aria-label="Back to feed">
          &larr;
        </Link>
        <h1 className="categories-page__heading">Browse</h1>
      </header>

      <div className="categories-page__filter">
        <input
          className="categories-page__filter-input"
          type="text"
          placeholder="Filter categories..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="categories-page__status">Loading categories...</div>
      )}

      {error && (
        <div className="categories-page__status">Failed to load categories.</div>
      )}

      {sections?.map((section) => {
        const filtered = section.items.filter(
          (item) => item.name && item.count > 0 && item.name.toLowerCase().includes(filterLower),
        );
        if (filtered.length === 0) return null;

        const heroItems = filter ? [] : filtered.slice(0, HERO_COUNT);
        const chipItems = filter ? filtered : filtered.slice(HERO_COUNT);

        return (
          <section key={section.facet} className="categories-page__section">
            <h2 className="categories-page__section-title">{section.label}</h2>

            {heroItems.length > 0 && (
              <div className="categories-page__heroes">
                {heroItems.map((item) => (
                  <Link
                    key={item.name}
                    to={`/categories/${section.facet}/${encodeURIComponent(item.name)}`}
                    className="categories-page__hero-card glass-noise"
                  >
                    <span className="categories-page__hero-name">{item.name}</span>
                    <span className="categories-page__hero-count">{item.count.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            )}

            {chipItems.length > 0 && (
              <div className="categories-page__chips">
                {chipItems.map((item) => {
                  const sizeClass =
                    item.count > 5000 ? "categories-page__chip--lg" :
                    item.count < 1000 ? "categories-page__chip--sm" : "";
                  return (
                    <Link
                      key={item.name}
                      to={`/categories/${section.facet}/${encodeURIComponent(item.name)}`}
                      className={`categories-page__chip ${sizeClass}`.trim()}
                    >
                      {item.name}
                      <span className="categories-page__chip-count">
                        {item.count.toLocaleString()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

**Step 2: Add hero card and sized chip CSS**

Add to `src/App.css` in the categories section:

```css
.categories-page__filter {
  padding: 0.75rem 1.25rem;
}

.categories-page__filter-input {
  width: 100%;
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border: 1px solid var(--glass-l2-border);
  border-radius: var(--radius-pill);
  padding: 0.65rem 1rem;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.9rem;
  outline: none;
  transition: border-color var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass);
}

.categories-page__filter-input:focus {
  border-color: var(--glass-l3-border-bright);
  box-shadow: 0 0 0 2px hsla(var(--accent-h), 80%, 60%, 0.25);
}

.categories-page__filter-input::placeholder {
  color: var(--text-tertiary);
}

.categories-page__section-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
  margin: 0 0 0.85rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid hsla(var(--accent-h), 80%, 60%, 0.2);
}

/* ── Hero cards ── */
.categories-page__heroes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.categories-page__hero-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1rem;
  min-height: 100px;
  border-radius: var(--radius-card);
  background: var(--glass-l2-bg);
  backdrop-filter: blur(var(--glass-l2-blur));
  -webkit-backdrop-filter: blur(var(--glass-l2-blur));
  border: 1px solid var(--glass-l2-border);
  text-decoration: none;
  color: var(--text-primary);
  overflow: hidden;
  box-shadow: var(--glass-shadow);
  transition: transform var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass),
    border-color var(--duration-normal) var(--ease-glass);
}

.categories-page__hero-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--glass-specular);
  pointer-events: none;
  z-index: 1;
}

.categories-page__hero-card:hover {
  transform: translateY(-3px);
  border-color: var(--glass-l3-border);
  box-shadow: var(--glass-shadow-elevated), var(--accent-glow);
}

.categories-page__hero-name {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  position: relative;
  z-index: 2;
}

.categories-page__hero-count {
  font-family: var(--font-body);
  font-size: 0.7rem;
  color: var(--text-tertiary);
  position: relative;
  z-index: 2;
}

/* ── Sized chips ── */
.categories-page__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  background: var(--glass-l1-bg);
  backdrop-filter: blur(var(--glass-l1-blur));
  -webkit-backdrop-filter: blur(var(--glass-l1-blur));
  border: 1px solid var(--glass-l1-border);
  border-radius: var(--radius-pill);
  color: var(--text-primary);
  text-decoration: none;
  font-family: var(--font-body);
  font-size: 0.82rem;
  transition: background var(--duration-normal) var(--ease-glass),
    box-shadow var(--duration-normal) var(--ease-glass),
    border-color var(--duration-normal) var(--ease-glass);
}

.categories-page__chip:hover {
  background: var(--glass-l2-bg);
  border-color: var(--glass-l2-border);
  box-shadow: var(--accent-glow);
}

.categories-page__chip--lg {
  font-size: 0.92rem;
  padding: 0.5rem 1rem;
  font-weight: 600;
}

.categories-page__chip--sm {
  font-size: 0.72rem;
  padding: 0.35rem 0.7rem;
  color: var(--text-secondary);
}
```

**Step 3: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 4: Commit**

```bash
git add src/App.css src/pages/CategoriesPage.tsx
git commit -m "feat: glass hero cards and sized chips for categories browse"
```

---

## Task 8: Detail Page Glass Treatment

**Files:**
- Modify: `src/App.css` (rewrite detail-page styles)
- Modify: `src/pages/ArtworkDetailPage.tsx` (glass classes, accent HSL props)
- Modify: `src/components/ColorPalette.tsx` (glass swatch circles)

**Step 1: Rewrite detail-page CSS with glass treatment**

Replace all `.detail-page` styles in `src/App.css`. Key changes:
- Sticky glass L1 header with glass back button
- Image container with glass frame (subtle inner border)
- Glass L2 metadata cards in 2-column grid
- Glass L3 action pill buttons
- Glass color palette circles with colored glow

**Step 2: Update ArtworkDetailPage.tsx accent style**

Same pattern as ArtCard — use `--accent-h`, `--accent-s`, `--accent-l` custom properties.

**Step 3: Update ColorPalette.tsx — glass swatches**

Change swatch styles to glass circles with colored outer glow instead of filled squares.

**Step 4: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.css src/pages/ArtworkDetailPage.tsx src/components/ColorPalette.tsx
git commit -m "feat: glass detail page and luminous color palette swatches"
```

---

## Task 9: Responsive Breakpoints + Final Polish

**Files:**
- Modify: `src/App.css` (rewrite all media queries)
- Modify: `src/App.css` (scrollbar hiding, feed scroller adjustments)

**Step 1: Rewrite all media queries**

Update all `@media (min-width: 768px)`, `@media (max-width: 540px)`, and `@media (min-width: 1024px)` blocks to reference glass tokens. Key adjustments:
- Desktop: ArtCard gets centered with `max-width`, glass border, glass shadow
- Mobile: Tighter padding, smaller action buttons
- Bottom nav pill: max-width adjusts per breakpoint
- Categories heroes: 3 columns on tablet, 4 on desktop
- Hide feed scrollbar: `scrollbar-width: none`
- Feed scroller bottom padding accounts for floating pill nav height

**Step 2: Update `prefers-reduced-motion` block**

Ensure it matches the new glass class names and disables all animations while preserving glass visual effects (blur, borders, glow).

**Step 3: Verify build**

Run: `npm run lint && npx tsc -b`
Expected: PASS

**Step 4: Visual review**

Run: `npm run dev`
Check each page in browser at 3 widths: 375px (mobile), 768px (tablet), 1280px (desktop).

**Step 5: Commit**

```bash
git add src/App.css
git commit -m "feat: glass responsive breakpoints and scrollbar polish"
```

---

## Task 10: Final Build Verification + Documentation

**Files:**
- Verify: all files compile and lint clean
- Create: `docs/2026-03-22-liquid-glass-redesign.md` (feature summary doc per CLAUDE.md rules)

**Step 1: Full build verification**

Run: `npm run lint && npx tsc -b && npx vite build`
Expected: PASS — clean build, no warnings

**Step 2: Write feature summary doc**

Create `docs/2026-03-22-liquid-glass-redesign.md` summarizing what was built, files changed, and new patterns.

**Step 3: Update memory**

Update `memory/MEMORY.md` to reflect the new glass design system.

**Step 4: Final commit**

```bash
git add docs/ memory/
git commit -m "docs: liquid glass redesign feature summary and memory update"
```

---

Plan complete and saved to `docs/plans/2026-03-22-liquid-glass-implementation-plan.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for iterating on visual CSS where you'll want to check screenshots between steps.

**2. Parallel Session (separate)** — Open a new session with the executing-plans skill for batch execution with review checkpoints.

Which approach?
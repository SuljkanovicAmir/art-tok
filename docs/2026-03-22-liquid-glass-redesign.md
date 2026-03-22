# Liquid Glass Redesign — Feature Summary

**Date:** 2026-03-22
**Branch:** `feat/liquid-glass-redesign`
**Commits:** 9

## What Was Built

Complete UI redesign of ArtTok with bold liquid glass / glassmorphism aesthetic inspired by TikTok + Instagram Reels. Every surface, button, card, and panel now uses a 3-tier glass elevation system with per-artwork accent color bleeding through glass surfaces.

## Key Design Decisions

- **"Museum at Night" concept** — Glass surfaces where artwork light radiates through the UI
- **3-tier glass elevation** — L1 (nav/headers, 4% white, 24px blur), L2 (surfaces/cards, 8% white, 32px blur), L3 (buttons/interactive, 12% white, 16px blur)
- **Typography pairing** — Playfair Display (serif, display) + DM Sans (sans, body) = "high art meets modern tech"
- **Per-artwork accent** — HSL tokens (`--accent-h`, `--accent-s`, `--accent-l`) override per card, creating unique accent bleed radial gradients
- **Noise texture** — SVG fractal noise overlay (3% opacity) on glass surfaces to prevent "too clean digital" look
- **Specular highlights** — Gradient pseudo-elements simulating light catching curved glass
- **Floating pill nav** — Centered glass pill instead of edge-to-edge bar, with accent glow dot on active item
- **Staggered reveals** — Info strip children animate in with cascading delays (title → artist → description → facts)
- **Breathing glow** — Like button pulses with subtle accent glow to invite interaction

## Files Changed

### Modified
- `index.html` — Google Fonts (Playfair Display, DM Sans), updated title
- `src/index.css` — Full rewrite with glass design tokens, shared keyframes, noise texture utility
- `src/App.css` — Full rewrite of all component styles (~1500+ lines of glass CSS)
- `src/components/ArtCard.tsx` — HSL accent tokens, like button breathing class
- `src/components/BottomNav.tsx` — Floating pill, outlined/filled icon pairs, globe Browse icon
- `src/components/ColorPalette.tsx` — Glass circle swatches with colored glow
- `src/pages/FeedPage.tsx` — Glass skeleton loader, glass-noise header class
- `src/pages/SearchPage.tsx` — Staggered card animation, glass suggestion pills empty state
- `src/pages/LikedPage.tsx` — Staggered animation, glass empty state with heart icon + CTA
- `src/pages/CategoriesPage.tsx` — Full rewrite: filter input, hero cards, sized chips
- `src/pages/ArtworkDetailPage.tsx` — HSL accent tokens

### New Patterns
- Glass elevation levels (L1/L2/L3) via CSS custom properties
- `glass-noise` utility class for noise texture overlay
- HSL accent system (`--accent-h/s/l`) replacing direct color values
- `card-enter` + `glass-reveal` + `glass-breathe` + `shimmer` keyframe animations
- Skeleton loader pattern for loading states

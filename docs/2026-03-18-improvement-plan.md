# ArtTok Improvement Plan

**Date:** 2026-03-18
**Status:** Planning

## Current State

Single-page Vite + React + MobX app with vertical scroll feed of art from Harvard Art Museums API. Features: infinite scroll, like/save, share, double-tap like, artwork details expand, liked art slide-out panel. Well-built CSS with dark theme, responsive, accessible.

**Critical issue:** Harvard API key hardcoded in `src/services/ArtImagesService.ts` — must move to `.env`.

## Tier 1 — Quick Wins (Make It Publishable)

| # | Feature | What | Priority |
|---|---------|------|----------|
| 1 | **Env var for API key** | Move hardcoded key to `VITE_HARVARD_API_KEY` in `.env` | P0 — security |
| 2 | **React Router** | Add routes: `/`, `/liked`, `/artwork/:id`, `/search` | P0 — multi-page |
| 3 | **Artwork detail page** | Full-screen view with all metadata, high-res zoom, related works | P0 — core UX |
| 4 | **Search** | Search Harvard API by keyword, artist, culture, medium | P1 — discoverability |
| 5 | **Category filters** | Browse by culture, classification, century, medium | P1 — navigation |
| 6 | **Deploy** | Vercel or Netlify with custom domain | P1 — go live |

## Tier 2 — Differentiators (Make It Unique)

| # | Feature | What | Why |
|---|---------|------|-----|
| 1 | **Multi-source feeds** | Add Met Museum API + Art Institute of Chicago API | 10x more content — all free APIs |
| 2 | **AI art descriptions** | Generate accessible/fun descriptions for artworks | Educational + engagement |
| 3 | **"Art of the Day"** | Curated daily featured piece | Retention hook |
| 4 | **Collections/boards** | User-created themed collections | Pinterest-like engagement |
| 5 | **Art quiz/trivia** | "Guess the artist/period/style" from image | Gamification |
| 6 | **Color palette extraction** | Show dominant colors from each artwork | Visual + design tool appeal |
| 7 | **Mood-based discovery** | "Show me calming art" / "Show me bold art" | AI-powered discovery |

## Tier 3 — Social & Growth

| # | Feature | What | Why |
|---|---------|------|-----|
| 1 | **User accounts** | Firebase auth for persistent likes | Cross-device sync |
| 2 | **Comments/reactions** | React to artworks with emoji or short comments | Social engagement |
| 3 | **Share cards** | Generate shareable image cards for social media | Viral growth |
| 4 | **PWA** | Installable on mobile with offline support | App-like experience |
| 5 | **Artist profiles** | Aggregate works by artist across museums | Deep exploration |

## Tech Recommendations

- **Consider Next.js migration** — SSR/SEO/routing for free (already used in Cineboxd)
- **Replace MobX with Zustand** — lighter, consistent with Cineboxd stack
- **Keep the CSS approach** — hand-written CSS is polished, no framework needed
- **Add Vitest** for unit/integration testing

## Museum APIs Reference

### Harvard Art Museums
- Endpoint: `https://api.harvardartmuseums.org/object`
- Auth: API key (free, register at harvardartmuseums.org)
- Rate limit: 2,500 requests/day
- Docs: https://github.com/harvardartmuseums/api-docs

### Metropolitan Museum of Art
- Endpoint: `https://collectionapi.metmuseum.org/public/collection/v1`
- Auth: None required (fully open)
- 470,000+ objects
- Docs: https://metmuseum.github.io

### Art Institute of Chicago
- Endpoint: `https://api.artic.edu/api/v1`
- Auth: None required (fully open)
- 100,000+ artworks
- Docs: https://api.artic.edu/docs

## Files Changed

- `CLAUDE.md` — created project configuration
- `docs/2026-03-18-improvement-plan.md` — this file

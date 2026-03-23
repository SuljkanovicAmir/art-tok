# Instagram Story Card Sharing

**Date:** 2026-03-23

## What Was Built

Share button on ArtCard now generates a Polaroid-style 1080x1920 story card image instead of just sharing a link. The card features a white background with warm abstract color shapes (organic blobs in 5 palettes: sunset coral, terracotta blush, amber honey, dusty rose, warm ochre), the artwork at its natural aspect ratio with a subtle shadow, editorial serif typography (title + artist), and ArtTok branding matching the header font (Playfair Display, italic 800).

## Files Changed

- `src/utils/storyCardRenderer.ts` — **new** — canvas-based story card renderer with deterministic PRNG for consistent backgrounds per artwork, blob-based image loading to avoid CORS tainting
- `src/components/ArtCard.tsx` — updated share handler: generates story card → native file share on mobile → download fallback on desktop → link share fallback if canvas fails
- `docs/plans/2026-03-23-story-card-design.md` — design doc

## Key Decisions

- **Blob-first image loading:** Museum APIs don't send CORS headers, so `fetch()` → blob → object URL avoids canvas tainting entirely. `crossOrigin="anonymous"` is only a fallback.
- **Deterministic PRNG (mulberry32):** Each artwork always gets the same warm color background based on `art.id`, so re-sharing produces identical cards.
- **No dependencies:** Pure canvas API, no html2canvas or dom-to-image libraries.
- **Graceful degradation:** Story card → native share sheet → download → link share → clipboard copy.

# Instagram Story Card — Editorial Design

**Date:** 2026-03-23
**Status:** Approved

## Overview

Replace the current Share button behavior (native share / copy link) with a Vogue-style editorial story card generator. Produces a 1080x1920 PNG image suitable for Instagram Stories.

## Design Decisions

- **Style:** Editorial/Vogue — warm cream background, serif typography, generous whitespace
- **Metadata:** Minimal — artwork image + title + artist name + subtle ArtTok branding
- **Layout:** Centered with margin — artwork floated in upper portion with padding, text below
- **Trigger:** Replaces existing Share button — generates image then opens native share sheet

## Canvas Layout (1080 x 1920)

- **Background:** `#F5F0EB` (warm cream, art paper feel)
- **Artwork:** 80px side margins (920px max width), max 1200px tall, centered horizontally, positioned in upper portion. Maintains aspect ratio. Subtle drop shadow `0 4px 24px rgba(0,0,0,0.12)`
- **Thin rule:** 1px, `#d4cdc4`, ~200px wide, centered — editorial divider
- **Title:** Georgia/serif, 42px, `#1a1a1a`, centered, max 2 lines
- **Artist:** System sans-serif, 28px, `#888`, centered, single line
- **Branding:** "ARTTOK" at bottom, 18px, letterspacing 0.3em, `#aaa`

## Technical Approach

**Renderer:** HTML Canvas (zero dependencies)

### Flow
1. User taps Share on ArtCard
2. Load artwork image with `crossOrigin = "anonymous"`
3. Draw card on offscreen 1080x1920 canvas
4. Export as PNG blob via `canvas.toBlob()`
5. Mobile: `navigator.share({ files: [File] })`
6. Desktop fallback: trigger PNG download

### CORS Fallback
1. Try `crossOrigin = "anonymous"` on Image
2. If fails, `fetch()` image as blob → object URL → draw
3. If all fails, fall back to current link-share behavior

## Files

- `src/utils/storyCardRenderer.ts` — pure function: `(ArtPiece, HTMLImageElement) => Promise<Blob>`
- `src/components/ArtCard.tsx` — updated `handleShare`

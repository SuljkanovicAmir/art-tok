# Pure Image Feed Posts (2026-04-16)

Replaced the watercolor card renderer for Instagram **feed posts** with a
strict aspect-ratio filter that uploads the raw painting. Stories and reels
still use the existing watercolor card renderer.

## Decision

- **No background, no padding, no text, no branding on posts.**
- If source aspect is within Instagram's feed range (0.8 → 1.91), upload
  native — scaled to 1080 wide, re-encoded as JPEG (IG rejects non-JPEG).
- If outside the range, **reject the artwork and retry** with a new one.
  No cropping, no pillarboxing, no letterboxing — the user explicitly chose
  a strict filter over edge-sampled padding fallbacks.

## Why this shape

Research (Meta Graph API docs, buffer.com, influencer marketing hub, social
media benchmark reports, 2026):
- IG feed: aspect must be in [4:5 = 0.8, 1.91:1]; anything outside fails
  container creation.
- JPEG-only; PNG and WebP are rejected.
- 1080px wide is the canonical upload width; IG re-encodes larger images.
- The 2025 grid preview switched from square to 3:4 (1080×1440), but feed
  posts still must be 4:5 at tallest — 3:4 is the preview crop only.
- Static posts get ~2.35× less reach than reels in 2026, but art accounts
  on IG still rely on them for permanence + grid aesthetic. Keeping reels in
  the 10% slot of `MODE_CYCLE` compensates.

## Files

| File | Change |
|---|---|
| `lib/image-filter.mjs` | **new** — `prepareFeedImage(buf\|url)` returns `{ buffer, width, height, aspect }` or throws `AspectOutOfRangeError`. Resizes to 1080 wide, encodes JPEG @ q0.92. |
| `post.mjs` | Post branch now calls `prepareFeedImage` instead of `renderPostCard`. Retry loop increased from 3 → 6 for post mode so aspect rejections don't exhaust fetch attempts. Rejection logs as `Rejected "<title>" — Aspect X.XX…`. Dry-run now writes `.jpg` for post mode (was `.png`). Header comment updated. |
| `lib/render.mjs` | Removed `renderPostCard`, `CARD_PRESETS.post`, and `POST_W`/`POST_H` constants. `renderStoryCard` and `renderReelCard` untouched. |
| `package.json` | Test script now globs `tests/*.test.mjs` instead of a single file. |
| `tests/image-filter.test.mjs` | **new** — 10 tests covering accept/reject/scale behavior with synthesized canvas JPEGs. |

## Flow

```
fetchRandomArtwork() → art (with imageBuffer from probeImage)
    ↓
mode === "post" ?
    ↓ yes                                           ↓ no (story/reel)
prepareFeedImage(imageBuffer)                  renderStoryCard/renderReelCard
    ↓                                               ↓
aspect in [0.8, 1.91]?                         (unchanged watercolor card)
    ↓ yes              ↓ no
resize → JPEG    throw AspectOutOfRangeError
                       ↓
                 retry loop fetches next art
```

## Observed behavior (dry-run, Harvard cache)

The first 3 cached Harvard portraits were all taller than 4:5 (aspects 0.70,
0.72, 0.71) — rejected. The 4th was a 4:5 portrait — accepted.

```
Cache hit: "Portrait of a Young Man" by Denman Waldo Ross
Preparing feed image...
Rejected — Aspect 0.713 (1600x2245) outside IG feed range [0.8, 1.91]
...
Cache hit: "John Still Winthrop (1720-1776)"
Image prepared: 1080x1350 (aspect 0.80), 226 KB
```

## Follow-ups (not done yet)

- **Curator could pre-filter by aspect.** `scripts/instagram-poster/curator.mjs`
  pre-caches Harvard/AIC paintings; it could probe each image's aspect at
  cache time and skip out-of-range ones so the post-time retry loop hits
  acceptable pieces on the first try. Worth doing if rejection rate stays
  high (~30% of Harvard portraits are taller than 4:5 based on this run).
- **`cardSizeKB` in quality log** now reflects pure JPEG size (much smaller
  than watercolor cards; 226 KB vs 400+ KB). Historical comparisons across
  the cutover date will look anomalous.
- **Stories auto-published after posts** (via `publishAutoStory`) still use
  the watercolor card renderer. Consistent with "keep stories/reels as-is"
  decision.

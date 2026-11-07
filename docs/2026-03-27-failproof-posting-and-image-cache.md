# Fail-proof Posting & Dropbox Image Cache

**Date:** 2026-03-27

## Problem

GitHub Actions IPs are blocked by Harvard (`ids.lib.harvard.edu` → 429) and AIC (`www.artic.edu/iiif` → 403 via Cloudflare challenge). Only Met Museum images work from CI. The old retry logic never switched sources on image 429, causing 8/10 posts to fail.

## Changes

### 1. Fail-proof source fallback (PR #22)

- `probeImage()` in `lib/fetch.mjs` validates images before returning from art-fetchers
- On 429/403, source is blacklisted and next source tried immediately
- Outer retry in `post.mjs` simplified to 3 attempts (safety net only)
- 10 tests covering all failure scenarios

### 2. Harvard `ids.lib` direct URLs

All Harvard image URLs now use `images[0].idsid` to construct `ids.lib.harvard.edu` URLs directly, bypassing the rate-limited `nrs.harvard.edu` redirect layer. Still blocked from CI, but works locally.

### 3. Dropbox image cache (PR #23)

- `curator.mjs` — run locally to pre-cache ~200 paintings on Dropbox
  - `--status` — cache stats
  - `--exclude source:id` — skip artwork
  - `--cleanup` — delete Dropbox files for posted entries
- `lib/cache.mjs` — cache read/write/filter helpers
- `image-cache.json` — artwork metadata + Dropbox URLs + seasonal tags
- Poster tries cache first for Harvard/AIC, falls back to Met

### 4. IIIF image quality bump

All IIIF requests bumped from 843px to 1600px wide. Cards render at 1080px, so images are now downscaled (sharp) instead of upscaled (blurry).

### 5. Paintings-only filter

Unified `isPainting(classification, medium)` function checks both classification ("Paintings") and medium (oil, acrylic, tempera, watercolor, gouache, fresco, encaustic, pastel). Applied to all fetchers — random and seasonal.

### 6. Medium diversity

Curator enforces 50% oil painting cap. When cap is hit, only non-oil paintings (watercolor, tempera, pastel, etc.) are added.

### 7. Seasonal tags

Curator scans artwork title/description/medium against seasonal keywords and stores matches as `tags[]`. Poster uses tags to prefer seasonally-relevant cached art during season windows.

### 8. Page shuffling + random sort

Curator pre-shuffles API page numbers per source so each fetch hits a unique page. Harvard uses `sort=random` instead of `totalpageviews` to avoid portrait-heavy bias (their most-viewed paintings are overwhelmingly 18th-19th century male portraits). AIC doesn't support random sort — page shuffling provides variety.

## Post flow (after changes)

```
Poster picks source by rotation
├── Met? → fetch image directly (works from CI)
├── Harvard/AIC? → check image-cache.json
│   ├── Cache hit? → fetch from Dropbox URL → render → post
│   ├── Cache empty? → try live fetch (works locally, blocked in CI)
│   └── Live fetch blocked? → fall back to Met
└── All fail? → retry 3x, then fail (extremely rare)
```

## Curator workflow

```bash
# Run locally ~monthly
cd scripts/instagram-poster
node curator.mjs              # fetch 200 paintings (100 Harvard + 100 AIC)
node curator.mjs --status     # check cache stats
node curator.mjs --exclude harvard:12345  # skip ugly art
git add image-cache.json && git commit -m "chore: update image cache" && git push
```

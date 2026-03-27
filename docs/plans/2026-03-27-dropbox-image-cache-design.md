# Dropbox Image Cache for Harvard/AIC

**Date:** 2026-03-27
**Status:** Approved
**Problem:** Harvard and AIC image servers block GitHub Actions IPs (429/403). Met works fine. Need all 3 sources for variety.

## Solution

Pre-cache ~200 Harvard/AIC artwork images on Dropbox via a local curator script. GitHub Actions poster reads from cache for Harvard/AIC, fetches Met directly.

## Architecture

```
curator.mjs (your machine, ~monthly)     post.mjs (GitHub Actions, 4x/day)
────────────────────────────────         ────────────────────────────────
Fetch 100 Harvard + 100 AIC artworks     Pick source by rotation
Download images (local IP works)         ├─ Met? → fetch image directly
Upload to Dropbox /arttok-cache/         ├─ Harvard/AIC? → pick from image-cache.json
Write entry to image-cache.json          │   fetch image from Dropbox URL
  immediately after each upload          │   render card, post to IG
Commit + push when done                  └─ Cache empty? → fall back to Met
```

## `image-cache.json` format

```json
[
  {
    "source": "harvard",
    "id": 299843,
    "title": "Self-Portrait Dedicated to Paul Gauguin",
    "artist": "Vincent van Gogh",
    "imageUrl": "https://www.dropbox.com/scl/fi/.../harvard-299843.jpg?raw=1",
    "dropboxPath": "/arttok-cache/harvard-299843.jpg",
    "culture": "Dutch",
    "dated": "1888",
    "classification": "Paintings",
    "medium": "Oil on canvas",
    "description": "",
    "url": "https://harvardartmuseums.org/collections/object/299843",
    "museumName": "Harvard Art Museums",
    "cachedAt": "2026-03-27",
    "skip": false
  }
]
```

## Curator CLI

```bash
node curator.mjs                          # fetch 200 (100 Harvard + 100 AIC), upload to Dropbox
node curator.mjs --exclude harvard:299843  # set skip:true on entry
node curator.mjs --status                  # cache stats: total, available, skipped, posted
node curator.mjs --cleanup                 # delete Dropbox files for already-posted entries
```

### Curator behavior

- Writes each entry to `image-cache.json` immediately after successful upload (not batched)
- Skips artworks already in cache (idempotent re-runs)
- On crash/partial run: safe to re-run, picks up where it left off
- Retries failed metadata/image fetches, logs failures, continues with what it got

## Poster changes (`art-fetchers.mjs`)

`fetchRandomArtwork` gains cache awareness:
1. Source rotation picks Harvard or AIC
2. Read `image-cache.json`, filter out `skip: true` and already-posted entries
3. Pick random entry, fetch image from Dropbox URL via `probeImage`
4. Return art object with `imageBuffer`
5. If cache empty or Dropbox fetch fails → fall back to Met

## Quality control

Two ways to exclude artworks:
1. **CLI:** `node curator.mjs --exclude harvard:299843`
2. **Manual:** edit `image-cache.json`, set `"skip": true`

## Dropbox image lifecycle

- Cached images are NOT deleted by the poster after use
- 200 images x ~200KB = ~40MB (2% of Dropbox free 2GB)
- Cleanup is manual: `node curator.mjs --cleanup` removes files for posted entries
- Shared links on Dropbox free don't expire

## Fail-proof chain

| Scenario | What happens |
|----------|-------------|
| Harvard/AIC picked, cache has entries | Use cached Dropbox image |
| Harvard/AIC picked, cache empty | Fall back to Met |
| Cached Dropbox URL dead/expired | Blacklist entry, try next, then Met |
| Met image fails | Retry different Met artwork (existing logic) |
| Curator crashes at image 87/200 | Safe to re-run, skips already-cached |
| Cache runs low (<20 entries) | Poster logs warning each run |
| Two GH Actions runs overlap | posted-history dedup prevents duplicates |

## Files

| File | Type | Description |
|------|------|-------------|
| `scripts/instagram-poster/curator.mjs` | New | CLI: fetch, upload, exclude, status, cleanup |
| `scripts/instagram-poster/image-cache.json` | New | Artwork metadata + Dropbox URLs |
| `scripts/instagram-poster/lib/cache.mjs` | New | Cache read/write/filter helpers |
| `scripts/instagram-poster/lib/art-fetchers.mjs` | Modify | Read cache for Harvard/AIC picks |

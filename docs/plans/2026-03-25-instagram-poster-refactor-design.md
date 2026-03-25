# Instagram Poster Refactor — Design

**Date:** 2026-03-25
**Goal:** Split the 1081-line `post.mjs` monolith into focused modules under `lib/`, share common utilities with `analytics.mjs`.

## File Structure

```
scripts/instagram-poster/
├── lib/
│   ├── fetch.mjs             # fetchJson (with retries), pick(), IG_GRAPH constant
│   ├── history.mjs           # loadHistoryData, saveHistoryData, artKey, SEASONAL_COOLDOWN_RESET
│   ├── art-fetchers.mjs      # Harvard/Met/AIC configs, random/specific/seasonal fetchers
│   ├── dropbox.mjs           # getDropboxToken, uploadToDropbox, uploadImage, deleteFromDropbox
│   ├── token-refresh.mjs     # refreshTokenIfNeeded (takes token, returns refreshed token)
│   ├── instagram-api.mjs     # publishToInstagram, waitForContainer, postFirstComment, publishReel, publishAutoStory
│   ├── captions.mjs          # buildCaption, buildHashtags, buildAltText, hashtag pools
│   └── render.mjs            # moved from ./render.mjs (watercolor card renderer, unchanged internals)
├── post.mjs                  # main() orchestration + CLI args + mode cycle (~120 lines)
├── analytics.mjs             # imports fetchJson + IG_GRAPH from lib/fetch.mjs
├── audio/
├── posted-history.json
└── package.json
```

## Module Dependency Graph

```
post.mjs
  ├── lib/history.mjs
  ├── lib/art-fetchers.mjs ── lib/fetch.mjs
  ├── lib/dropbox.mjs
  ├── lib/token-refresh.mjs ── lib/fetch.mjs
  ├── lib/instagram-api.mjs ── lib/fetch.mjs, lib/dropbox.mjs, lib/render.mjs
  ├── lib/captions.mjs
  └── lib/render.mjs

analytics.mjs
  └── lib/fetch.mjs
```

## Module Exports

| Module | Exports | ~Lines |
|--------|---------|--------|
| fetch.mjs | `fetchJson`, `pick`, `IG_GRAPH` | 25 |
| history.mjs | `loadHistoryData`, `saveHistoryData`, `artKey`, `SEASONAL_COOLDOWN_RESET` | 45 |
| art-fetchers.mjs | `fetchHarvardRandom`, `fetchMetRandom`, `fetchAicRandom`, `fetchSpecificArtwork`, `fetchRandomArtwork`, `fetchSeasonalArtwork`, `getActiveSeason`, `shouldPostSeasonal` | 330 |
| dropbox.mjs | `getDropboxToken`, `uploadToDropbox`, `uploadImage`, `deleteFromDropbox` | 100 |
| token-refresh.mjs | `refreshTokenIfNeeded` | 60 |
| instagram-api.mjs | `publishToInstagram`, `waitForContainer`, `postFirstComment`, `publishReel`, `publishAutoStory` | 170 |
| captions.mjs | `buildCaption`, `buildHashtags`, `buildAltText` | 100 |
| render.mjs | `renderPostCard`, `renderStoryCard` | 495 |
| post.mjs (entry) | `main()`, CLI parsing, mode cycle | 120 |
| analytics.mjs (entry) | unchanged except shared imports | 175 |

## Design Decisions

### Mutable token handling
`INSTAGRAM_ACCESS_TOKEN` is mutable (token refresh updates it mid-run). Instead of shared mutable state, functions that need the token receive it as a parameter. `refreshTokenIfNeeded(token, appId, appSecret, pageId)` returns the (possibly refreshed) token. `post.mjs` holds the single mutable binding.

### render.mjs
Moves to `lib/` as-is. No internal changes — already well-structured after the card preset refactor.

### analytics.mjs
Only gains shared imports (`fetchJson`, `IG_GRAPH` from `lib/fetch.mjs`). Removes its local duplicate `fetchJson`. Everything else stays.

### Env vars
Each module reads its own env vars at import time (same pattern as current code), except `INSTAGRAM_ACCESS_TOKEN` which is passed in.

### GitHub Actions
No workflow changes needed — `working-directory: scripts/instagram-poster` and `node post.mjs` remain the same.

### What stays out of scope
- No new abstractions or class hierarchies
- No changes to render logic, art fetcher logic, or publishing logic
- No changes to analytics report format
- No new dependencies

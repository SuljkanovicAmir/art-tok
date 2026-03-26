# Fail-proof Source Fallback Design

**Date:** 2026-03-26
**Status:** Approved
**Problem:** 8/10 recent IG auto-posts failed because Harvard image server (nrs.harvard.edu) returned 429, and the retry logic never switched to Met/AIC.

## Root Cause

The outer retry loop in `post.mjs` catches render errors and retries with a new artwork, but:
1. `failedSources` only triggers on HTTP 403, not 429
2. `fetchRandomArtwork` uses time-based rotation, so all rounds start with the same source
3. Image download happens inside `renderCard()` — too late to switch sources

Result: 5 retries × same rate-limited Harvard server = guaranteed failure.

## Solution: Two-tier retry with source rotation

### Architecture

```
Outer retry (3 attempts) — catches unexpected errors (canvas crash, etc.)
  └─ fetchRandomArtwork — tries all sources internally
       └─ for each source (time-rotated, excluding blacklisted):
            ├─ fetch metadata
            ├─ probeImage(imageUrl) → Buffer
            ├─ on 429/403: blacklist source, try next
            └─ return art with imageBuffer attached
```

### Component Changes

#### 1. `fetch.mjs` — new `probeImage(url, retries=2)`

Lightweight image fetch that returns a Buffer or throws with a typed error. Uses referrer-spoofing for AIC (same headers currently in `render.mjs`). Retries on 429 with 2s/4s exponential backoff. On persistent 429/403, throws an error with `.statusCode` property so callers can distinguish rate-limit from other failures.

#### 2. `art-fetchers.mjs` — source-aware image validation

`fetchRandomArtwork` and `fetchSeasonalArtwork` now call `probeImage` after fetching metadata. On image 429/403:
- Add source to internal `failedImageSources` set
- Log: `"Harvard images rate-limited (429) — switching to Met"`
- Continue to next source **in the same round** (no wasted outer retry)
- Return `art` with `art.imageBuffer` (Buffer) attached

#### 3. `render.mjs` — accept pre-fetched buffer

`renderCard` checks `art.imageBuffer` first. If present, calls `loadImage(buffer)` directly — no network request. Falls back to `fetchImage(url)` for dry-run/specific-art paths.

#### 4. `post.mjs` — simplified outer retry

Outer loop reduced to 3 attempts (safety net for canvas/ffmpeg crashes). The 403-only `failedSources` tracking removed — now handled internally by art-fetchers.

### Error Flow

| Scenario | Behavior |
|----------|----------|
| Harvard images 429 | Blacklisted mid-round, tries Met, then AIC |
| AIC images 403 | Blacklisted, tries remaining sources |
| Harvard metadata API down | Existing try/catch, moves to next source |
| All 3 image servers down | All blacklisted → "All art sources failed" after exhausting rounds |
| Met returns duplicate | Skipped, tries AIC, then next round |
| Render/canvas crash | Caught by outer retry, re-fetches fresh artwork |
| Dropbox/IG API failure | Not retried (separate concern, fails fast) |

### Test Cases

File: `scripts/instagram-poster/tests/fallback.test.mjs`

| # | Test | Setup | Expected |
|---|------|-------|----------|
| 1 | Harvard 429 → Met succeeds | Harvard probe 429, Met OK | Posts Met, logs rate-limit |
| 2 | Harvard 429 → Met 429 → AIC succeeds | Two sources 429, AIC OK | Posts AIC |
| 3 | All 3 sources image 429 | All probes 429 | Throws "All art sources failed" |
| 4 | AIC 403 → Harvard succeeds | AIC probe 403, Harvard OK | Posts Harvard |
| 5 | First artwork duplicate, second fresh | First in history set | Skips, posts second |
| 6 | Metadata fails, image works on next | Harvard API 500, Met OK | Posts Met |
| 7 | Happy path | All healthy | Posts from time-rotated source, imageBuffer attached |
| 8 | Seasonal: primary 429, fallback works | Seasonal Harvard 429, Met OK | Posts seasonal Met |
| 9 | Render crash triggers outer retry | Canvas throws, second attempt OK | Recovers on retry 2 |
| 10 | HARVARD_API_KEY missing | Env unset | Skips Harvard, uses Met/AIC |

### Files Changed

| File | Change |
|------|--------|
| `scripts/instagram-poster/lib/fetch.mjs` | Add `probeImage()` with referrer headers |
| `scripts/instagram-poster/lib/art-fetchers.mjs` | Image validation + source blacklisting in fetch functions |
| `scripts/instagram-poster/lib/render.mjs` | Accept pre-fetched buffer, skip network if available |
| `scripts/instagram-poster/post.mjs` | Simplify outer retry (3 attempts), remove old failedSources logic |
| `scripts/instagram-poster/tests/fallback.test.mjs` | 10 test cases |

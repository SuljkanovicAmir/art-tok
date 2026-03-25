# Fix: Duplicate Artworks in Homepage Feed

**Date:** 2026-03-23
**Branch:** `fix/feed-duplicate-art`
**PR:** #8

## What was built

Fixed three root causes of duplicate artworks appearing in the homepage feed:
Harvard's `sort: "random"` reshuffled results on every API call causing page overlap;
Met adapter re-fetched the full ID list on each page causing unstable boundaries;
and `rankAndMix` discarded 60% of fetched items that could reappear on later pages.

## Files changed

- `src/services/HarvardAdapter.ts` — `sort: "random"` → `sort: "totalpageviews", sortorder: "desc"`
- `src/services/MetAdapter.ts` — added `cachedHighlightIds` field, cached search IDs on first call
- `src/hooks/useFeedQuery.ts` — aligned `FETCH_SIZE` and `DISPLAY_SIZE` to 12 (was 20/8)

## Key decisions

- Chose `totalpageviews` sort for Harvard because it surfaces popular art first (good default feed) while being fully deterministic for stable pagination.
- Met ID caching is instance-level (lives for the adapter lifetime / page session) — no localStorage needed since the Met search endpoint is fast and IDs rarely change.
- Kept `flattenFeedPages` Set-based dedup as a safety net even though upstream fixes should eliminate duplicates at the source.

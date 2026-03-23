# Multi-Source Art APIs + Rich Metadata

**Date:** 2026-03-23
**Branch:** feat/liquid-glass-redesign
**Commit:** 51ed57a

## What was built

Added Met Museum and Art Institute of Chicago as data sources alongside Harvard Art Museums.
Feed and search aggregate from all 3 sources in parallel with round-robin interleaving.
Expanded ArtPiece with 15 new metadata fields and updated the detail page UI to display them.

## New files
- `src/services/MetAdapter.ts` — Met Museum API adapter (two-step: search IDs then batch-fetch objects)
- `src/services/ArticAdapter.ts` — Art Institute of Chicago adapter (GET search, IIIF images)
- `src/utils/artKey.ts` — composite key utilities (artKey, parseArtKey, sourceName, sourceUrl)

## Modified files
- `src/types/art.ts` — expanded ArtPiece (15 new fields) + HarvardArtRecord (gallery, tags, colors, dates)
- `src/services/ArtSourceRegistry.ts` — multi-source aggregation with Promise.allSettled + round-robin interleave
- `src/services/registry.ts` — register Met + AIC adapters
- `src/services/HarvardAdapter.ts` — request 9 additional API fields
- `src/utils/mapArtRecord.ts` — map new Harvard fields + hexToHsl color conversion
- `src/utils/likedArtStorage.ts` — migrated from Set<number> to Set<string> composite keys
- `src/hooks/useLikedArt.ts` — accepts string artKey instead of numeric id
- `src/hooks/useLikedArtCollection.ts` — uses artKey for piece lookup
- `src/hooks/useLikedArtQuery.ts` — parseArtKey to route fetchById to correct source
- `src/hooks/useArtworkQuery.ts` — accepts optional source parameter
- `src/hooks/useFeedQuery.ts` — composite key dedup
- `src/App.tsx` — route changed to /artwork/:source/:id
- `src/App.css` — artist-bio, tags, gallery grid, public domain badge styles
- `src/components/ArtCard.tsx` — lqip blur-up, composite links/keys
- `src/pages/ArtworkDetailPage.tsx` — artist bio, tags, additional images, gallery info, dynamic museum link
- `src/pages/FeedPage.tsx` — composite React keys
- `src/pages/LikedPage.tsx` — composite keys and links
- `src/pages/SearchPage.tsx` — composite keys and links

## Key patterns
- **Composite keys (source:id)** prevent cross-source ID collisions in React keys, storage, routes, query cache
- **Legacy migration** auto-converts numeric liked-art IDs to "harvard:{id}" on first read
- **Met two-step fetch** uses BATCH_SIZE (8) as effective page size to avoid skipping IDs
- **AIC uses GET only** — POST with Elasticsearch DSL causes CORS preflight issues
- **AIC provides dominantColor and lqip natively** — no canvas extraction needed
- **Harvard colors need hex-to-HSL conversion** via local helper in mapArtRecord
- **Promise.allSettled** ensures feed works even if one source is down

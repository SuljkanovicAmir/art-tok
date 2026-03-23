# ArtSource Adapter Pattern

**Date:** 2026-03-19
**Commit:** refactor: introduce ArtSource adapter pattern with HarvardAdapter and registry

## Summary

Introduced an adapter pattern for multi-source API federation. All API calls now go through an `ArtSourceRegistry` that dispatches to source-specific adapters, starting with `HarvardAdapter` for the Harvard Art Museums API.

## Files Created

- `src/services/types.ts` — `ArtSource` interface, feed/search options, result types, `FacetItem`
- `src/services/HarvardAdapter.ts` — implements `ArtSource` for Harvard API (ported from `ArtImagesService`)
- `src/services/ArtSourceRegistry.ts` — manages multiple sources, dispatches to adapters
- `src/services/registry.ts` — singleton registry instance with Harvard registered

## Files Modified

- `src/types/art.ts` — added `ArtSourceId` type and `source` field to `ArtPiece`
- `src/utils/mapArtRecord.ts` — adds `source: 'harvard'` to mapped objects
- `src/hooks/useFeedQuery.ts` — uses `artRegistry.fetchFeed()` instead of `ArtImagesService`
- `src/hooks/useArtworkQuery.ts` — uses `artRegistry.fetchById()` instead of `ArtImagesService`
- `src/hooks/useSearchQuery.ts` — uses `artRegistry.search()` instead of `ArtImagesService`
- `src/pages/LikedPage.tsx` — uses `artRegistry.fetchById()`, removes `mapArtRecord` step
- `src/pages/CategoriesPage.tsx` — uses `artRegistry.fetchFacet()`
- `src/utils/__tests__/mapArtRecord.test.ts` — updated expected results with `source: 'harvard'`

## Files Deleted

- `src/services/ArtImagesService.ts` — replaced by `HarvardAdapter`

## New Patterns

- **Adapter pattern:** Each museum API gets its own adapter implementing the `ArtSource` interface
- **Registry singleton:** `artRegistry` from `src/services/registry.ts` is the single entry point for all data fetching
- **Source tracking:** Every `ArtPiece` now carries a `source` field identifying which museum it came from
- **Adding new sources:** Create a new adapter class implementing `ArtSource`, register it in `registry.ts`

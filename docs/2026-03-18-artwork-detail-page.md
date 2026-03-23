# Artwork Detail Page Implementation

**Date:** 2026-03-18

## Summary

Implemented the full artwork detail page (`/artwork/:id`) replacing the previous stub. Users can now click an artwork title in the feed to navigate to a dedicated detail view with full metadata, large image, and actions.

## Files Changed

- `src/pages/ArtworkDetailPage.tsx` — Full implementation with loading/error states, image zoom, metadata grid, like/share actions
- `src/components/ArtCard.tsx` — Title now links to detail page via `react-router-dom` `Link`
- `src/App.css` — Added detail page styles (`.detail-page__*`) and `.art-card__title-link`

## New Patterns

- **ArtworkDetailContent** extracted as a separate component to use hooks (`useLikedArt`) only after artwork data is loaded
- `mapArtRecord` reused from utils to convert raw Harvard API response to `ArtPiece`
- `ArtImagesService.fetchArtworkById()` returns a single `HarvardArtRecord` (not wrapped in records array)
- Per-artwork accent color derived from `art.id % 360` hue, consistent with ArtCard
- Metadata grid uses CSS `display: contents` on wrapper divs for proper `dt`/`dd` grid alignment

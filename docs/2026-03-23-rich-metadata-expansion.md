# Rich Metadata Expansion — All 3 Adapters

**Date:** 2026-03-23
**Branch:** `feat/liquid-glass-redesign`

## Summary

Expanded all three art source adapters (Harvard, Met Museum, Art Institute of Chicago) to map 10+ additional metadata fields from each API, and updated the detail page UI to display them.

## ArtPiece New Fields

All optional, so existing code continues to work:

| Field | Type | Harvard | Met | AIC |
|-------|------|---------|-----|-----|
| `artistBio` | string | - | `artistDisplayBio` | - |
| `tags` | string[] | `tags[].name` | `tags[].term` | `subject_titles` |
| `additionalImages` | string[] | `images[].baseimageurl` | `additionalImages` | `alt_image_ids` → IIIF |
| `isPublicDomain` | boolean | - | `isPublicDomain` | `is_public_domain` |
| `department` | string | `department` | `department` | `department_title` |
| `galleryInfo` | string | `gallery.name` | `"Gallery " + GalleryNumber` | `gallery_title` |
| `isOnView` | boolean | `gallery.gallerynumber` truthy | `GalleryNumber` truthy | `is_on_view` |
| `dominantColor` | {h,s,l} | hex→HSL from `colors[0]` | - | `color` (h,s,l native) |
| `lqip` | string | - | - | `thumbnail.lqip` |
| `shortDescription` | string | `labeltext` | - | `short_description` (HTML-stripped) |
| `styleTitle` | string | `style` | - | `style_title` |
| `creditLine` | string | `creditline` | `creditLine` | `credit_line` |
| `dateStart` | number | `datebegin` | `objectBeginDate` | `date_start` |
| `dateEnd` | number | `dateend` | `objectEndDate` | `date_end` |

## Files Changed

### Types
- `src/types/art.ts` — Added 14 optional fields to `ArtPiece`

### Adapters
- `src/services/HarvardAdapter.ts` — Added 9 new API fields to FIELDS array
- `src/utils/mapArtRecord.ts` — Added `hexToHsl` + `parseDominantColor` helpers, mapped 11 new fields
- `src/services/MetAdapter.ts` — Expanded `MetObject` interface (8 fields), mapped 10 new fields
- `src/services/ArticAdapter.ts` — Expanded `ArticArtwork` interface (14 fields), mapped 14 new fields

### UI
- `src/pages/ArtworkDetailPage.tsx` — Artist bio, Style/Department/Credit/Location meta fields, tags pills, additional images gallery (3-col grid), public domain badge
- `src/components/ArtCard.tsx` — LQIP blur-up placeholder via inline `backgroundImage`
- `src/App.css` — 6 new CSS rules: artist-bio, tags/tag pills, gallery grid, public domain badge

## Patterns

- Harvard returns colors as hex → converted to HSL via local `hexToHsl` helper
- AIC returns `color` natively as {h,s,l} — no conversion needed
- Met has no color data
- AIC `short_description` contains HTML tags → stripped with regex
- Empty arrays for tags/additionalImages coerced to `undefined`
- All new fields are optional — zero breaking changes

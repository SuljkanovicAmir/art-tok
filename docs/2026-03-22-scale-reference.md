# Scale Reference Feature

**Date:** 2026-03-22
**Phase:** 1 — ArtTok Feature Expansion

## What Was Built

A "Scale Reference" visualization on the artwork detail page that shows a human silhouette (170cm) next to a proportionally-scaled rectangle representing the artwork's real-world dimensions. This helps users understand the physical size of artworks — whether they're looking at a miniature or a 10-foot mural.

## Files Created

- `src/utils/parseDimensions.ts` — Parses Harvard API `dimensions` strings (e.g., "73.7 x 92.1 cm") into structured `{ heightCm, widthCm }` objects. Handles cm, inches (with conversion), unicode multiply sign, and prefixed formats like "Sheet: ...".
- `src/utils/__tests__/parseDimensions.test.ts` — 6 unit tests covering cm, inches, unicode multiply, prefixed strings, undefined input, and unparseable strings.
- `src/components/ScaleReference.tsx` — Renders an inline SVG human silhouette alongside a dashed-border rectangle scaled to the artwork's dimensions. Uses a fixed 200px container height with proportional scaling from 170cm human reference.

## Files Modified

- `src/pages/ArtworkDetailPage.tsx` — Imported `ScaleReference` and rendered it between the image container and the title, passing the artwork's `dimensions` string and accent color.
- `src/App.css` — Added `.scale-ref`, `.scale-ref__visual`, `.scale-ref__human`, `.scale-ref__artwork`, and `.scale-ref__label` styles before the Bottom Navigation section.

## Patterns

- The scale visualization always shows when dimensions are parseable (no toggle in v1).
- The 200px container maps to 170cm human height; artwork dimensions are scaled proportionally with max caps to prevent overflow.
- Accent color from the artwork's hue is passed through to both the SVG fill and the artwork border.

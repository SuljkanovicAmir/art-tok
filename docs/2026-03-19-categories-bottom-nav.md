# Category Filters + Bottom Navigation

**Date:** 2026-03-19
**Task:** Task 7 — Category browsing and bottom nav

## What was built

### CategoriesPage (`src/pages/CategoriesPage.tsx`)
- Fetches facets for culture, classification, and century from Harvard API on mount
- Displays grouped sections: "By Culture", "By Classification", "By Century"
- Each category rendered as a chip/pill linking to `/categories/:facet/:value`
- Shows object count next to each category name
- Loading and error states

### BottomNav (`src/components/BottomNav.tsx`)
- Fixed bottom bar with 4 nav items: Home, Search, Browse, Liked
- SVG icons inline (no icon library)
- Active route highlighting via `useLocation`
- Rendered outside `<Routes>` so it appears on all pages

### SearchPage updates (`src/pages/SearchPage.tsx`)
- Accepts `facet` and `value` route params from `/categories/:facet/:value`
- Auto-searches with category filter pre-applied when params are present
- Displays filter tag above results
- Search bar refines within the active category
- Back link navigates to `/categories` when in category mode

### useSearchQuery update (`src/hooks/useSearchQuery.ts`)
- `enabled` condition now also triggers for category filters (culture, classification, century, medium) without requiring a keyword

### App.tsx updates
- Added `/categories` and `/categories/:facet/:value` routes
- Added `<BottomNav />` outside Routes

### CSS additions (`src/App.css`)
- Categories page styles (header, sections, chips)
- Bottom nav styles (fixed, blur backdrop, active state)
- Filter tag styles for SearchPage
- Added `padding-bottom: 4rem` to search-page, liked-page, detail-page to avoid bottom nav overlap

## Files changed
- `src/App.tsx` — routes + BottomNav
- `src/pages/SearchPage.tsx` — category route params support
- `src/hooks/useSearchQuery.ts` — enabled condition
- `src/App.css` — new styles + padding fixes
- `src/pages/CategoriesPage.tsx` (new)
- `src/components/BottomNav.tsx` (new)

## Patterns
- Category facet values are URL-encoded in links and decoded via `decodeURIComponent` in SearchPage
- The `useSearchQuery` hook's `enabled` flag must account for all possible filter fields, not just keyword

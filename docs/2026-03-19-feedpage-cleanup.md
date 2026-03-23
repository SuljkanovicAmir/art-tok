# FeedPage Cleanup — 2026-03-19

## Summary

Removed the LikedArtPanel slide-out from FeedPage since liked art now has its own dedicated route (`/liked`) accessible from the bottom navigation. Also removed the heart/collection link from the feed header (redundant with BottomNav), cleaned up orphaned CSS, and added `prefers-reduced-motion` coverage for new components.

## Files Changed

- `src/pages/FeedPage.tsx` — Removed LikedArtPanel import/rendering, `isLikedPanelOpen` state, `closeLikedPanel`/`togglePanelFromSwipe` callbacks, touch swipe useEffect, backdrop button, CollectionIcon, and the liked header link. Removed unused `useState`/`useEffect` imports.
- `src/App.css` — Removed orphaned `.liked-panel__backdrop` rule. Added `detail-page__action-button`, `categories-page__chip`, and `bottom-nav__item` to the `prefers-reduced-motion: reduce` block.

## Notes

- The `LikedArtPanel` component file (`src/components/LikedArtPanel.tsx`) was intentionally kept for potential reuse.
- The `.liked-panel` CSS classes were kept since they belong to the LikedArtPanel component.
- `padding-bottom: 4.5rem` was already present on `.art-feed__scroller` from a prior task, providing clearance for the bottom nav.

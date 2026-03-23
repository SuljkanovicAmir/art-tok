# React 19 + React Compiler + React Query Upgrade

**Date:** 2026-03-19
**Branch:** main

## What Was Built

Upgraded the entire app to modern React 19 patterns:

1. **React 19.2.4** — latest version with ref-as-prop, ref cleanup, useSyncExternalStore
2. **React Compiler 1.0** — auto-memoization, eliminates manual useCallback/useMemo
3. **@tanstack/react-query 5.91** — replaces MobX stores for data fetching & caching

## useEffect Count: 8 → 3

| Removed useEffect | Replaced With |
|---|---|
| `useLikedArt` localStorage sync | `useSyncExternalStore` |
| `useLikedArtCollection` localStorage sync | `useSyncExternalStore` |
| `useInfiniteScroll` observer cleanup | React 19 ref cleanup |
| `ArtCard` timeout cleanup | Removed (unnecessary) |
| `ArtworkDetailPage` data fetch | `useQuery` |
| `FeedPage` initial data fetch | `useInfiniteQuery` |

**3 remaining** (legitimate DOM listeners): FeedPage touch swipe, LikedArtPanel touch swipe, LikedArtPanel Escape key.

## Files Changed

- `package.json` — added react-query, react-compiler, updated react
- `vite.config.ts` — babel plugins for compiler + decorators
- `eslint.config.js` — added react-compiler eslint plugin
- `src/main.tsx` — added QueryClientProvider
- `src/components/ArtCard.tsx` — removed forwardRef, useCallback, useMemo, useEffect
- `src/components/LikedArtPanel.tsx` — removed observer(), uses availablePieces prop
- `src/pages/FeedPage.tsx` — removed observer(), uses useInfiniteQuery
- `src/pages/ArtworkDetailPage.tsx` — uses useQuery instead of useEffect fetch
- `src/pages/SearchPage.tsx` — uses useInfiniteQuery, removed MobX SearchStore dependency
- `src/hooks/useLikedArt.ts` — rewritten with useSyncExternalStore
- `src/hooks/useLikedArtCollection.ts` — rewritten with useSyncExternalStore, takes availablePieces param
- `src/hooks/useInfiniteScroll.ts` — uses React 19 ref cleanup instead of useEffect

## New Files

- `src/hooks/useArtworkQuery.ts` — useQuery for single artwork detail
- `src/hooks/useFeedQuery.ts` — useInfiniteQuery for feed + flattenFeedPages helper
- `src/hooks/useSearchQuery.ts` — useInfiniteQuery for search + flattenSearchPages helper

## Patterns

- React Compiler needs `@babel/plugin-proposal-decorators` listed BEFORE it in babel plugins if MobX decorators exist
- MobX stores (`ArtImagesStore`, `SearchStore`) are no longer imported but still exist — can be deleted
- `useSyncExternalStore` is the correct replacement for useEffect-based external store subscriptions
- React 19 ref callbacks can return a cleanup function (replaces cleanup-only useEffects)

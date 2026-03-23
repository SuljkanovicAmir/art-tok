# User Preference Engine

**Date:** 2026-03-19
**Task:** Build client-side preference engine for interaction tracking and taste similarity scoring

## What Was Built

A TDD-driven preference engine that tracks user interactions with artworks (like, view, detail, share, skip) and computes taste similarity scores. This is the foundation for the "For You" algorithmic feed.

### How It Works

1. **Interaction Recording** -- each interaction type has a weight (like=1.0, share=0.8, detail=0.5, view=0.3, skip=-0.2)
2. **Preference Vector** -- accumulates weighted scores across four dimensions: culture, classification, century, medium
3. **Similarity Scoring** -- compares a user's preference vector against an artwork's attributes using weighted dot product (culture 30%, classification 25%, century 25%, medium 20%)
4. **Persistence** -- stored in localStorage under `arttok-preferences` key with in-memory caching

## Files Created

- `src/types/preferences.ts` -- PreferenceVector interface, InteractionType type, INTERACTION_WEIGHTS constants
- `src/utils/preferenceEngine.ts` -- Core engine: recordInteraction, getPreferenceVector, computeSimilarity, resetPreferences
- `src/utils/__tests__/preferenceEngine.test.ts` -- 6 tests covering empty state, like recording, weight comparison, similarity scoring, skip negative weight, localStorage persistence
- `src/hooks/useTrackInteraction.ts` -- React hook that auto-records "view" after 3s dwell time, exposes trackLike/trackShare/trackDetail/trackSkip callbacks

## Patterns

- **TDD workflow**: tests written first, verified failing, then implementation added
- **In-memory cache + localStorage**: `cached` module variable avoids repeated JSON.parse; `resetPreferences()` clears cache to force reload
- **Century extraction**: `dateToCentury()` parses year from dated string via regex, converts to ordinal century string (e.g., "19th century")
- **Dwell-time view tracking**: 3-second setTimeout in useEffect with cleanup; skip only fires if view wasn't recorded yet

# Phase 0: Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare the ArtTok codebase for the 34-feature expansion by cleaning up dead code, adding multi-source API federation, building a user preference engine, and setting up testing infrastructure.

**Architecture:** Adapter pattern for multi-source APIs — each museum API implements an `ArtSource` interface, normalized to the existing `ArtPiece` type. Preference engine runs client-side using localStorage. Vitest for testing. MobX removed entirely.

**Tech Stack:** React 19, TypeScript 5, TanStack Query 5, Vitest, Vite 6

---

## Task 1: Remove Dead Code (MobX Stores + Unused Components)

**Files:**
- Delete: `src/stores/ArtImagesStore.ts`
- Delete: `src/stores/SearchStore.ts`
- Delete: `src/components/LikedArtPanel.tsx`
- Modify: `package.json` — remove MobX dependencies
- Modify: `vite.config.ts` — remove decorators babel plugin
- Modify: `tsconfig.json` — remove `experimentalDecorators`
- Modify: `tsconfig.app.json` — remove `experimentalDecorators`

**Step 1: Verify nothing imports MobX stores or LikedArtPanel**

Run: `grep -r "ArtImagesStore\|SearchStore\|LikedArtPanel\|mobx" src/ --include="*.ts" --include="*.tsx" -l`
Expected: No files should import these (stores are legacy, LikedArtPanel is unused)

**Step 2: Delete the dead files**

```bash
rm src/stores/ArtImagesStore.ts
rm src/stores/SearchStore.ts
rm src/components/LikedArtPanel.tsx
rmdir src/stores  # should be empty now
```

**Step 3: Remove MobX dependencies from package.json**

In `package.json`, remove these three lines from `dependencies`:
```json
"mobx": "^6.13.6",
"mobx-react": "^9.2.0",
"mobx-react-lite": "^4.1.0",
```

**Step 4: Remove decorators babel plugin from vite.config.ts**

Replace the `babel.plugins` array in `vite.config.ts` with:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {}],
        ],
      },
    }),
  ],
})
```

Also remove the `@babel/plugin-proposal-decorators` devDependency from `package.json`:
```json
"@babel/plugin-proposal-decorators": "^7.25.9",
```

**Step 5: Remove experimentalDecorators from tsconfig files**

In `tsconfig.json`, remove both lines:
```json
"experimentalDecorators": true,
"useDefineForClassFields": true
```

Replace the `compilerOptions` block with an empty object (or remove it):
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

In `tsconfig.app.json`, remove line 24:
```json
"experimentalDecorators": true,
```

**Step 6: Reinstall dependencies and verify build**

```bash
npm install
npm run lint
npm run build
```

Expected: Build succeeds with no MobX references.

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead MobX stores, unused LikedArtPanel, and decorator config"
```

---

## Task 2: Install Vitest and Set Up Testing Infrastructure

**Files:**
- Modify: `package.json` — add vitest dependencies and test script
- Create: `src/test/setup.ts` — test setup with mocks
- Create: `vitest.config.ts` — vitest configuration
- Create: `src/utils/__tests__/mapArtRecord.test.ts` — first test to validate setup

**Step 1: Install Vitest and testing utilities**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 2: Create vitest.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {}],
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
})
```

**Step 3: Create test setup file at `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

**Step 4: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Write the first test — mapArtRecord**

Create `src/utils/__tests__/mapArtRecord.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapArtRecord } from '../mapArtRecord';
import type { HarvardArtRecord } from '../../types/art';

describe('mapArtRecord', () => {
  it('returns null when primaryimageurl is missing', () => {
    const record: HarvardArtRecord = { objectid: 1 };
    expect(mapArtRecord(record)).toBeNull();
  });

  it('maps a full record to ArtPiece', () => {
    const record: HarvardArtRecord = {
      objectid: 123,
      primaryimageurl: 'https://example.com/img.jpg',
      title: 'Starry Night',
      people: [{ name: 'Vincent van Gogh', role: 'Artist' }],
      description: 'A swirling sky',
      culture: 'Dutch',
      dated: '1889',
      classification: 'Paintings',
      medium: 'Oil on canvas',
      dimensions: '73.7 cm × 92.1 cm',
      url: 'https://example.com/artwork/123',
    };

    const result = mapArtRecord(record);

    expect(result).toEqual({
      id: 123,
      imageUrl: 'https://example.com/img.jpg',
      title: 'Starry Night',
      artist: 'Vincent van Gogh',
      description: 'A swirling sky',
      culture: 'Dutch',
      dated: '1889',
      classification: 'Paintings',
      medium: 'Oil on canvas',
      dimensions: '73.7 cm × 92.1 cm',
      url: 'https://example.com/artwork/123',
    });
  });

  it('uses fallback values for missing fields', () => {
    const record: HarvardArtRecord = {
      objectid: 456,
      primaryimageurl: 'https://example.com/img2.jpg',
    };

    const result = mapArtRecord(record)!;

    expect(result.title).toBe('Untitled');
    expect(result.artist).toBe('Unknown artist');
    expect(result.description).toBeUndefined();
    expect(result.culture).toBeUndefined();
  });

  it('falls back to technique when medium is missing', () => {
    const record: HarvardArtRecord = {
      objectid: 789,
      primaryimageurl: 'https://example.com/img3.jpg',
      technique: 'Woodblock print',
    };

    const result = mapArtRecord(record)!;
    expect(result.medium).toBe('Woodblock print');
  });

  it('falls back to labeltext then creditline for description', () => {
    const record: HarvardArtRecord = {
      objectid: 101,
      primaryimageurl: 'https://example.com/img4.jpg',
      labeltext: 'Museum label text',
    };

    expect(mapArtRecord(record)!.description).toBe('Museum label text');

    const record2: HarvardArtRecord = {
      objectid: 102,
      primaryimageurl: 'https://example.com/img5.jpg',
      creditline: 'Gift of the artist',
    };

    expect(mapArtRecord(record2)!.description).toBe('Gift of the artist');
  });

  it('joins multiple artist names', () => {
    const record: HarvardArtRecord = {
      objectid: 201,
      primaryimageurl: 'https://example.com/img6.jpg',
      people: [{ name: 'Alice' }, { name: 'Bob' }],
    };

    expect(mapArtRecord(record)!.artist).toBe('Alice, Bob');
  });
});
```

**Step 6: Run tests to verify setup**

```bash
npm run test
```

Expected: All 6 tests pass.

**Step 7: Verify lint and build still work**

```bash
npm run lint && npm run build
```

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Vitest testing infrastructure with mapArtRecord tests"
```

---

## Task 3: Create ArtSource Adapter Interface and Refactor Harvard Service

**Files:**
- Create: `src/services/types.ts` — shared service types and ArtSource interface
- Modify: `src/types/art.ts` — add `source` field to ArtPiece
- Modify: `src/services/ArtImagesService.ts` — rename to HarvardAdapter, implement ArtSource
- Create: `src/services/HarvardAdapter.ts` — renamed from ArtImagesService
- Create: `src/services/ArtSourceRegistry.ts` — registry managing multiple sources
- Modify: `src/utils/mapArtRecord.ts` — add source parameter
- Update: all consumers of ArtImagesService → use registry

**Step 1: Define the ArtSource interface**

Create `src/services/types.ts`:

```ts
import type { ArtPiece } from "../types/art";

export interface ArtSourceFeedOptions {
  page: number;
  size: number;
}

export interface ArtSourceSearchOptions {
  keyword?: string;
  culture?: string;
  classification?: string;
  century?: string;
  medium?: string;
  page: number;
  size: number;
}

export interface ArtSourceFeedResult {
  pieces: ArtPiece[];
  hasNext: boolean;
  total?: number;
}

export interface FacetItem {
  name: string;
  count: number;
}

export interface ArtSource {
  readonly name: string;
  readonly id: 'harvard' | 'met' | 'artic' | 'rijks';

  /** Fetch a page of artworks for the main feed */
  fetchFeed(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult>;

  /** Search artworks by various criteria */
  search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult>;

  /** Fetch a single artwork by its source-specific ID */
  fetchById(id: number): Promise<ArtPiece | null>;

  /** Fetch facet values (e.g., cultures, classifications) */
  fetchFacet(facet: string, size: number): Promise<FacetItem[]>;
}
```

**Step 2: Add `source` field to ArtPiece**

In `src/types/art.ts`, update the `ArtPiece` interface:

```ts
export type ArtSourceId = 'harvard' | 'met' | 'artic' | 'rijks';

export interface ArtPiece {
  id: number;
  imageUrl: string;
  title: string;
  artist: string;
  description?: string;
  culture?: string;
  dated?: string;
  classification?: string;
  medium?: string;
  dimensions?: string;
  url?: string;
  source: ArtSourceId;
}
```

**Step 3: Update mapArtRecord to include source**

In `src/utils/mapArtRecord.ts`:

```ts
import type { ArtPiece, HarvardArtRecord } from "../types/art";

export function mapArtRecord(record: HarvardArtRecord): ArtPiece | null {
  if (!record.primaryimageurl) {
    return null;
  }

  const artistNames = record.people
    ?.map((person) => person.name)
    .filter(Boolean)
    .join(", ");

  const description = record.description || record.labeltext || record.creditline;

  return {
    id: record.objectid,
    imageUrl: record.primaryimageurl,
    title: record.title || "Untitled",
    artist: artistNames || "Unknown artist",
    description: description || undefined,
    culture: record.culture || undefined,
    dated: record.dated || undefined,
    classification: record.classification || undefined,
    medium: record.medium || record.technique || undefined,
    dimensions: record.dimensions || undefined,
    url: record.url || undefined,
    source: 'harvard',
  };
}
```

**Step 4: Create HarvardAdapter implementing ArtSource**

Create `src/services/HarvardAdapter.ts`:

```ts
import type { ArtSource, ArtSourceFeedOptions, ArtSourceFeedResult, ArtSourceSearchOptions, FacetItem } from "./types";
import type { ArtPiece, HarvardArtResponse } from "../types/art";
import { mapArtRecord } from "../utils/mapArtRecord";

const API_ENDPOINT = "https://api.harvardartmuseums.org/object";
const API_KEY = import.meta.env.VITE_HARVARD_API_KEY as string;
const DEFAULT_QUERY = "verificationlevel:4";
const FIELDS = [
  "objectid", "primaryimageurl", "title", "people", "description",
  "labeltext", "creditline", "culture", "dated", "classification",
  "medium", "technique", "dimensions", "url",
];

export class HarvardAdapter implements ArtSource {
  readonly name = "Harvard Art Museums";
  readonly id = 'harvard' as const;

  async fetchFeed({ page, size }: ArtSourceFeedOptions): Promise<ArtSourceFeedResult> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(size),
      page: String(page),
      sort: "random",
      hasimage: "1",
      q: DEFAULT_QUERY,
      fields: FIELDS.join(","),
    });

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error(`Harvard feed failed: ${response.status}`);

    const data: HarvardArtResponse = await response.json();
    const pieces = data.records
      .map((r) => mapArtRecord(r))
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: Boolean(data.info?.next) || pieces.length > 0,
      total: data.info.totalrecords,
    };
  }

  async search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(options.size),
      page: String(options.page),
      hasimage: "1",
      fields: FIELDS.join(","),
    });

    const queryParts: string[] = [DEFAULT_QUERY];

    if (options.keyword) params.set("keyword", options.keyword);
    if (options.culture) params.set("culture", options.culture);
    if (options.classification) params.set("classification", options.classification);
    if (options.century) params.set("century", options.century);
    if (options.medium) params.set("medium", options.medium);

    params.set("q", queryParts.join(" AND "));

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error(`Harvard search failed: ${response.status}`);

    const data: HarvardArtResponse = await response.json();
    const pieces = data.records
      .map((r) => mapArtRecord(r))
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: Boolean(data.info?.next),
      total: data.info.totalrecords,
    };
  }

  async fetchById(id: number): Promise<ArtPiece | null> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      fields: FIELDS.join(","),
    });

    const response = await fetch(`${API_ENDPOINT}/${id}?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Harvard fetch failed: ${response.status}`);
    }

    const record = await response.json();
    return mapArtRecord(record);
  }

  async fetchFacet(facet: string, size: number): Promise<FacetItem[]> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(size),
      sort: "objectcount",
      sortorder: "desc",
    });

    const response = await fetch(
      `https://api.harvardartmuseums.org/${facet}?${params.toString()}`
    );
    if (!response.ok) throw new Error(`Harvard facet fetch failed: ${response.status}`);

    const data = await response.json();
    return (data.records || []).map((r: { name: string; objectcount: number }) => ({
      name: r.name,
      count: r.objectcount,
    }));
  }
}
```

**Step 5: Create ArtSourceRegistry**

Create `src/services/ArtSourceRegistry.ts`:

```ts
import type { ArtSource, ArtSourceFeedOptions, ArtSourceFeedResult, ArtSourceSearchOptions, FacetItem } from "./types";
import type { ArtPiece, ArtSourceId } from "../types/art";

export class ArtSourceRegistry {
  private sources: Map<ArtSourceId, ArtSource> = new Map();

  register(source: ArtSource): void {
    this.sources.set(source.id, source);
  }

  getSource(id: ArtSourceId): ArtSource | undefined {
    return this.sources.get(id);
  }

  getAllSources(): ArtSource[] {
    return Array.from(this.sources.values());
  }

  /** Fetch feed from a single source (for now). Future: merge across sources. */
  async fetchFeed(options: ArtSourceFeedOptions, sourceId?: ArtSourceId): Promise<ArtSourceFeedResult> {
    const source = sourceId
      ? this.sources.get(sourceId)
      : this.sources.values().next().value;

    if (!source) throw new Error(`No art source available`);
    return source.fetchFeed(options);
  }

  /** Search across a single source (for now). Future: federated search. */
  async search(options: ArtSourceSearchOptions, sourceId?: ArtSourceId): Promise<ArtSourceFeedResult> {
    const source = sourceId
      ? this.sources.get(sourceId)
      : this.sources.values().next().value;

    if (!source) throw new Error(`No art source available`);
    return source.search(options);
  }

  /** Fetch a single artwork. Tries the specified source, or all sources. */
  async fetchById(id: number, sourceId?: ArtSourceId): Promise<ArtPiece | null> {
    if (sourceId) {
      const source = this.sources.get(sourceId);
      if (!source) return null;
      return source.fetchById(id);
    }

    // Try each source until we find it
    for (const source of this.sources.values()) {
      const result = await source.fetchById(id);
      if (result) return result;
    }
    return null;
  }

  /** Fetch facets from a single source */
  async fetchFacet(facet: string, size: number, sourceId?: ArtSourceId): Promise<FacetItem[]> {
    const source = sourceId
      ? this.sources.get(sourceId)
      : this.sources.values().next().value;

    if (!source) throw new Error(`No art source available`);
    return source.fetchFacet(facet, size);
  }
}
```

**Step 6: Create the default registry instance**

Create `src/services/registry.ts`:

```ts
import { ArtSourceRegistry } from "./ArtSourceRegistry";
import { HarvardAdapter } from "./HarvardAdapter";

export const artRegistry = new ArtSourceRegistry();
artRegistry.register(new HarvardAdapter());
```

**Step 7: Update useFeedQuery to use registry**

Replace `src/hooks/useFeedQuery.ts`:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtPiece } from "../types/art";

export function useFeedQuery() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: async ({ pageParam }) => {
      return artRegistry.fetchFeed({ page: pageParam, size: 8 });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
    staleTime: 2 * 60 * 1000,
  });
}

export function flattenFeedPages(data: ReturnType<typeof useFeedQuery>["data"]) {
  if (!data) return [];
  const seen = new Set<number>();
  const result: ArtPiece[] = [];
  for (const page of data.pages) {
    for (const piece of page.pieces) {
      if (!seen.has(piece.id)) {
        seen.add(piece.id);
        result.push(piece);
      }
    }
  }
  return result;
}
```

**Step 8: Update useArtworkQuery to use registry**

Replace `src/hooks/useArtworkQuery.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";

export function useArtworkQuery(id: number | undefined) {
  return useQuery({
    queryKey: ["artwork", id],
    queryFn: async () => {
      if (!id) throw new Error("No artwork ID provided");
      const piece = await artRegistry.fetchById(id);
      if (!piece) throw new Error("Artwork not found");
      return piece;
    },
    enabled: id !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Step 9: Update useSearchQuery to use registry**

In `src/hooks/useSearchQuery.ts`, replace the service import and query function:

Replace the import and service line:
```ts
// Old:
import ArtImagesService from "../services/ArtImagesService";
const service = new ArtImagesService();

// New:
import { artRegistry } from "../services/registry";
```

Replace the `queryFn` to call `artRegistry.search()` instead of `service.searchArtworks()`. The search params mapping should convert from the hook's params to `ArtSourceSearchOptions`:

```ts
queryFn: async ({ pageParam }) => {
  const result = await artRegistry.search({
    keyword: params.keyword,
    culture: params.culture,
    classification: params.classification,
    century: params.century,
    medium: params.medium,
    page: pageParam,
    size: params.size || 12,
  });
  return result;
},
```

**Step 10: Update LikedPage to use registry instead of ArtImagesService**

In `src/pages/LikedPage.tsx`:

Replace:
```ts
import ArtImagesService from "../services/ArtImagesService";
const artService = new ArtImagesService();
```

With:
```ts
import { artRegistry } from "../services/registry";
```

And change the `fetchArtworkById` call:
```ts
// Old:
Array.from(likedIds).map((id) => artService.fetchArtworkById(id))

// New:
Array.from(likedIds).map((id) => artRegistry.fetchById(id))
```

Also remove the `mapArtRecord` import and the mapping step — `fetchById` already returns `ArtPiece | null`:
```ts
const pieces: ArtPiece[] = [];
for (const result of results) {
  if (result.status === "fulfilled" && result.value) {
    pieces.push(result.value);
  }
}
```

**Step 11: Update CategoriesPage to use registry instead of ArtImagesService**

In `src/pages/CategoriesPage.tsx`:

Replace:
```ts
import ArtImagesService from "../services/ArtImagesService";
const service = new ArtImagesService();
```

With:
```ts
import { artRegistry } from "../services/registry";
```

And change the `fetchFacet` calls:
```ts
// Old:
service.fetchFacet("culture", 40)

// New:
artRegistry.fetchFacet("culture", 40)
```

**Step 12: Delete the old ArtImagesService**

```bash
rm src/services/ArtImagesService.ts
```

**Step 13: Update tests**

Update `src/utils/__tests__/mapArtRecord.test.ts` — add `source: 'harvard'` to all expected results:

In the "maps a full record to ArtPiece" test, add to the expected object:
```ts
source: 'harvard',
```

In the "uses fallback values" test, add:
```ts
expect(result.source).toBe('harvard');
```

**Step 14: Run tests, lint, and build**

```bash
npm run test && npm run lint && npm run build
```

Expected: All tests pass, lint clean, build succeeds.

**Step 15: Commit**

```bash
git add -A
git commit -m "refactor: introduce ArtSource adapter pattern with HarvardAdapter and registry"
```

---

## Task 4: Migrate LikedPage to React Query

**Files:**
- Create: `src/hooks/useLikedArtQuery.ts` — React Query hook for liked artworks
- Modify: `src/pages/LikedPage.tsx` — use new hook instead of manual useEffect

**Step 1: Create the useLikedArtQuery hook**

Create `src/hooks/useLikedArtQuery.ts`:

```ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { artRegistry } from "../services/registry";
import { readLikedSet, LIKED_ART_STORAGE_EVENT } from "../utils/likedArtStorage";
import type { ArtPiece } from "../types/art";

export function useLikedArtQuery() {
  const queryClient = useQueryClient();

  // Invalidate query when likes change
  useEffect(() => {
    const handleChange = () => {
      queryClient.invalidateQueries({ queryKey: ["liked-artworks"] });
    };

    window.addEventListener(LIKED_ART_STORAGE_EVENT, handleChange);
    return () => window.removeEventListener(LIKED_ART_STORAGE_EVENT, handleChange);
  }, [queryClient]);

  return useQuery({
    queryKey: ["liked-artworks", JSON.stringify(Array.from(readLikedSet()))],
    queryFn: async () => {
      const likedIds = readLikedSet();
      if (likedIds.size === 0) return [];

      const results = await Promise.allSettled(
        Array.from(likedIds).map((id) => artRegistry.fetchById(id))
      );

      const pieces: ArtPiece[] = [];
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          pieces.push(result.value);
        }
      }
      return pieces;
    },
    staleTime: 2 * 60 * 1000,
  });
}
```

**Step 2: Rewrite LikedPage using the hook**

Replace `src/pages/LikedPage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { useLikedArt } from "../hooks/useLikedArt";
import { useLikedArtQuery } from "../hooks/useLikedArtQuery";
import { readLikedSet } from "../utils/likedArtStorage";
import type { ArtPiece } from "../types/art";

function LikedCard({ piece }: { piece: ArtPiece }) {
  const { toggleLike } = useLikedArt(piece.id);

  return (
    <div className="liked-card">
      <img
        className="liked-card__image"
        src={piece.imageUrl}
        alt={piece.title}
        loading="lazy"
      />
      <button
        className="liked-card__unlike"
        onClick={toggleLike}
        aria-label={`Unlike ${piece.title}`}
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </button>
      <div className="liked-card__info">
        <p className="liked-card__title">
          <Link to={`/artwork/${piece.id}`}>{piece.title}</Link>
        </p>
        <p className="liked-card__artist">{piece.artist}</p>
      </div>
    </div>
  );
}

export default function LikedPage() {
  const { data: artworks, isLoading } = useLikedArtQuery();
  const likedCount = readLikedSet().size;

  return (
    <div className="liked-page">
      <header className="liked-page__header">
        <Link to="/" className="liked-page__back" aria-label="Back to feed">
          &larr; Back
        </Link>
        <h1 className="liked-page__heading">Liked Art</h1>
        <span className="liked-page__count">{likedCount}</span>
      </header>

      {isLoading ? (
        <div className="liked-page__status">Loading liked artworks...</div>
      ) : !artworks || artworks.length === 0 ? (
        <div className="liked-page__empty">
          <p>No liked artworks yet. Go discover some art!</p>
          <Link to="/">Browse the feed</Link>
        </div>
      ) : (
        <div className="liked-page__grid">
          {artworks.map((piece) => (
            <LikedCard key={piece.id} piece={piece} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run tests, lint, build**

```bash
npm run test && npm run lint && npm run build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: migrate LikedPage to React Query with useLikedArtQuery hook"
```

---

## Task 5: Migrate CategoriesPage to React Query

**Files:**
- Create: `src/hooks/useFacetsQuery.ts` — React Query hook for facet data
- Modify: `src/pages/CategoriesPage.tsx` — use new hook

**Step 1: Create the useFacetsQuery hook**

Create `src/hooks/useFacetsQuery.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";

interface FacetSection {
  label: string;
  facet: "culture" | "classification" | "century";
  items: { name: string; count: number }[];
}

export function useFacetsQuery() {
  return useQuery({
    queryKey: ["facets"],
    queryFn: async (): Promise<FacetSection[]> => {
      const [cultures, classifications, centuries] = await Promise.all([
        artRegistry.fetchFacet("culture", 40),
        artRegistry.fetchFacet("classification", 40),
        artRegistry.fetchFacet("century", 30),
      ]);

      return [
        { label: "By Culture", facet: "culture", items: cultures },
        { label: "By Classification", facet: "classification", items: classifications },
        { label: "By Century", facet: "century", items: centuries },
      ];
    },
    staleTime: 10 * 60 * 1000, // Facets change rarely
  });
}
```

**Step 2: Rewrite CategoriesPage using the hook**

Replace `src/pages/CategoriesPage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { useFacetsQuery } from "../hooks/useFacetsQuery";

export default function CategoriesPage() {
  const { data: sections, isLoading, error } = useFacetsQuery();

  return (
    <div className="categories-page">
      <header className="categories-page__header">
        <Link to="/" className="categories-page__back">
          &larr; Back
        </Link>
        <h1 className="categories-page__heading">Browse</h1>
      </header>

      {isLoading && (
        <div className="categories-page__status">Loading categories...</div>
      )}

      {error && (
        <div className="categories-page__status">Failed to load categories. Please try again.</div>
      )}

      {sections?.map((section) => (
        <section key={section.facet} className="categories-page__section">
          <h2 className="categories-page__section-title">{section.label}</h2>
          <div className="categories-page__chips">
            {section.items
              .filter((item) => item.name && item.count > 0)
              .map((item) => (
                <Link
                  key={item.name}
                  to={`/categories/${section.facet}/${encodeURIComponent(item.name)}`}
                  className="categories-page__chip"
                >
                  {item.name}
                  <span className="categories-page__chip-count">
                    {item.count.toLocaleString()}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

**Step 3: Run tests, lint, build**

```bash
npm run test && npm run lint && npm run build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: migrate CategoriesPage to React Query with useFacetsQuery hook"
```

---

## Task 6: Build User Preference Engine

**Files:**
- Create: `src/types/preferences.ts` — preference vector types
- Create: `src/utils/preferenceEngine.ts` — preference tracking and computation
- Create: `src/utils/__tests__/preferenceEngine.test.ts` — tests
- Create: `src/hooks/useTrackInteraction.ts` — hook for tracking user interactions
- Modify: `src/components/ArtCard.tsx` — track dwell time and interactions

**Step 1: Write the failing tests first**

Create `src/utils/__tests__/preferenceEngine.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordInteraction,
  getPreferenceVector,
  computeSimilarity,
  resetPreferences,
} from '../preferenceEngine';
import type { ArtPiece } from '../../types/art';

const mockArtwork: ArtPiece = {
  id: 1,
  imageUrl: 'https://example.com/img.jpg',
  title: 'Test Art',
  artist: 'Test Artist',
  culture: 'French',
  classification: 'Paintings',
  dated: '1889',
  medium: 'Oil on canvas',
  source: 'harvard',
};

describe('preferenceEngine', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPreferences();
  });

  it('starts with an empty preference vector', () => {
    const vector = getPreferenceVector();
    expect(vector.culture).toEqual({});
    expect(vector.classification).toEqual({});
    expect(vector.century).toEqual({});
    expect(vector.medium).toEqual({});
    expect(vector.totalInteractions).toBe(0);
  });

  it('records a like interaction and updates the vector', () => {
    recordInteraction(mockArtwork, 'like');
    const vector = getPreferenceVector();

    expect(vector.culture['French']).toBeGreaterThan(0);
    expect(vector.classification['Paintings']).toBeGreaterThan(0);
    expect(vector.totalInteractions).toBe(1);
  });

  it('weighs likes more heavily than views', () => {
    const artwork2: ArtPiece = { ...mockArtwork, id: 2 };

    recordInteraction(mockArtwork, 'like');
    recordInteraction(artwork2, 'view');

    const vector = getPreferenceVector();
    // Like weight is 1.0, view weight is 0.3
    // French should have accumulated 1.0 + 0.3 = 1.3 total
    expect(vector.culture['French']).toBeCloseTo(1.3, 1);
  });

  it('computes similarity between user vector and artwork attributes', () => {
    // Build up some preferences
    recordInteraction(mockArtwork, 'like');
    recordInteraction(mockArtwork, 'like');

    const vector = getPreferenceVector();

    // Same attributes should have high similarity
    const similarArt: ArtPiece = {
      ...mockArtwork,
      id: 2,
    };
    const differentArt: ArtPiece = {
      ...mockArtwork,
      id: 3,
      culture: 'Japanese',
      classification: 'Prints',
      medium: 'Woodblock',
    };

    const similarScore = computeSimilarity(vector, similarArt);
    const differentScore = computeSimilarity(vector, differentArt);

    expect(similarScore).toBeGreaterThan(differentScore);
  });

  it('handles skip interactions with negative weight', () => {
    recordInteraction(mockArtwork, 'like');

    const artwork2: ArtPiece = {
      ...mockArtwork,
      id: 2,
      culture: 'Japanese',
    };
    recordInteraction(artwork2, 'skip');

    const vector = getPreferenceVector();
    expect(vector.culture['French']).toBeGreaterThan(0);
    expect(vector.culture['Japanese']).toBeLessThan(0);
  });

  it('persists preferences across calls via localStorage', () => {
    recordInteraction(mockArtwork, 'like');

    // Simulate fresh module load by reading from storage
    resetPreferences();
    const vector = getPreferenceVector();

    expect(vector.culture['French']).toBeGreaterThan(0);
    expect(vector.totalInteractions).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `preferenceEngine` module does not exist yet.

**Step 3: Define preference types**

Create `src/types/preferences.ts`:

```ts
export interface PreferenceVector {
  culture: Record<string, number>;
  classification: Record<string, number>;
  century: Record<string, number>;
  medium: Record<string, number>;
  totalInteractions: number;
}

export type InteractionType = 'like' | 'view' | 'detail' | 'share' | 'skip';

export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  like: 1.0,
  share: 0.8,
  detail: 0.5,
  view: 0.3,
  skip: -0.2,
};
```

**Step 4: Implement the preference engine**

Create `src/utils/preferenceEngine.ts`:

```ts
import type { ArtPiece } from "../types/art";
import type { InteractionType, PreferenceVector } from "../types/preferences";
import { INTERACTION_WEIGHTS } from "../types/preferences";

const STORAGE_KEY = "arttok-preferences";

let cached: PreferenceVector | null = null;

function loadFromStorage(): PreferenceVector {
  if (typeof window === "undefined") return emptyVector();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalInteractions === "number") {
        return parsed as PreferenceVector;
      }
    }
  } catch {
    // Ignore corrupt data
  }
  return emptyVector();
}

function saveToStorage(vector: PreferenceVector): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vector));
  } catch {
    // Storage full or unavailable
  }
}

function emptyVector(): PreferenceVector {
  return {
    culture: {},
    classification: {},
    century: {},
    medium: {},
    totalInteractions: 0,
  };
}

function getVector(): PreferenceVector {
  if (!cached) {
    cached = loadFromStorage();
  }
  return cached;
}

function addWeight(
  bucket: Record<string, number>,
  key: string | undefined,
  weight: number
): void {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + weight;
}

/** Extracts a rough century string from the dated field (e.g., "1889" → "19th century") */
function dateToCentury(dated?: string): string | undefined {
  if (!dated) return undefined;
  const match = dated.match(/(\d{3,4})/);
  if (!match) return undefined;
  const year = parseInt(match[1], 10);
  const centuryNum = Math.ceil(year / 100);
  const suffix =
    centuryNum === 1 ? "st" :
    centuryNum === 2 ? "nd" :
    centuryNum === 3 ? "rd" : "th";
  return `${centuryNum}${suffix} century`;
}

export function recordInteraction(artwork: ArtPiece, type: InteractionType): void {
  const vector = getVector();
  const weight = INTERACTION_WEIGHTS[type];

  addWeight(vector.culture, artwork.culture, weight);
  addWeight(vector.classification, artwork.classification, weight);
  addWeight(vector.century, dateToCentury(artwork.dated), weight);
  addWeight(vector.medium, artwork.medium, weight);
  vector.totalInteractions += 1;

  cached = vector;
  saveToStorage(vector);
}

export function getPreferenceVector(): PreferenceVector {
  return getVector();
}

export function computeSimilarity(vector: PreferenceVector, artwork: ArtPiece): number {
  let score = 0;
  const century = dateToCentury(artwork.dated);

  if (artwork.culture && vector.culture[artwork.culture]) {
    score += vector.culture[artwork.culture] * 0.30;
  }
  if (artwork.classification && vector.classification[artwork.classification]) {
    score += vector.classification[artwork.classification] * 0.25;
  }
  if (century && vector.century[century]) {
    score += vector.century[century] * 0.25;
  }
  if (artwork.medium && vector.medium[artwork.medium]) {
    score += vector.medium[artwork.medium] * 0.20;
  }

  return score;
}

/** Reset in-memory cache (reloads from localStorage) */
export function resetPreferences(): void {
  cached = null;
}
```

**Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: All preference engine tests pass.

**Step 6: Create the useTrackInteraction hook**

Create `src/hooks/useTrackInteraction.ts`:

```ts
import { useCallback, useEffect, useRef } from "react";
import type { ArtPiece } from "../types/art";
import { recordInteraction } from "../utils/preferenceEngine";

/**
 * Tracks user interactions with an artwork for the preference engine.
 * Automatically tracks dwell time (view) when the component is visible.
 */
export function useTrackInteraction(artwork: ArtPiece | null) {
  const viewRecorded = useRef(false);
  const mountTime = useRef(Date.now());

  // Track dwell time — record a "view" after 3+ seconds of visibility
  useEffect(() => {
    if (!artwork) return;
    viewRecorded.current = false;
    mountTime.current = Date.now();

    const timer = setTimeout(() => {
      if (!viewRecorded.current) {
        recordInteraction(artwork, "view");
        viewRecorded.current = true;
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [artwork]);

  const trackLike = useCallback(() => {
    if (artwork) recordInteraction(artwork, "like");
  }, [artwork]);

  const trackShare = useCallback(() => {
    if (artwork) recordInteraction(artwork, "share");
  }, [artwork]);

  const trackDetail = useCallback(() => {
    if (artwork) recordInteraction(artwork, "detail");
  }, [artwork]);

  const trackSkip = useCallback(() => {
    if (artwork && !viewRecorded.current) {
      recordInteraction(artwork, "skip");
    }
  }, [artwork]);

  return { trackLike, trackShare, trackDetail, trackSkip };
}
```

**Step 7: Run lint and build**

```bash
npm run test && npm run lint && npm run build
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add user preference engine with interaction tracking and similarity scoring"
```

---

## Task 7: Wire Preference Tracking into ArtCard

**Files:**
- Modify: `src/components/ArtCard.tsx` — add interaction tracking calls

**Step 1: Read ArtCard.tsx to identify insertion points**

The key interaction points in ArtCard are:
- Like button click → `trackLike()`
- Share button click → `trackShare()`
- Title link click (navigate to detail) → `trackDetail()`
- Component becomes visible via scroll snap → auto `trackView()` (via the hook's timer)

**Step 2: Add the useTrackInteraction hook to ArtCard**

At the top of the `ArtCard` component function, add:

```ts
import { useTrackInteraction } from "../hooks/useTrackInteraction";
```

Inside the component:
```ts
const { trackLike, trackShare, trackDetail } = useTrackInteraction(art);
```

Then call `trackLike()` alongside the existing `toggleLike()` in the like handler, `trackShare()` in the share handler, and `trackDetail()` on the title link click.

Note: Do NOT restructure ArtCard — only add the tracking calls at the existing interaction points. The exact insertion points depend on the current handler structure, which the implementing agent should identify by reading the file.

**Step 3: Run lint and build**

```bash
npm run test && npm run lint && npm run build
```

**Step 4: Manual verification**

Open the app, scroll through a few cards, like one, share one. Check localStorage for `arttok-preferences` key — should contain preference vector data.

**Step 5: Commit**

```bash
git add src/components/ArtCard.tsx
git commit -m "feat: wire preference tracking into ArtCard interactions"
```

---

## Task 8: Add likedArtStorage Tests

**Files:**
- Create: `src/utils/__tests__/likedArtStorage.test.ts`

**Step 1: Write tests for likedArtStorage**

Create `src/utils/__tests__/likedArtStorage.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readLikedSet, writeLikedSet, LIKED_ART_STORAGE_KEY, LIKED_ART_STORAGE_EVENT } from '../likedArtStorage';

describe('likedArtStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('readLikedSet', () => {
    it('returns empty set when no data exists', () => {
      expect(readLikedSet().size).toBe(0);
    });

    it('reads stored IDs', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, JSON.stringify([1, 2, 3]));
      const set = readLikedSet();
      expect(set.size).toBe(3);
      expect(set.has(1)).toBe(true);
      expect(set.has(2)).toBe(true);
      expect(set.has(3)).toBe(true);
    });

    it('filters out non-number values', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, JSON.stringify([1, "bad", null, 3]));
      const set = readLikedSet();
      expect(set.size).toBe(2);
      expect(set.has(1)).toBe(true);
      expect(set.has(3)).toBe(true);
    });

    it('handles corrupt JSON gracefully', () => {
      localStorage.setItem(LIKED_ART_STORAGE_KEY, 'not-json');
      expect(readLikedSet().size).toBe(0);
    });
  });

  describe('writeLikedSet', () => {
    it('persists a set to localStorage', () => {
      writeLikedSet(new Set([10, 20]));
      const raw = localStorage.getItem(LIKED_ART_STORAGE_KEY);
      expect(JSON.parse(raw!)).toEqual([10, 20]);
    });

    it('dispatches the custom event', () => {
      const listener = vi.fn();
      window.addEventListener(LIKED_ART_STORAGE_EVENT, listener);

      writeLikedSet(new Set([1]));
      expect(listener).toHaveBeenCalledTimes(1);

      window.removeEventListener(LIKED_ART_STORAGE_EVENT, listener);
    });
  });
});
```

**Step 2: Run tests**

```bash
npm run test
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add -A
git commit -m "test: add likedArtStorage unit tests"
```

---

## Summary: Phase 0 Deliverables

After completing all 8 tasks:

| What | Before | After |
|---|---|---|
| Dead code | MobX stores + LikedArtPanel | Deleted |
| MobX dependency | Installed (unused) | Removed |
| Testing | None | Vitest + 15+ unit tests |
| API architecture | Single hardcoded Harvard service | ArtSource adapter pattern + registry |
| LikedPage | Manual useEffect + Promise.allSettled | React Query hook |
| CategoriesPage | Manual useEffect + cancellation flag | React Query hook |
| Preference engine | None | Full client-side preference tracking + similarity scoring |
| Data model | No source tracking | `source` field on ArtPiece |

**Next:** Phase 1 begins with the "For You" algorithmic feed, which directly uses the preference engine built here.

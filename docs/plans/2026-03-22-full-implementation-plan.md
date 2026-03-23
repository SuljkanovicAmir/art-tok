# ArtTok Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete ArtTok's 33-feature roadmap — from remaining Phase 0 foundation work through Phase 5 polish — transforming it from a single-source art feed into a full culture discovery platform.

**Architecture:** Client-first approach. Every data source implements the existing `ArtSource` interface (`src/services/types.ts`), normalized to `ArtPiece` (`src/types/art.ts`). Preference engine (`src/utils/preferenceEngine.ts`) drives personalization. No backend until Phase 4. TanStack Query for all data fetching. Plain CSS, dark theme, BEM naming.

**Tech Stack:** Vite 6, React 19, TypeScript 5, TanStack Query 5, Vitest, React Router 7

---

## Current State (as of 2026-03-22)

### Done
- **Phase 0:** ArtSource adapter pattern, Harvard adapter, preference engine, interaction tracking, MobX removal, Vitest, React Query migration
- **Phase 1.1:** For You algorithmic feed with preference-based re-ranking + serendipity
- **Phase 1.6:** Scale Reference (human silhouette SVG, dimension parser)
- **Phase 1.7:** Color Palette Extractor (k-means clustering, copy hex, caching)

### Remaining
- **Phase 0:** Met Museum adapter, Art Institute of Chicago adapter, Rijksmuseum adapter, PWA/offline
- **Phase 1:** Time Travel Feed, Mood-Based Discovery, More Like This, Deep Zoom
- **Phases 2-5:** All features

---

## Phase 0 Remaining: Multi-Source Adapters + PWA

### Task 1: Met Museum Adapter

**Files:**
- Create: `src/services/MetAdapter.ts`
- Create: `src/utils/mapMetRecord.ts`
- Create: `src/types/met.ts`
- Create: `src/utils/__tests__/mapMetRecord.test.ts`
- Modify: `src/services/registry.ts` — register Met adapter
- Modify: `src/types/art.ts` — ensure `ArtSourceId` includes `'met'`

**Context:**
- Met API: `https://collectionapi.metmuseum.org/public/collection/v1`
- No API key required
- Two-step: `/search` returns `objectIDs[]`, then `/objects/{id}` for details
- Met returns: `objectID`, `title`, `artistDisplayName`, `primaryImage`, `primaryImageSmall`, `culture`, `objectDate`, `classification`, `medium`, `dimensions`, `objectURL`, `department`, `period`

**Step 1: Write Met type definitions**

```typescript
// src/types/met.ts
export interface MetSearchResponse {
  total: number;
  objectIDs: number[] | null;
}

export interface MetObjectRecord {
  objectID: number;
  title: string;
  artistDisplayName: string;
  primaryImage: string;
  primaryImageSmall: string;
  culture: string;
  objectDate: string;
  classification: string;
  medium: string;
  dimensions: string;
  objectURL: string;
  department: string;
  period: string;
  isPublicDomain: boolean;
}
```

**Step 2: Write the failing mapper test**

```typescript
// src/utils/__tests__/mapMetRecord.test.ts
import { describe, it, expect } from "vitest";
import { mapMetRecord } from "../mapMetRecord";

describe("mapMetRecord", () => {
  it("maps a full Met record to ArtPiece", () => {
    const record = {
      objectID: 45734,
      title: "Sunflowers",
      artistDisplayName: "Vincent van Gogh",
      primaryImage: "https://images.metmuseum.org/full.jpg",
      primaryImageSmall: "https://images.metmuseum.org/small.jpg",
      culture: "Dutch",
      objectDate: "1887",
      classification: "Paintings",
      medium: "Oil on canvas",
      dimensions: "43.2 × 61 cm",
      objectURL: "https://www.metmuseum.org/art/collection/search/45734",
      department: "European Paintings",
      period: "",
      isPublicDomain: true,
    };
    const result = mapMetRecord(record);
    expect(result).toEqual({
      id: 45734,
      imageUrl: "https://images.metmuseum.org/full.jpg",
      title: "Sunflowers",
      artist: "Vincent van Gogh",
      source: "met",
      culture: "Dutch",
      dated: "1887",
      classification: "Paintings",
      medium: "Oil on canvas",
      dimensions: "43.2 × 61 cm",
      url: "https://www.metmuseum.org/art/collection/search/45734",
    });
  });

  it("returns null when no image available", () => {
    const record = {
      objectID: 1,
      title: "No Image",
      artistDisplayName: "",
      primaryImage: "",
      primaryImageSmall: "",
      culture: "",
      objectDate: "",
      classification: "",
      medium: "",
      dimensions: "",
      objectURL: "",
      department: "",
      period: "",
      isPublicDomain: true,
    };
    expect(mapMetRecord(record)).toBeNull();
  });

  it("falls back to primaryImageSmall when primaryImage is empty", () => {
    const record = {
      objectID: 2,
      title: "Small Only",
      artistDisplayName: "Test",
      primaryImage: "",
      primaryImageSmall: "https://images.metmuseum.org/small.jpg",
      culture: "",
      objectDate: "",
      classification: "",
      medium: "",
      dimensions: "",
      objectURL: "",
      department: "",
      period: "",
      isPublicDomain: true,
    };
    const result = mapMetRecord(record);
    expect(result?.imageUrl).toBe("https://images.metmuseum.org/small.jpg");
  });
});
```

**Step 3: Run tests — verify they fail**

Run: `npm run test -- src/utils/__tests__/mapMetRecord.test.ts`
Expected: FAIL — module not found

**Step 4: Implement the mapper**

```typescript
// src/utils/mapMetRecord.ts
import type { ArtPiece } from "../types/art";
import type { MetObjectRecord } from "../types/met";

export function mapMetRecord(record: MetObjectRecord): ArtPiece | null {
  const imageUrl = record.primaryImage || record.primaryImageSmall;
  if (!imageUrl) return null;

  return {
    id: record.objectID,
    imageUrl,
    title: record.title || "Untitled",
    artist: record.artistDisplayName || "Unknown artist",
    source: "met",
    culture: record.culture || undefined,
    dated: record.objectDate || undefined,
    classification: record.classification || undefined,
    medium: record.medium || undefined,
    dimensions: record.dimensions || undefined,
    url: record.objectURL || undefined,
  };
}
```

**Step 5: Run tests — verify they pass**

Run: `npm run test -- src/utils/__tests__/mapMetRecord.test.ts`
Expected: PASS (3 tests)

**Step 6: Commit**

```
feat: add Met Museum record mapper with tests
```

**Step 7: Implement MetAdapter**

```typescript
// src/services/MetAdapter.ts
import type { ArtSource, ArtSourceFeedOptions, ArtSourceFeedResult, ArtSourceSearchOptions, FacetItem } from "./types";
import type { ArtPiece } from "../types/art";
import type { MetSearchResponse, MetObjectRecord } from "../types/met";
import { mapMetRecord } from "../utils/mapMetRecord";

const API_BASE = "https://collectionapi.metmuseum.org/public/collection/v1";

export class MetAdapter implements ArtSource {
  readonly name = "The Metropolitan Museum of Art";
  readonly id = "met" as const;

  async fetchFeed(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult> {
    // Met has no "random" endpoint — search for public domain with images
    const searchRes = await fetch(
      `${API_BASE}/search?hasImages=true&isPublicDomain=true&q=*`
    );
    if (!searchRes.ok) throw new Error(`Met search failed: ${searchRes.status}`);

    const searchData: MetSearchResponse = await searchRes.json();
    const ids = searchData.objectIDs || [];

    // Paginate by slicing the ID array
    const start = (options.page - 1) * options.size;
    const pageIds = ids.slice(start, start + options.size);

    const pieces = await this.fetchBatch(pageIds);

    return {
      pieces,
      hasNext: start + options.size < ids.length,
      total: ids.length,
    };
  }

  async search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult> {
    const query = options.keyword || "*";
    const params = new URLSearchParams({ q: query, hasImages: "true" });
    if (options.medium) params.set("medium", options.medium);

    const searchRes = await fetch(`${API_BASE}/search?${params}`);
    if (!searchRes.ok) throw new Error(`Met search failed: ${searchRes.status}`);

    const searchData: MetSearchResponse = await searchRes.json();
    const ids = searchData.objectIDs || [];

    const start = (options.page - 1) * options.size;
    const pageIds = ids.slice(start, start + options.size);
    const pieces = await this.fetchBatch(pageIds);

    return {
      pieces,
      hasNext: start + options.size < ids.length,
      total: ids.length,
    };
  }

  async fetchById(id: number): Promise<ArtPiece | null> {
    const res = await fetch(`${API_BASE}/objects/${id}`);
    if (!res.ok) return null;
    const record: MetObjectRecord = await res.json();
    return mapMetRecord(record);
  }

  async fetchFacet(_facet: string, _size: number): Promise<FacetItem[]> {
    // Met API does not support facet queries — return empty
    return [];
  }

  private async fetchBatch(ids: number[]): Promise<ArtPiece[]> {
    const results = await Promise.allSettled(
      ids.map((id) => this.fetchById(id))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ArtPiece | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((p): p is ArtPiece => p !== null);
  }
}
```

**Step 8: Register Met adapter**

In `src/services/registry.ts`, add:
```typescript
import { MetAdapter } from "./MetAdapter";
// after Harvard registration:
artRegistry.register(new MetAdapter());
```

**Step 9: Run lint + build**

Run: `npm run lint && npm run build`
Expected: PASS

**Step 10: Commit**

```
feat: add Met Museum API adapter with search and feed support
```

---

### Task 2: Art Institute of Chicago Adapter

**Files:**
- Create: `src/services/ArticAdapter.ts`
- Create: `src/utils/mapArticRecord.ts`
- Create: `src/types/artic.ts`
- Create: `src/utils/__tests__/mapArticRecord.test.ts`
- Modify: `src/services/registry.ts`

**Context:**
- ArtIC API: `https://api.artic.edu/api/v1`
- No API key required
- Single-step: `/artworks?params` returns paginated results
- Images via IIIF: `https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg`
- Returns: `id`, `title`, `artist_title`, `image_id`, `date_display`, `place_of_origin`, `classification_title`, `medium_display`, `dimensions`, `thumbnail.alt_text`

**Step 1: Write ArtIC types**

```typescript
// src/types/artic.ts
export interface ArticPagination {
  total: number;
  limit: number;
  offset: number;
  total_pages: number;
  current_page: number;
  next_url: string | null;
}

export interface ArticRecord {
  id: number;
  title: string;
  artist_title: string | null;
  image_id: string | null;
  date_display: string | null;
  place_of_origin: string | null;
  classification_title: string | null;
  medium_display: string | null;
  dimensions: string | null;
}

export interface ArticResponse {
  pagination: ArticPagination;
  data: ArticRecord[];
}
```

**Step 2: Write mapper test**

```typescript
// src/utils/__tests__/mapArticRecord.test.ts
import { describe, it, expect } from "vitest";
import { mapArticRecord } from "../mapArticRecord";

describe("mapArticRecord", () => {
  it("maps full record to ArtPiece with IIIF image URL", () => {
    const record = {
      id: 27992,
      title: "A Sunday on La Grande Jatte",
      artist_title: "Georges Seurat",
      image_id: "2d484387-2509-5e8e-2c43-22f9981972eb",
      date_display: "1884–86",
      place_of_origin: "France",
      classification_title: "Painting",
      medium_display: "Oil on canvas",
      dimensions: "207.5 × 308.1 cm",
    };
    const result = mapArticRecord(record);
    expect(result).toEqual({
      id: 27992,
      imageUrl: "https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg",
      title: "A Sunday on La Grande Jatte",
      artist: "Georges Seurat",
      source: "artic",
      culture: "France",
      dated: "1884–86",
      classification: "Painting",
      medium: "Oil on canvas",
      dimensions: "207.5 × 308.1 cm",
      url: "https://www.artic.edu/artworks/27992",
    });
  });

  it("returns null when no image_id", () => {
    const record = {
      id: 1, title: "No Image", artist_title: null, image_id: null,
      date_display: null, place_of_origin: null, classification_title: null,
      medium_display: null, dimensions: null,
    };
    expect(mapArticRecord(record)).toBeNull();
  });
});
```

**Step 3: Run tests — verify they fail**

Run: `npm run test -- src/utils/__tests__/mapArticRecord.test.ts`

**Step 4: Implement mapper**

```typescript
// src/utils/mapArticRecord.ts
import type { ArtPiece } from "../types/art";
import type { ArticRecord } from "../types/artic";

const IIIF_BASE = "https://www.artic.edu/iiif/2";

export function mapArticRecord(record: ArticRecord): ArtPiece | null {
  if (!record.image_id) return null;

  return {
    id: record.id,
    imageUrl: `${IIIF_BASE}/${record.image_id}/full/843,/0/default.jpg`,
    title: record.title || "Untitled",
    artist: record.artist_title || "Unknown artist",
    source: "artic",
    culture: record.place_of_origin || undefined,
    dated: record.date_display || undefined,
    classification: record.classification_title || undefined,
    medium: record.medium_display || undefined,
    dimensions: record.dimensions || undefined,
    url: `https://www.artic.edu/artworks/${record.id}`,
  };
}
```

**Step 5: Run tests — verify pass**

**Step 6: Implement ArticAdapter**

```typescript
// src/services/ArticAdapter.ts
import type { ArtSource, ArtSourceFeedOptions, ArtSourceFeedResult, ArtSourceSearchOptions, FacetItem } from "./types";
import type { ArtPiece } from "../types/art";
import type { ArticResponse } from "../types/artic";
import { mapArticRecord } from "../utils/mapArticRecord";

const API_BASE = "https://api.artic.edu/api/v1";
const FIELDS = "id,title,artist_title,image_id,date_display,place_of_origin,classification_title,medium_display,dimensions";

export class ArticAdapter implements ArtSource {
  readonly name = "Art Institute of Chicago";
  readonly id = "artic" as const;

  async fetchFeed(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult> {
    const params = new URLSearchParams({
      page: String(options.page),
      limit: String(options.size),
      fields: FIELDS,
    });

    // Only artworks with images
    const body = {
      query: { term: { is_public_domain: true } },
      sort: [{ _score: "desc" }],
    };

    const res = await fetch(`${API_BASE}/artworks/search?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`ArtIC feed failed: ${res.status}`);
    const data: ArticResponse = await res.json();

    const pieces = data.data
      .map(mapArticRecord)
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: data.pagination.current_page < data.pagination.total_pages,
      total: data.pagination.total,
    };
  }

  async search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult> {
    const params = new URLSearchParams({
      q: options.keyword || "",
      page: String(options.page),
      limit: String(options.size),
      fields: FIELDS,
    });

    const res = await fetch(`${API_BASE}/artworks/search?${params}`);
    if (!res.ok) throw new Error(`ArtIC search failed: ${res.status}`);
    const data: ArticResponse = await res.json();

    const pieces = data.data
      .map(mapArticRecord)
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: data.pagination.current_page < data.pagination.total_pages,
      total: data.pagination.total,
    };
  }

  async fetchById(id: number): Promise<ArtPiece | null> {
    const res = await fetch(`${API_BASE}/artworks/${id}?fields=${FIELDS}`);
    if (!res.ok) return null;
    const data = await res.json();
    return mapArticRecord(data.data);
  }

  async fetchFacet(_facet: string, _size: number): Promise<FacetItem[]> {
    return [];
  }
}
```

**Step 7: Register + lint + build + commit**

```
feat: add Art Institute of Chicago API adapter
```

---

### Task 3: Multi-Source Feed Mixing

**Files:**
- Modify: `src/services/ArtSourceRegistry.ts` — add `fetchFeedFromAll()` method
- Modify: `src/hooks/useFeedQuery.ts` — use multi-source feed
- Create: `src/utils/__tests__/feedMixing.test.ts`

**What this does:** Instead of only showing Harvard art, the feed pulls from all registered sources in a round-robin fashion, giving users art from Harvard, Met, and ArtIC in every page.

**Step 1: Add `fetchFeedFromAll` to ArtSourceRegistry**

```typescript
async fetchFeedFromAll(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult> {
  const sources = this.getAllSources();
  if (sources.length === 0) throw new Error("No art sources registered");

  const perSource = Math.ceil(options.size / sources.length);
  const results = await Promise.allSettled(
    sources.map((s) => s.fetchFeed({ ...options, size: perSource }))
  );

  const allPieces: ArtPiece[] = [];
  let hasNext = false;

  for (const result of results) {
    if (result.status === "fulfilled") {
      allPieces.push(...result.value.pieces);
      if (result.value.hasNext) hasNext = true;
    }
  }

  // Interleave by source for variety
  const bySource = new Map<string, ArtPiece[]>();
  for (const piece of allPieces) {
    const arr = bySource.get(piece.source) || [];
    arr.push(piece);
    bySource.set(piece.source, arr);
  }

  const interleaved: ArtPiece[] = [];
  const sourceArrays = Array.from(bySource.values());
  const maxLen = Math.max(...sourceArrays.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of sourceArrays) {
      if (i < arr.length) interleaved.push(arr[i]);
    }
  }

  return { pieces: interleaved.slice(0, options.size), hasNext };
}
```

**Step 2: Update `useFeedQuery` to use `fetchFeedFromAll`**

In `src/hooks/useFeedQuery.ts`, change:
```typescript
const result = await artRegistry.fetchFeed({ page: pageParam, size: FETCH_SIZE });
```
to:
```typescript
const result = await artRegistry.fetchFeedFromAll({ page: pageParam, size: FETCH_SIZE });
```

**Step 3: Update ArtCard museum link to be source-aware**

In `src/components/ArtCard.tsx`, change the museum link text from hardcoded "View at Harvard Art Museums" to dynamic based on `art.source`.

**Step 4: Run lint + build + commit**

```
feat: multi-source feed mixing — interleave Harvard, Met, and ArtIC artworks
```

---

### Task 4: PWA + Offline Shell (Phase 0.3)

**Files:**
- Create: `public/manifest.json`
- Create: `src/sw.ts` (via vite-plugin-pwa)
- Modify: `index.html` — link manifest
- Modify: `package.json` — add `vite-plugin-pwa`
- Modify: `vite.config.ts` — add PWA plugin

**Step 1: Install vite-plugin-pwa**

Run: `npm install -D vite-plugin-pwa`

**Step 2: Add PWA config to vite.config.ts**

```typescript
import { VitePWA } from "vite-plugin-pwa";

// Add to plugins array:
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "ArtTok — Discover Art",
    short_name: "ArtTok",
    description: "TikTok-style vertical art discovery feed",
    theme_color: "#050505",
    background_color: "#050505",
    display: "standalone",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/nrs\.harvard\.edu\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "artwork-images", expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 } },
      },
      {
        urlPattern: /^https:\/\/images\.metmuseum\.org\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "met-images", expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 } },
      },
      {
        urlPattern: /^https:\/\/www\.artic\.edu\/iiif\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "artic-images", expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 } },
      },
      {
        urlPattern: /^https:\/\/api\.harvardartmuseums\.org\/.*/i,
        handler: "NetworkFirst",
        options: { cacheName: "harvard-api", expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 } },
      },
    ],
  },
})
```

**Step 3: Create placeholder icons**

Create simple SVG-based PNG icons at `public/icon-192.png` and `public/icon-512.png` (can be generated or placeholder).

**Step 4: Run build + verify SW output + commit**

```
feat: add PWA support with offline image caching
```

---

## Phase 1: Remaining Core Discovery Features

### Task 5: Time Travel Feed (Phase 1.2)

**Files:**
- Create: `src/components/TimeTravelSlider.tsx`
- Create: `src/hooks/useTimeTravelFeed.ts`
- Modify: `src/pages/FeedPage.tsx` — add toggle + slider
- Modify: `src/App.css` — slider styles

**What this does:** A horizontal slider from 3000 BCE to 2025 CE. Scrubbing the slider fetches artworks from that century range. Snaps to century markers.

**Step 1: Create the Time Travel hook**

```typescript
// src/hooks/useTimeTravelFeed.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtPiece } from "../types/art";

export function useTimeTravelFeed(century: string | null) {
  return useInfiniteQuery({
    queryKey: ["time-travel", century],
    queryFn: async ({ pageParam }) => {
      if (!century) return { pieces: [] as ArtPiece[], hasNext: false };
      return artRegistry.search({
        century,
        page: pageParam,
        size: 10,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
    enabled: !!century,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Step 2: Create TimeTravelSlider component**

```typescript
// src/components/TimeTravelSlider.tsx
import { useState, useCallback } from "react";

interface TimeTravelSliderProps {
  onCenturyChange: (century: string) => void;
}

const CENTURIES = [
  { value: "30th century BCE", label: "3000 BCE", year: -3000 },
  { value: "20th century BCE", label: "2000 BCE", year: -2000 },
  { value: "10th century BCE", label: "1000 BCE", year: -1000 },
  { value: "5th century BCE", label: "500 BCE", year: -500 },
  { value: "1st century", label: "1 CE", year: 1 },
  { value: "5th century", label: "500s", year: 500 },
  { value: "10th century", label: "900s", year: 900 },
  { value: "12th century", label: "1100s", year: 1100 },
  { value: "14th century", label: "1300s", year: 1300 },
  { value: "15th century", label: "1400s", year: 1400 },
  { value: "16th century", label: "1500s", year: 1500 },
  { value: "17th century", label: "1600s", year: 1600 },
  { value: "18th century", label: "1700s", year: 1700 },
  { value: "19th century", label: "1800s", year: 1800 },
  { value: "20th century", label: "1900s", year: 1900 },
  { value: "21st century", label: "2000s", year: 2000 },
];

// Context labels for each century
const CENTURY_CONTEXT: Record<string, string> = {
  "19th century": "Impressionism, Photography invented",
  "20th century": "Modern Art, Abstract Expressionism",
  "17th century": "Dutch Golden Age, Baroque",
  "18th century": "Rococo, Neoclassicism",
  "16th century": "High Renaissance, Mannerism",
  "15th century": "Early Renaissance",
  "14th century": "Late Gothic, Proto-Renaissance",
  "21st century": "Contemporary, Digital Art",
};

export function TimeTravelSlider({ onCenturyChange }: TimeTravelSliderProps) {
  const [index, setIndex] = useState(13); // Default: 19th century

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const i = Number(e.target.value);
      setIndex(i);
      onCenturyChange(CENTURIES[i].value);
    },
    [onCenturyChange]
  );

  const current = CENTURIES[index];
  const context = CENTURY_CONTEXT[current.value] || "";

  return (
    <div className="time-travel">
      <div className="time-travel__label">
        <span className="time-travel__century">{current.label}</span>
        {context && <span className="time-travel__context">{context}</span>}
      </div>
      <input
        type="range"
        className="time-travel__slider"
        min={0}
        max={CENTURIES.length - 1}
        value={index}
        onChange={handleChange}
        aria-label="Select century"
      />
      <div className="time-travel__range">
        <span>3000 BCE</span>
        <span>2000s</span>
      </div>
    </div>
  );
}
```

**Step 3: Integrate into FeedPage**

Add a toggle button in the feed header. When active, show `TimeTravelSlider` below header and use `useTimeTravelFeed` instead of the default feed. When inactive, show normal feed.

**Step 4: Add CSS for the slider**

Dark-themed slider with accent color track, snap feel, frosted-glass century label.

**Step 5: Run lint + build + commit**

```
feat: add Time Travel feed — scrub through centuries of art
```

---

### Task 6: Mood-Based Discovery (Phase 1.3)

**Files:**
- Create: `src/utils/moodClassifier.ts`
- Create: `src/components/MoodSelector.tsx`
- Create: `src/hooks/useMoodFeed.ts`
- Create: `src/utils/__tests__/moodClassifier.test.ts`
- Modify: `src/pages/FeedPage.tsx` — add mood pill bar
- Modify: `src/App.css`

**What this does:** A horizontal pill bar of moods (Calm, Energized, Melancholy, Awestruck, Romantic, Rebellious). Selecting a mood filters artworks by rule-based mood classification using dominant colors + keyword matching on description/culture fields.

**Step 1: Define mood rules and classifier**

```typescript
// src/utils/moodClassifier.ts
export type Mood = "calm" | "energized" | "melancholy" | "awestruck" | "romantic" | "rebellious";

export const MOOD_LABELS: Record<Mood, string> = {
  calm: "Calm",
  energized: "Energized",
  melancholy: "Melancholy",
  awestruck: "Awestruck",
  romantic: "Romantic",
  rebellious: "Rebellious",
};

interface MoodRule {
  keywords: string[];
  classifications: string[];
  cultures: string[];
}

const MOOD_RULES: Record<Mood, MoodRule> = {
  calm: {
    keywords: ["serene", "peaceful", "landscape", "garden", "water", "lake", "pastoral", "quiet", "still life"],
    classifications: ["Paintings", "Prints"],
    cultures: ["Japanese", "Chinese"],
  },
  energized: {
    keywords: ["battle", "dance", "festival", "bright", "movement", "sport", "celebration", "war"],
    classifications: ["Paintings", "Sculpture"],
    cultures: ["Italian", "Spanish"],
  },
  melancholy: {
    keywords: ["dark", "shadow", "death", "night", "winter", "ruin", "mourning", "solitude"],
    classifications: ["Paintings", "Prints", "Drawings"],
    cultures: ["Northern European", "German"],
  },
  awestruck: {
    keywords: ["sublime", "mountain", "vast", "ocean", "cathedral", "monumental", "epic", "grand"],
    classifications: ["Paintings"],
    cultures: ["American", "British"],
  },
  romantic: {
    keywords: ["love", "couple", "beauty", "flower", "portrait", "venus", "embrace", "garden"],
    classifications: ["Paintings", "Sculpture"],
    cultures: ["French", "Italian"],
  },
  rebellious: {
    keywords: ["revolution", "protest", "abstract", "modern", "avant-garde", "bold", "experimental"],
    classifications: ["Paintings", "Prints"],
    cultures: ["American", "German", "Russian"],
  },
};

/** Build search keywords for a given mood to send to the API */
export function getMoodSearchTerms(mood: Mood): { keywords: string[]; culture?: string; classification?: string } {
  const rule = MOOD_RULES[mood];
  return {
    keywords: rule.keywords,
    culture: rule.cultures[0], // Primary culture association
    classification: rule.classifications[0],
  };
}
```

**Step 2: Create MoodSelector component**

Horizontal scrollable pill bar. Tapping a mood filters the feed. Tapping active mood deselects it.

**Step 3: Create useMoodFeed hook**

Searches across registered sources using mood keywords, culture, and classification filters.

**Step 4: Integrate into FeedPage — mood selector above the feed cards**

**Step 5: Add CSS — dark pills with accent border on active state**

**Step 6: Commit**

```
feat: add mood-based discovery — filter feed by emotional tone
```

---

### Task 7: "More Like This" (Phase 1.4)

**Files:**
- Create: `src/components/MoreLikeThis.tsx`
- Create: `src/hooks/useMoreLikeThis.ts`
- Modify: `src/pages/ArtworkDetailPage.tsx` — add More Like This section
- Modify: `src/App.css`

**What this does:** On any artwork detail page, a "More Like This" button shows a horizontal carousel of similar artworks — same classification, similar century range (±100 years), similar culture.

**Step 1: Create the hook**

```typescript
// src/hooks/useMoreLikeThis.ts
import { useQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtPiece } from "../types/art";

export function useMoreLikeThis(artwork: ArtPiece | null) {
  return useQuery({
    queryKey: ["more-like-this", artwork?.id],
    queryFn: async () => {
      if (!artwork) return [];
      const result = await artRegistry.search({
        classification: artwork.classification,
        culture: artwork.culture,
        page: 1,
        size: 12,
      });
      // Exclude the current artwork
      return result.pieces.filter((p) => p.id !== artwork.id).slice(0, 8);
    },
    enabled: !!artwork,
    staleTime: 10 * 60 * 1000,
  });
}
```

**Step 2: Create MoreLikeThis component**

Horizontal scrollable row of artwork thumbnails. Each links to `/artwork/:id`.

**Step 3: Add to ArtworkDetailPage below the metadata section**

**Step 4: CSS — horizontal scroll container with snap, dark card style**

**Step 5: Commit**

```
feat: add "More Like This" similar artwork carousel on detail page
```

---

### Task 8: Deep Zoom (Phase 1.5)

**Files:**
- Create: `src/components/DeepZoom.tsx`
- Modify: `src/pages/ArtworkDetailPage.tsx` — add zoom button
- Modify: `package.json` — add `openseadragon`
- Modify: `src/App.css`

**What this does:** Tapping "Into the Brushstrokes" on the detail page opens a full-screen zoomable viewer using OpenSeadragon. Uses the high-res `primaryimageurl` from Harvard (or equivalent from other sources).

**Step 1: Install OpenSeadragon**

Run: `npm install openseadragon && npm install -D @types/openseadragon`

**Step 2: Create DeepZoom component**

```typescript
// src/components/DeepZoom.tsx
import { useRef, useEffect, useState } from "react";
import OpenSeadragon from "openseadragon";

interface DeepZoomProps {
  imageUrl: string;
  title: string;
  onClose: () => void;
}

export function DeepZoom({ imageUrl, title, onClose }: DeepZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    viewerRef.current = OpenSeadragon({
      element: containerRef.current,
      tileSources: {
        type: "image",
        url: imageUrl,
      },
      showNavigationControl: true,
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT",
      minZoomLevel: 0.5,
      maxZoomLevel: 10,
      visibilityRatio: 0.5,
      constrainDuringPan: true,
    });

    viewerRef.current.addHandler("open", () => setIsLoading(false));

    return () => {
      viewerRef.current?.destroy();
    };
  }, [imageUrl]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="deep-zoom" role="dialog" aria-label={`Zoom view of ${title}`}>
      <button
        type="button"
        className="deep-zoom__close"
        onClick={onClose}
        aria-label="Close zoom view"
      >
        &times;
      </button>
      {isLoading && <div className="deep-zoom__loading">Loading high-res image...</div>}
      <div className="deep-zoom__viewport" ref={containerRef} />
    </div>
  );
}
```

**Step 3: Add zoom button to ArtworkDetailPage**

Add "Into the Brushstrokes" button that toggles `DeepZoom` overlay.

**Step 4: CSS — full-screen overlay with dark background, z-index above everything**

**Step 5: Commit**

```
feat: add Deep Zoom viewer for extreme magnification of artworks
```

---

## Phase 2: AI + Deep Discovery

### Task 9: AI Art Narrator (Phase 2.1)

**Files:**
- Create: `src/components/ArtNarrator.tsx`
- Create: `src/hooks/useNarration.ts`
- Create: `src/utils/narratorPrompts.ts`
- Modify: `src/pages/ArtworkDetailPage.tsx`
- Modify: `src/App.css`

**What this does:** A headphones button on the detail page. Tap → select voice (casual, academic, poetic, kids) → AI generates narration text from artwork metadata → Web Speech API reads it aloud.

**Implementation notes:**
- Requires Claude API key (new env var: `VITE_ANTHROPIC_API_KEY`) OR a proxy backend
- Alternatively: use a free endpoint or build a simple Vercel serverless function
- For V1, use Web Speech API (free TTS) with generated text
- Cache narration text per artwork ID + voice in localStorage

**Key decisions:**
- Voice prompts defined in `src/utils/narratorPrompts.ts`
- UI: expandable player at bottom of detail page with play/pause/voice selector
- Rate limit: cache aggressively so repeated visits don't re-call the API

**Commit:**
```
feat: add AI Art Narrator with multiple voice modes and TTS playback
```

---

### Task 10: "Ask About This Art" Chat (Phase 2.2)

**Files:**
- Create: `src/components/ArtChat.tsx`
- Create: `src/hooks/useArtChat.ts`
- Modify: `src/pages/ArtworkDetailPage.tsx`
- Modify: `src/App.css`

**What this does:** Chat panel slides up from bottom on artwork detail. User asks questions about the artwork. LLM responds with artwork metadata as context. Suggested question chips. 10 messages per artwork session.

**Implementation notes:**
- Same API setup as narrator (Claude API or proxy)
- System prompt includes full artwork metadata as context
- Conversation history held in component state (not persisted)
- Suggested chips: "Tell me about the technique", "What's the story?", "What was happening when this was made?"

**Commit:**
```
feat: add conversational AI chat for artwork exploration
```

---

### Task 11: Art Connections — Knowledge Graph (Phase 2.3)

**Files:**
- Create: `src/components/ArtGraph.tsx`
- Create: `src/hooks/useArtConnections.ts`
- Modify: `src/pages/ArtworkDetailPage.tsx`
- Modify: `package.json` — add `d3` (force layout only)

**What this does:** D3 force-directed graph showing connections between artworks. Center = current artwork. Connected nodes = same artist, same culture, same classification, same gallery. Click node → navigate.

**Implementation notes:**
- Install `d3-force` and `d3-selection` (not full D3)
- Build adjacency from API queries: search by artist, culture, classification
- Limit to 2 degrees of separation, max ~30 nodes
- SVG rendering within a full-screen view accessible from detail page

**Commit:**
```
feat: add Art Connections knowledge graph visualization
```

---

### Task 12: "Art Across Cultures" — Parallel Traditions (Phase 2.4)

**Files:**
- Create: `src/pages/ParallelTraditionsPage.tsx`
- Create: `src/hooks/useParallelArt.ts`
- Modify: `src/App.tsx` — add route `/parallel`
- Modify: `src/components/BottomNav.tsx` — add nav item (or accessible from detail page)

**What this does:** Split-screen showing artworks from different cultures created simultaneously. Swipe either side for next match.

**Commit:**
```
feat: add Parallel Traditions — cross-cultural artwork comparisons
```

---

### Task 13: Artist Timeline (Phase 2.5)

**Files:**
- Create: `src/pages/ArtistTimelinePage.tsx`
- Create: `src/hooks/useArtistWorks.ts`
- Modify: `src/App.tsx` — add route `/artist/:name`
- Modify: `src/pages/ArtworkDetailPage.tsx` — link artist name to timeline

**What this does:** Horizontal scrollable timeline of all works by a given artist, positioned by date. Click thumbnail → detail page.

**Commit:**
```
feat: add Artist Timeline showing career evolution
```

---

### Task 14: Style DNA — Personal Taste Analysis (Phase 2.6)

**Files:**
- Create: `src/pages/StyleDNAPage.tsx`
- Create: `src/utils/styleDNA.ts`
- Create: `src/utils/__tests__/styleDNA.test.ts`
- Modify: `src/App.tsx` — add route `/style-dna`
- Modify: `src/App.css`

**What this does:** After 20+ likes, generate a taste profile. Show distributions: culture %, century %, classification %. Match against pre-defined movement profiles. Shareable as Canvas-generated image.

**Commit:**
```
feat: add Style DNA — personal taste analysis with movement matching
```

---

## Phase 3: Engagement & Gamification

### Task 15: Daily Streak & Art Calendar (Phase 3.1)

**Files:**
- Create: `src/utils/streakTracker.ts`
- Create: `src/components/StreakBadge.tsx`
- Create: `src/pages/StreakCalendarPage.tsx`
- Create: `src/utils/__tests__/streakTracker.test.ts`

**What this does:** localStorage-based streak counter. Flame icon in header with streak count. Calendar page with artwork thumbnails per active day.

**Commit:** `feat: add daily streak tracking with calendar visualization`

---

### Task 16: Art Knowledge Quizzes (Phase 3.2)

**Files:**
- Create: `src/pages/QuizPage.tsx`
- Create: `src/utils/quizGenerator.ts`
- Create: `src/utils/__tests__/quizGenerator.test.ts`

**What this does:** Auto-generated quizzes from artwork metadata. Types: century, culture, classification, "which is older?" 3 difficulty tiers. Scores tracked in localStorage.

**Commit:** `feat: add art knowledge quizzes with auto-generated questions`

---

### Task 17: Collector Badges & Achievements (Phase 3.3)

**Files:**
- Create: `src/utils/badgeDefinitions.ts`
- Create: `src/components/BadgeToast.tsx`
- Create: `src/pages/AchievementsPage.tsx`

**What this does:** Badge config array with typed criteria functions. Check on every like. Toast notification on unlock. Profile page with unlocked/locked badges.

**Commit:** `feat: add collector badges and achievement system`

---

### Task 18: "Art Roulette" (Phase 3.4)

**Files:**
- Create: `src/pages/ArtRoulettePage.tsx`
- Create: `src/utils/rouletteAnalyzer.ts`

**What this does:** 20-round binary choice game. Two contrasting artworks per round. Pick one. After all rounds, reveal taste patterns. Results feed into preference engine.

**Commit:** `feat: add Art Roulette preference game with taste reveal`

---

### Task 19: "ArtTok Wrapped" (Phase 3.5)

**Files:**
- Create: `src/pages/WrappedPage.tsx`
- Create: `src/utils/wrappedStats.ts`
- Create: `src/utils/wrappedCardRenderer.ts`

**What this does:** Animated story cards (Instagram Stories format) showing personalized recap: total viewed, favorite century, rarest find, taste evolution. Canvas API → shareable image.

**Commit:** `feat: add ArtTok Wrapped — personalized art discovery recap`

---

### Task 20: Story Cards for Social Sharing (Phase 3.7)

**Files:**
- Create: `src/utils/storyCardRenderer.ts`
- Create: `src/components/StoryCardPreview.tsx`
- Modify: `src/components/ArtCard.tsx` — add "Story" share option
- Modify: `src/pages/ArtworkDetailPage.tsx`

**What this does:** Canvas API renders 1080x1920 Instagram Story cards with artwork + metadata + subtle ArtTok branding. 7 templates (Cinematic, Museum Label, Color Story, Did You Know?, Taste Card, Versus, Streak). Download or Web Share API.

**Commit:** `feat: add Story Cards — shareable Instagram-style art cards`

---

### Task 21: "Surprise Me" / Serendipity Mode (Phase 3.8)

**Files:**
- Create: `src/hooks/useSerendipityFeed.ts`
- Modify: `src/pages/FeedPage.tsx` — add toggle

**What this does:** Inverts preference vector — boosts lowest-scored attributes, suppresses highest. Distinct visual treatment (dice badge).

**Commit:** `feat: add Surprise Me mode — break the algorithm for serendipity`

---

## Phase 4: Social & Community

> **Note:** Phase 4 requires a backend (Supabase or Firebase). All tasks below assume Supabase setup.

### Task 22: Supabase Backend Setup

**Files:**
- Create: `src/services/supabase.ts`
- Modify: `package.json` — add `@supabase/supabase-js`
- Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**What this does:** Initialize Supabase client. Create tables: `collections`, `collection_items`, `reviews`, `daily_art`, `challenges`.

**Commit:** `feat: add Supabase backend setup for social features`

---

### Task 23: Art Collections / Boards (Phase 4.1)

**Files:**
- Create: `src/pages/CollectionsPage.tsx`
- Create: `src/pages/CollectionDetailPage.tsx`
- Create: `src/hooks/useCollections.ts`
- Create: `src/utils/collectionStorage.ts`

**What this does:** Named, themed collections. V1: localStorage. V2: Supabase. "Add to collection" on every artwork. Collection browser as grid of covers. Shareable via URL.

**Commit:** `feat: add Art Collections — named boards for curating artworks`

---

### Task 24: "Art Taste Match" (Phase 4.2)

**Files:**
- Create: `src/pages/TasteMatchPage.tsx`
- Create: `src/utils/tasteMatchEncoder.ts`

**What this does:** Export taste vector as base64 URL. Share → friend opens → cosine similarity comparison. No backend needed.

**Commit:** `feat: add Art Taste Match — compare preferences with friends`

---

### Task 25: Remaining Social Features (Phases 4.3–4.6)

- **4.3 Art Critic Micro-Reviews** — 280-char reactions with structured prompts (requires Supabase)
- **4.4 Art of the Day Community Vote** — 4 daily nominees, community voting (requires Supabase)
- **4.5 Collaborative Collections** — Shared boards with real-time sync (requires Supabase Realtime)
- **4.6 Art Gifts** — Personalized greeting cards with Canvas API rendering

Each is a separate commit.

---

## Phase 5: Quality of Life & Polish

### Task 26: Artwork as Wallpaper (Phase 5.3 — User Priority)

**Files:**
- Create: `src/components/WallpaperDownloader.tsx`
- Create: `src/utils/wallpaperGenerator.ts`
- Modify: `src/pages/ArtworkDetailPage.tsx`

**What this does:** One-tap download any artwork sized for device. Canvas API scales/crops to `screen.width * devicePixelRatio` x `screen.height * devicePixelRatio`. Crop options: fill, fit (letterbox), auto. Download via anchor click.

**Commit:** `feat: add Artwork as Wallpaper — one-tap device-sized downloads`

---

### Task 27: Quiet Mode (Phase 5.1)

**Files:**
- Create: `src/hooks/useQuietMode.ts`
- Modify: `src/pages/FeedPage.tsx`
- Modify: `src/App.css`

**What this does:** Toggle all UI chrome to `opacity: 0` + `pointer-events: none`. Just the artwork. Auto-hide after 5s inactivity. Tap to restore.

**Commit:** `feat: add Quiet Mode — distraction-free artwork viewing`

---

### Task 28: Adjustable Information Density (Phase 5.2)

**Files:**
- Modify: `src/components/ArtCard.tsx`
- Create: `src/hooks/useInfoDensity.ts`
- Modify: `src/App.css`

**What this does:** Slider from level 1 ("Just Vibes" — image only) to level 5 ("Tell Me Everything" — full metadata). CSS classes toggle section visibility. Stored in localStorage.

**Commit:** `feat: add adjustable information density on art cards`

---

### Task 29: Accessibility — Colorblind + High Contrast + Text Size (Phases 5.4–5.5)

**Files:**
- Create: `src/hooks/useAccessibilitySettings.ts`
- Create: `src/pages/SettingsPage.tsx`
- Modify: `src/App.css` — high contrast overrides
- Modify: `src/App.tsx` — add `/settings` route

**What this does:** Settings page with colorblind mode toggle (text color descriptions), high contrast mode (WCAG AAA), and text size multiplier via `--base-font-size` CSS property.

**Commit:** `feat: add accessibility settings — colorblind, high contrast, text sizing`

---

### Task 30: Museum Visit Planner (Phase 5.6)

**Files:**
- Create: `src/pages/MuseumPlannerPage.tsx`
- Create: `src/hooks/useNearbyMuseums.ts`

**What this does:** Shows galleries containing liked artworks. Groups by museum/floor. Uses Geolocation API for nearby. Links to Google Maps.

**Commit:** `feat: add Museum Visit Planner for liked artworks`

---

## Dependency Graph

```
Phase 0 (remaining)
├── Task 1: Met Adapter ─────────────────────┐
├── Task 2: ArtIC Adapter ───────────────────┤
├── Task 3: Multi-Source Feed Mixing ────────┤ (depends on Tasks 1-2)
└── Task 4: PWA ─────────────────────────────┘

Phase 1 (remaining)
├── Task 5: Time Travel ─────────── (independent)
├── Task 6: Mood Discovery ──────── (independent)
├── Task 7: More Like This ──────── (independent)
└── Task 8: Deep Zoom ───────────── (independent)

Phase 2
├── Task 9: AI Narrator ─────────── (needs API key decision)
├── Task 10: Ask AI Chat ────────── (needs Task 9 API setup)
├── Task 11: Knowledge Graph ────── (independent)
├── Task 12: Parallel Traditions ── (independent)
├── Task 13: Artist Timeline ────── (independent)
└── Task 14: Style DNA ──────────── (depends on preference engine — done)

Phase 3
├── Task 15: Streaks ────────────── (independent)
├── Task 16: Quizzes ────────────── (independent)
├── Task 17: Badges ─────────────── (independent)
├── Task 18: Art Roulette ───────── (independent)
├── Task 19: Wrapped ────────────── (depends on Tasks 15-17 data)
├── Task 20: Story Cards ────────── (depends on color palette — done)
└── Task 21: Surprise Me ────────── (depends on preference engine — done)

Phase 4
├── Task 22: Supabase Setup ─────── (prerequisite for 23-25)
├── Task 23: Collections ────────── (V1 localStorage, V2 Supabase)
├── Task 24: Taste Match ────────── (independent — no backend needed)
└── Task 25: Social Features ────── (depends on Task 22)

Phase 5
├── Task 26: Wallpaper ──────────── (independent — user priority)
├── Task 27: Quiet Mode ─────────── (independent)
├── Task 28: Info Density ───────── (independent)
├── Task 29: Accessibility ──────── (independent)
└── Task 30: Museum Planner ─────── (independent)
```

## Parallelization Strategy

**Within each phase, many tasks are independent and can be run in parallel:**

- **Phase 0:** Tasks 1+2 in parallel → Task 3 after both → Task 4 independently
- **Phase 1:** All 4 tasks (5, 6, 7, 8) can run in parallel
- **Phase 2:** Tasks 11, 12, 13, 14 in parallel. Tasks 9 → 10 sequential
- **Phase 3:** Tasks 15, 16, 17, 18, 20, 21 in parallel. Task 19 after 15-17
- **Phase 4:** Task 22 first. Then 23, 24, 25 in parallel
- **Phase 5:** All tasks in parallel

## Quick Wins (can be pulled forward anytime)

1. **Wallpaper** (Task 26) — user's stated favorite, no dependencies
2. **Surprise Me** (Task 21) — tiny hook, preference engine already exists
3. **Style DNA** (Task 14) — preference data already collecting
4. **Taste Match** (Task 24) — stateless URL-based, no backend
5. **Story Cards** (Task 20) — Canvas rendering, color palette exists

---

## Testing Strategy

Every task follows TDD:
1. Write failing test for mapper/utility
2. Implement to pass
3. Integration: manual test in dev server
4. Commit

**Test file locations mirror source:**
- `src/utils/__tests__/*.test.ts` — utility tests
- `src/hooks/__tests__/*.test.ts` — hook tests (with `@testing-library/react`)
- Run all: `npm run test`
- Run specific: `npm run test -- src/utils/__tests__/mapMetRecord.test.ts`

---

## Build Verification

After every task:
```bash
npm run lint && npm run build && npm run test
```

All three must pass before committing.

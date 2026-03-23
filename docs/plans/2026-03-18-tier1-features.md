# Tier 1 Implementation Plan — Make ArtTok Publishable

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the single-page ArtTok prototype into a multi-page art discovery app with routing, search, detail views, and category browsing — while fixing the hardcoded API key security issue.

**Architecture:** Add React Router for client-side routing. Extend `ArtImagesService` with search/filter methods using Harvard API query params. Create new page components for each route. Keep MobX store for feed state, add a new search store. All styles stay in `App.css` with BEM naming.

**Tech Stack:** React Router v7, Vite 6, React 19, TypeScript 5, MobX 6, Harvard Art Museums API

---

## Task 1: Fix Hardcoded API Key (P0 — Security)

**Files:**
- Modify: `src/services/ArtImagesService.ts:3` (remove hardcoded key)
- Create: `.env` (local env file)
- Modify: `.gitignore` (ensure `.env` is ignored)

**Step 1: Create `.env` file**

```
VITE_HARVARD_API_KEY=6c508855-dcac-4b25-a405-42f8581b8070
```

**Step 2: Verify `.gitignore` includes `.env`**

Check `.gitignore` — add `.env` line if missing. Also add `.env.local`, `.env.*.local`.

**Step 3: Replace hardcoded key in service**

In `src/services/ArtImagesService.ts`, replace:
```ts
const API_KEY = "6c508855-dcac-4b25-a405-42f8581b8070";
```
With:
```ts
const API_KEY = import.meta.env.VITE_HARVARD_API_KEY as string;
```

**Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS — no lint errors, build succeeds

**Step 5: Commit**

```bash
git add .env .gitignore src/services/ArtImagesService.ts
git commit -m "fix: move Harvard API key from hardcoded string to env var"
```

---

## Task 2: Install React Router & Set Up Routing

**Files:**
- Modify: `package.json` (add react-router-dom)
- Modify: `src/main.tsx` (wrap with BrowserRouter)
- Modify: `src/App.tsx` (add Routes/Route config)

**Step 1: Install react-router-dom**

Run: `npm install react-router-dom`

**Step 2: Wrap app with BrowserRouter**

In `src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

**Step 3: Set up routes in App.tsx**

```tsx
import "./App.css";
import { Routes, Route } from "react-router-dom";
import FeedPage from "./pages/FeedPage";
import ArtworkDetailPage from "./pages/ArtworkDetailPage";
import SearchPage from "./pages/SearchPage";
import LikedPage from "./pages/LikedPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<FeedPage />} />
      <Route path="/artwork/:id" element={<ArtworkDetailPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/liked" element={<LikedPage />} />
    </Routes>
  );
}

export default App;
```

Note: Page components will be created as stubs first, then implemented in subsequent tasks.

**Step 4: Create stub pages**

Create minimal placeholder components for `ArtworkDetailPage`, `SearchPage`, and `LikedPage` in `src/pages/` so routing compiles:

`src/pages/ArtworkDetailPage.tsx`:
```tsx
export default function ArtworkDetailPage() {
  return <div className="page-stub">Artwork Detail — coming soon</div>;
}
```

`src/pages/SearchPage.tsx`:
```tsx
export default function SearchPage() {
  return <div className="page-stub">Search — coming soon</div>;
}
```

`src/pages/LikedPage.tsx`:
```tsx
export default function LikedPage() {
  return <div className="page-stub">Liked Art — coming soon</div>;
}
```

**Step 5: Add navigation to FeedPage header**

Update the header in `FeedPage.tsx` to include nav links using `<Link>` from react-router-dom:
- Logo "ArtTok" links to `/`
- Add search icon button linking to `/search`
- Liked (heart) icon button links to `/liked` instead of opening the panel

```tsx
import { Link } from "react-router-dom";
```

Add to header actions (before refresh button):
```tsx
<Link to="/search" className="art-feed__icon-button" aria-label="Search artworks">
  <SearchIcon />
</Link>
```

Change the liked art button to navigate:
```tsx
<Link to="/liked" className="art-feed__icon-button" aria-label="Liked art collection">
  <CollectionIcon />
</Link>
```

Add a SearchIcon SVG component (magnifying glass).

**Step 6: Verify**

Run: `npm run lint && npm run build`
Expected: PASS

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add React Router with routes for feed, detail, search, liked"
```

---

## Task 3: Extend ArtImagesService for Search & Filters

**Files:**
- Modify: `src/services/ArtImagesService.ts` (add search + filter methods)
- Modify: `src/types/art.ts` (add search/filter interfaces)

**Step 1: Add search/filter types**

In `src/types/art.ts`, add:
```ts
export interface ArtSearchParams {
  keyword?: string;
  artist?: string;
  culture?: string;
  classification?: string;
  century?: string;
  medium?: string;
  page?: number;
  size?: number;
  sort?: string;
  sortorder?: string;
}
```

**Step 2: Add search method to service**

In `src/services/ArtImagesService.ts`, add a `searchArtworks` method:

```ts
public async searchArtworks(searchParams: ArtSearchParams): Promise<HarvardArtResponse> {
  const params = new URLSearchParams({
    apikey: API_KEY,
    size: String(searchParams.size || DEFAULT_PAGE_SIZE),
    page: String(searchParams.page || 1),
    hasimage: "1",
    fields: FIELDS.join(","),
  });

  // Build query parts
  const queryParts: string[] = [DEFAULT_QUERY];

  if (searchParams.keyword) {
    params.set("keyword", searchParams.keyword);
  }
  if (searchParams.artist) {
    queryParts.push(`person:${searchParams.artist}`);
  }
  if (searchParams.culture) {
    params.set("culture", searchParams.culture);
  }
  if (searchParams.classification) {
    params.set("classification", searchParams.classification);
  }
  if (searchParams.century) {
    params.set("century", searchParams.century);
  }
  if (searchParams.medium) {
    params.set("medium", searchParams.medium);
  }

  params.set("q", queryParts.join(" AND "));

  if (searchParams.sort) {
    params.set("sort", searchParams.sort);
    params.set("sortorder", searchParams.sortorder || "desc");
  }

  const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return response.json();
}
```

**Step 3: Add method to fetch single artwork by ID**

```ts
public async fetchArtworkById(id: number): Promise<HarvardArtRecord | null> {
  const params = new URLSearchParams({
    apikey: API_KEY,
    fields: FIELDS.join(","),
  });

  const response = await fetch(`${API_ENDPOINT}/${id}?${params.toString()}`);

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch artwork: ${response.status}`);
  }

  return response.json();
}
```

Note: The Harvard API returns the object directly (not wrapped in `records`) for single-object fetch, so the return type is `HarvardArtRecord`.

**Step 4: Add method to fetch filter options (facets)**

Harvard API supports the `classification`, `culture`, `century` endpoints for browsing:

```ts
public async fetchFacet(
  facet: "classification" | "culture" | "century" | "medium",
  size = 50
): Promise<{ name: string; count: number }[]> {
  const params = new URLSearchParams({
    apikey: API_KEY,
    size: String(size),
    sort: "objectcount",
    sortorder: "desc",
  });

  const response = await fetch(
    `https://api.harvardartmuseums.org/${facet}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${facet} facets: ${response.status}`);
  }

  const data = await response.json();
  return (data.records || []).map((r: { name: string; objectcount: number }) => ({
    name: r.name,
    count: r.objectcount,
  }));
}
```

**Step 5: Update import in types**

Make sure `ArtSearchParams` is exported from `src/types/art.ts` and imported where needed.

**Step 6: Verify**

Run: `npm run lint && npm run build`

**Step 7: Commit**

```bash
git add src/services/ArtImagesService.ts src/types/art.ts
git commit -m "feat: add search, single artwork, and facet methods to ArtImagesService"
```

---

## Task 4: Artwork Detail Page

**Files:**
- Modify: `src/pages/ArtworkDetailPage.tsx` (full implementation)
- Modify: `src/App.css` (detail page styles)

**Step 1: Implement ArtworkDetailPage**

```tsx
import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { ArtPiece, HarvardArtRecord } from "../types/art";
import ArtImagesService from "../services/ArtImagesService";
import { useLikedArt } from "../hooks/useLikedArt";

const service = new ArtImagesService();

export default function ArtworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [artwork, setArtwork] = useState<ArtPiece | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const artId = Number(id);

  useEffect(() => {
    if (!id || isNaN(artId)) {
      setError("Invalid artwork ID");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    service.fetchArtworkById(artId).then((record) => {
      if (cancelled) return;
      if (!record) {
        setError("Artwork not found");
      } else {
        setArtwork(mapRecord(record));
      }
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load artwork");
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [id, artId]);

  if (isLoading) return <div className="detail-page__status">Loading artwork...</div>;
  if (error) return <div className="detail-page__status">{error} — <Link to="/">Back to feed</Link></div>;
  if (!artwork) return null;

  return (
    <div className="detail-page">
      <header className="detail-page__header">
        <Link to="/" className="detail-page__back" aria-label="Back to feed">← Back</Link>
      </header>
      <div className="detail-page__content">
        <div className="detail-page__image-container">
          <a href={artwork.imageUrl} target="_blank" rel="noopener noreferrer">
            <img src={artwork.imageUrl} alt={`${artwork.title} by ${artwork.artist}`} className="detail-page__image" />
          </a>
        </div>
        <div className="detail-page__info">
          <h1 className="detail-page__title">{artwork.title}</h1>
          <p className="detail-page__artist">{artwork.artist}</p>
          {artwork.description && <p className="detail-page__description">{artwork.description}</p>}
          <DetailMeta artwork={artwork} />
          <DetailActions artId={artId} artwork={artwork} />
        </div>
      </div>
    </div>
  );
}
```

Include `DetailMeta` component (renders culture, dated, classification, medium, dimensions as a `<dl>` grid) and `DetailActions` component (like button + share + museum link) in the same file.

Include the `mapRecord` helper (same logic as `ArtImagesStore.mapRecord`, extracted for reuse).

**Step 2: Add detail page styles to App.css**

- `.detail-page` — full viewport, dark bg, centered content
- `.detail-page__header` — sticky top bar with back link
- `.detail-page__image-container` — max-width constrained, cursor zoom-in
- `.detail-page__image` — max-height: 70vh, object-fit: contain
- `.detail-page__info` — metadata panel below/beside image
- `.detail-page__title` — large heading
- `.detail-page__meta` — dl grid for facts
- Responsive: side-by-side on desktop (768px+), stacked on mobile

**Step 3: Make ArtCard title link to detail page**

In `src/components/ArtCard.tsx`, wrap the title in a `<Link>`:
```tsx
import { Link } from "react-router-dom";
// ...
<Link to={`/artwork/${art.id}`} className="art-card__title-link">
  <h2 className="art-card__title">{art.title}</h2>
</Link>
```

Add `.art-card__title-link` style: `color: inherit; text-decoration: none;`

**Step 4: Verify**

Run: `npm run lint && npm run build`

**Step 5: Commit**

```bash
git add src/pages/ArtworkDetailPage.tsx src/components/ArtCard.tsx src/App.css
git commit -m "feat: implement artwork detail page with full metadata and image zoom"
```

---

## Task 5: Search Page

**Files:**
- Modify: `src/pages/SearchPage.tsx` (full implementation)
- Create: `src/stores/SearchStore.ts` (MobX store for search state)
- Modify: `src/App.css` (search page styles)

**Step 1: Create SearchStore**

`src/stores/SearchStore.ts`:
```ts
import { action, makeObservable, observable, runInAction } from "mobx";
import ArtImagesService from "../services/ArtImagesService";
import type { ArtPiece, ArtSearchParams, HarvardArtRecord } from "../types/art";

class SearchStore {
  private service = new ArtImagesService();

  @observable query = "";
  @observable results: ArtPiece[] = [];
  @observable isLoading = false;
  @observable hasMore = false;
  @observable error: string | null = null;
  @observable totalResults = 0;
  @observable private page = 1;
  @observable private currentParams: ArtSearchParams = {};

  constructor() {
    makeObservable(this);
  }

  @action.bound
  async search(params: ArtSearchParams) {
    this.currentParams = params;
    this.page = 1;
    this.results = [];
    this.isLoading = true;
    this.error = null;

    try {
      const response = await this.service.searchArtworks({ ...params, page: 1 });
      runInAction(() => {
        this.results = response.records
          .filter((r) => r.primaryimageurl)
          .map((r) => this.mapRecord(r));
        this.totalResults = response.info.totalrecords;
        this.hasMore = Boolean(response.info.next);
        this.page = 2;
      });
    } catch {
      runInAction(() => { this.error = "Search failed. Please try again."; });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  @action.bound
  async loadMore() {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;

    try {
      const response = await this.service.searchArtworks({ ...this.currentParams, page: this.page });
      runInAction(() => {
        const newPieces = response.records
          .filter((r) => r.primaryimageurl)
          .map((r) => this.mapRecord(r));
        this.results.push(...newPieces);
        this.hasMore = Boolean(response.info.next);
        this.page += 1;
      });
    } catch {
      runInAction(() => { this.error = "Failed to load more results."; });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  private mapRecord(record: HarvardArtRecord): ArtPiece {
    // Same mapping logic as ArtImagesStore
  }
}

const searchStore = new SearchStore();
export default searchStore;
```

**Step 2: Implement SearchPage**

`src/pages/SearchPage.tsx`:
- Search input (keyword) with submit button
- Optional filter dropdowns: artist text input, culture, classification, medium (populated on first load via `fetchFacet`)
- Results grid: reuse `ArtCard` or a compact `SearchResultCard` component
- Infinite scroll on results using `useInfiniteScroll`
- Empty state: "Search for artworks by keyword, artist, or culture"
- Link back to feed in header

**Step 3: Add search page styles**

- `.search-page` — full viewport, dark bg
- `.search-page__header` — sticky, back link + title
- `.search-page__form` — search input + filters row
- `.search-page__input` — dark input with accent border on focus
- `.search-page__filters` — horizontal scroll row of filter dropdowns
- `.search-page__results` — grid of result cards
- `.search-result-card` — compact card (thumbnail + title + artist)
- Responsive: 2 columns on mobile, 3-4 on desktop

**Step 4: Verify**

Run: `npm run lint && npm run build`

**Step 5: Commit**

```bash
git add src/pages/SearchPage.tsx src/stores/SearchStore.ts src/App.css
git commit -m "feat: implement search page with keyword, artist, and filter support"
```

---

## Task 6: Liked Art Page

**Files:**
- Modify: `src/pages/LikedPage.tsx` (full implementation)
- Modify: `src/App.css` (liked page styles)

**Step 1: Implement LikedPage**

`src/pages/LikedPage.tsx`:
- Reads liked IDs from `likedArtStorage`
- Fetches each artwork by ID using `service.fetchArtworkById` (batch, with loading state)
- Displays as grid of compact art cards (reuse `SearchResultCard` or similar)
- Each card links to `/artwork/:id`
- Unlike button on each card
- Empty state: "No liked artworks yet. Go discover some art!"
- Back nav to feed

**Step 2: Add liked page styles**

- `.liked-page` — full viewport, dark bg
- `.liked-page__header` — sticky, back link + title + count badge
- `.liked-page__grid` — responsive grid of liked art cards
- Responsive: 2 columns mobile, 3-4 desktop

**Step 3: Verify**

Run: `npm run lint && npm run build`

**Step 4: Commit**

```bash
git add src/pages/LikedPage.tsx src/App.css
git commit -m "feat: implement liked art page with grid view and unlike support"
```

---

## Task 7: Category Filters (Browse Page)

**Files:**
- Create: `src/pages/CategoriesPage.tsx`
- Modify: `src/App.tsx` (add `/categories` route)
- Modify: `src/App.css` (categories page styles)

**Step 1: Add route**

In `src/App.tsx`, add:
```tsx
import CategoriesPage from "./pages/CategoriesPage";
// ...
<Route path="/categories" element={<CategoriesPage />} />
<Route path="/categories/:facet/:value" element={<SearchPage />} />
```

The second route reuses SearchPage with a pre-applied filter.

**Step 2: Implement CategoriesPage**

`src/pages/CategoriesPage.tsx`:
- On mount, fetch facets for culture, classification, century using `service.fetchFacet`
- Display as grouped sections: "By Culture", "By Classification", "By Century"
- Each item is a pill/chip linking to `/categories/:facet/:value`
- Show object count next to each category
- Loading skeleton while fetching

**Step 3: Update SearchPage to accept route params**

In `SearchPage`, check for `useParams` — if `/categories/:facet/:value`, pre-populate the filter and run search on mount.

**Step 4: Add categories nav link to FeedPage header**

Add a grid/browse icon linking to `/categories`.

**Step 5: Add bottom navigation bar**

Create a shared `BottomNav` component in `src/components/BottomNav.tsx`:
- Fixed bottom bar with 4 icons: Home (`/`), Search (`/search`), Categories (`/categories`), Liked (`/liked`)
- Highlight active route
- Only visible on mobile (<768px)
- Add to `App.tsx` outside `<Routes>`

**Step 6: Add styles**

- `.categories-page` — full viewport, dark bg
- `.categories-page__section` — grouped category section
- `.categories-page__chips` — flex wrap of category chips
- `.categories-page__chip` — pill shape, accent border, hover effect
- `.bottom-nav` — fixed bottom, glass-morphism effect, z-index above content

**Step 7: Verify**

Run: `npm run lint && npm run build`

**Step 8: Commit**

```bash
git add src/pages/CategoriesPage.tsx src/pages/SearchPage.tsx src/components/BottomNav.tsx src/App.tsx src/App.css
git commit -m "feat: add category browsing with culture, classification, century filters and bottom nav"
```

---

## Task 8: Final Polish & Cleanup

**Files:**
- Modify: `src/pages/FeedPage.tsx` (remove inline LikedArtPanel since it's now a separate page)
- Modify: `src/App.css` (clean up unused panel styles if needed)

**Step 1: Clean up FeedPage**

- Remove `LikedArtPanel` import and rendering from FeedPage
- Remove `isLikedPanelOpen` state and related swipe handlers
- Remove the backdrop button
- Keep the feed scroll behavior intact

**Step 2: Verify entire app**

Run: `npm run lint && npm run build`
Manually test all routes: `/`, `/artwork/:id`, `/search`, `/liked`, `/categories`

**Step 3: Commit**

```bash
git add src/pages/FeedPage.tsx src/App.css
git commit -m "refactor: clean up FeedPage after extracting liked panel to dedicated route"
```

---

## Implementation Order Summary

| Order | Task | Priority | Depends On |
|-------|------|----------|------------|
| 1 | Fix hardcoded API key | P0 | — |
| 2 | React Router setup | P0 | — |
| 3 | Extend ArtImagesService | P0 | Task 1 (env var) |
| 4 | Artwork detail page | P0 | Tasks 2, 3 |
| 5 | Search page | P1 | Tasks 2, 3 |
| 6 | Liked art page | P1 | Task 2 |
| 7 | Category filters | P1 | Tasks 2, 3, 5 |
| 8 | Final polish & cleanup | P1 | All above |

## Notes

- **mapRecord duplication**: Tasks 4 and 5 both need the `mapRecord` logic from `ArtImagesStore`. Extract it to a shared util `src/utils/mapArtRecord.ts` during Task 3.
- **Harvard API rate limit**: 2,500 req/day — the facet fetches and search are lightweight, but cache facet results in the store to avoid re-fetching.
- **LikedArtPanel**: The slide-out panel in FeedPage is replaced by a full `/liked` page. The panel component can be kept for potential reuse or removed in Task 8.
- **No breaking changes to existing feed**: The `/` route continues to work exactly as before.

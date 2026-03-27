# Dropbox Image Cache Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pre-cache ~200 Harvard/AIC artwork images on Dropbox so GitHub Actions can post from all 3 sources without hitting blocked museum image servers.

**Architecture:** New `curator.mjs` script runs locally to fetch artworks + upload images to Dropbox, storing metadata in `image-cache.json`. The poster's `fetchRandomArtwork` checks the cache for Harvard/AIC picks, falls back to Met if empty. Cache entries have a `skip` flag for quality control.

**Tech Stack:** Node.js ESM, Dropbox API (existing infra in `lib/dropbox.mjs`), dotenv

---

### Task 1: Create `lib/cache.mjs` — cache read/write helpers

**Files:**
- Create: `scripts/instagram-poster/lib/cache.mjs`

**Step 1: Write the module**

```js
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, "..", "image-cache.json");

export function loadCache() {
  if (!existsSync(CACHE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function saveCache(entries) {
  writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2));
}

/**
 * Get available (non-skipped, non-posted) entries for a given source.
 */
export function getAvailable(entries, historySet, source) {
  return entries.filter((e) =>
    e.source === source &&
    !e.skip &&
    !historySet.has(`${e.source}:${e.id}`),
  );
}

/**
 * Pick a random cached artwork for the given source.
 * Returns null if no entries available.
 */
export function pickCached(entries, historySet, source) {
  const available = getAvailable(entries, historySet, source);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Mark an entry as skipped by source:id key.
 */
export function excludeEntry(entries, key) {
  const entry = entries.find((e) => `${e.source}:${e.id}` === key);
  if (!entry) return false;
  entry.skip = true;
  return true;
}

/**
 * Get cache stats.
 */
export function getCacheStats(entries, historySet) {
  const total = entries.length;
  const skipped = entries.filter((e) => e.skip).length;
  const posted = entries.filter((e) => historySet.has(`${e.source}:${e.id}`)).length;
  const available = total - skipped - posted;
  const bySource = {};
  for (const e of entries) {
    const s = e.source;
    if (!bySource[s]) bySource[s] = { total: 0, available: 0, skipped: 0, posted: 0 };
    bySource[s].total++;
    if (e.skip) bySource[s].skipped++;
    else if (historySet.has(`${e.source}:${e.id}`)) bySource[s].posted++;
    else bySource[s].available++;
  }
  return { total, available, skipped, posted, bySource };
}
```

**Step 2: Commit**

```bash
git add scripts/instagram-poster/lib/cache.mjs
git commit -m "feat(ig-poster): add cache read/write helpers for Dropbox image cache"
```

---

### Task 2: Create `curator.mjs` — main curator script

**Files:**
- Create: `scripts/instagram-poster/curator.mjs`

**Step 1: Write the curator**

```js
#!/usr/bin/env node
/**
 * ArtTok Image Cache Curator
 *
 * Fetches Harvard/AIC artworks, downloads images, uploads to Dropbox,
 * and saves metadata to image-cache.json. Run locally — your IP works
 * for museum image servers (GitHub Actions IPs are blocked).
 *
 * Usage:
 *   node curator.mjs                          # fetch 200 (100 Harvard + 100 AIC)
 *   node curator.mjs --exclude harvard:299843  # mark entry as skip
 *   node curator.mjs --status                  # show cache stats
 *   node curator.mjs --cleanup                 # delete Dropbox files for posted entries
 */
import "dotenv/config";
import { loadCache, saveCache, excludeEntry, getCacheStats } from "./lib/cache.mjs";
import { loadHistoryData, artKey } from "./lib/history.mjs";
import { fetchHarvardRandom, fetchAicRandom } from "./lib/art-fetchers.mjs";
import { getDropboxToken, uploadToDropbox, deleteFromDropbox } from "./lib/dropbox.mjs";
import { probeImage } from "./lib/fetch.mjs";

const HISTORY_FILE = new URL("./posted-history.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

const args = process.argv.slice(2);

// ── --exclude ────────────────────────────────────────────────────────────────

if (args[0] === "--exclude") {
  const key = args[1];
  if (!key) { console.error("Usage: node curator.mjs --exclude <source:id>"); process.exit(1); }
  const cache = loadCache();
  if (excludeEntry(cache, key)) {
    saveCache(cache);
    console.log(`Marked ${key} as skipped`);
  } else {
    console.error(`Entry ${key} not found in cache`);
    process.exit(1);
  }
  process.exit(0);
}

// ── --status ─────────────────────────────────────────────────────────────────

if (args[0] === "--status") {
  const cache = loadCache();
  const historyData = loadHistoryData(HISTORY_FILE);
  const historySet = new Set(historyData.posted);
  const stats = getCacheStats(cache, historySet);
  console.log(`Image Cache Status`);
  console.log(`─`.repeat(40));
  console.log(`Total entries: ${stats.total}`);
  console.log(`Available:     ${stats.available}`);
  console.log(`Skipped:       ${stats.skipped}`);
  console.log(`Posted:        ${stats.posted}`);
  console.log();
  for (const [source, s] of Object.entries(stats.bySource)) {
    console.log(`  ${source}: ${s.available} available, ${s.posted} posted, ${s.skipped} skipped (${s.total} total)`);
  }
  process.exit(0);
}

// ── --cleanup ────────────────────────────────────────────────────────────────

if (args[0] === "--cleanup") {
  const cache = loadCache();
  const historyData = loadHistoryData(HISTORY_FILE);
  const historySet = new Set(historyData.posted);
  const token = await getDropboxToken();
  let cleaned = 0;
  for (const entry of cache) {
    if (historySet.has(`${entry.source}:${entry.id}`) && entry.dropboxPath) {
      try {
        await deleteFromDropbox(entry.dropboxPath, token);
        cleaned++;
      } catch { /* already deleted or missing */ }
    }
  }
  // Remove posted entries from cache
  const remaining = cache.filter((e) => !historySet.has(`${e.source}:${e.id}`));
  saveCache(remaining);
  console.log(`Cleaned up ${cleaned} Dropbox files, removed ${cache.length - remaining.length} posted entries from cache`);
  process.exit(0);
}

// ── Main: fetch and cache ────────────────────────────────────────────────────

const TARGET_PER_SOURCE = 100;

const SOURCES = [
  { name: "Harvard", source: "harvard", fn: fetchHarvardRandom },
  { name: "AIC", source: "artic", fn: fetchAicRandom },
];

async function main() {
  const cache = loadCache();
  const historyData = loadHistoryData(HISTORY_FILE);
  const historySet = new Set(historyData.posted);
  const cacheKeys = new Set(cache.map((e) => `${e.source}:${e.id}`));

  console.log("ArtTok Image Cache Curator");
  console.log("─".repeat(40));
  console.log(`Existing cache: ${cache.length} entries`);
  console.log(`Target: ${TARGET_PER_SOURCE} per source (${TARGET_PER_SOURCE * SOURCES.length} total new)`);
  console.log();

  const token = await getDropboxToken();
  let added = 0;
  let failed = 0;

  for (const { name, source, fn } of SOURCES) {
    console.log(`\n── ${name} ──`);
    let sourceAdded = 0;

    for (let attempt = 0; attempt < TARGET_PER_SOURCE * 3 && sourceAdded < TARGET_PER_SOURCE; attempt++) {
      try {
        const art = await fn();
        const key = artKey(art);

        // Skip if already cached or posted
        if (cacheKeys.has(key) || historySet.has(key)) {
          continue;
        }

        // Download image (your local IP works)
        const imageBuffer = await probeImage(art.imageUrl);

        // Upload to Dropbox
        const filename = `${source}-${art.id}`;
        const path = `/arttok-cache/${filename}.jpg`;

        const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
          },
          body: imageBuffer,
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.text();
          console.warn(`  Dropbox upload failed: ${body}`);
          failed++;
          continue;
        }

        // Create shared link
        let shareUrl;
        const shareRes = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path,
            settings: { requested_visibility: { ".tag": "public" } },
          }),
        });

        if (shareRes.ok) {
          const shareData = await shareRes.json();
          shareUrl = shareData.url;
        } else {
          // Link may already exist
          const listRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ path, direct_only: true }),
          });
          const listData = await listRes.json();
          shareUrl = listData.links?.[0]?.url;
          if (!shareUrl) {
            console.warn(`  Failed to create shared link for ${key}`);
            failed++;
            continue;
          }
        }

        const directUrl = shareUrl.replace(/\?dl=0$/, "?raw=1").replace(/&dl=0/, "&raw=1");

        // Build cache entry
        const entry = {
          source: art.source,
          id: art.id,
          title: art.title,
          artist: art.artist,
          imageUrl: directUrl,
          dropboxPath: path,
          culture: art.culture || "",
          dated: art.dated || "",
          classification: art.classification || "",
          medium: art.medium || "",
          description: art.description || "",
          url: art.url || "",
          museumName: art.museumName || "",
          cachedAt: new Date().toISOString().slice(0, 10),
          skip: false,
        };

        // Write immediately (crash-safe)
        cache.push(entry);
        cacheKeys.add(key);
        saveCache(cache);

        sourceAdded++;
        added++;
        console.log(`  [${sourceAdded}/${TARGET_PER_SOURCE}] "${art.title}" by ${art.artist}`);
      } catch (err) {
        console.warn(`  Failed: ${err.message}`);
        failed++;
      }
    }

    console.log(`  ${name}: ${sourceAdded} added, ${failed} failed`);
  }

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Done! Added ${added} artworks. ${failed} failures.`);
  console.log(`Cache now has ${cache.length} total entries.`);

  const stats = getCacheStats(cache, historySet);
  console.log(`Available: ${stats.available}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
```

**Step 2: Add to package.json scripts**

Add `"curator"` and `"curator:status"` scripts:

```json
"curator": "node curator.mjs",
"curator:status": "node curator.mjs --status"
```

**Step 3: Create empty `image-cache.json`**

```json
[]
```

**Step 4: Commit**

```bash
git add scripts/instagram-poster/curator.mjs scripts/instagram-poster/image-cache.json scripts/instagram-poster/package.json
git commit -m "feat(ig-poster): add curator script for Dropbox image cache"
```

---

### Task 3: Modify `art-fetchers.mjs` — cache-aware source selection

**Files:**
- Modify: `scripts/instagram-poster/lib/art-fetchers.mjs:1,214-262`

**Step 1: Add cache import at top**

After the existing import line:

```js
import { fetchJson, pick, probeImage } from "./fetch.mjs";
import { loadCache, pickCached } from "./cache.mjs";
```

**Step 2: Add cache-aware fetch function**

Add before `fetchRandomArtwork` (before line 214):

```js
/**
 * Try to get artwork from Dropbox image cache (for Harvard/AIC in CI).
 * Returns art with imageBuffer, or null if cache empty/fetch fails.
 */
async function fetchFromCache(sourceName, historySet) {
  try {
    const cache = loadCache();
    const sourceKey = sourceName === "AIC" ? "artic" : sourceName.toLowerCase();
    const entry = pickCached(cache, historySet, sourceKey);
    if (!entry) return null;

    console.log(`Cache hit: "${entry.title}" by ${entry.artist} [${sourceName}]`);
    const imageBuffer = await probeImage(entry.imageUrl);
    return { ...entry, imageBuffer };
  } catch (err) {
    console.warn(`Cache fetch failed: ${err.message}`);
    return null;
  }
}
```

**Step 3: Modify `fetchRandomArtwork` to try cache first for Harvard/AIC**

Replace the inner `for (const source of ordered)` loop body (lines 232-257) with:

```js
    for (const source of ordered) {
      try {
        // For Harvard/AIC: try Dropbox cache first (museum image servers block CI IPs)
        if (source.name === "Harvard" || source.name === "AIC") {
          const cached = await fetchFromCache(source.name, historySet);
          if (cached) return cached;
          // Cache empty — fall through to live fetch (works locally, may fail in CI)
        }

        console.log(`Trying ${source.name}...`);
        const art = await source.fn();
        const key = `${art.source}:${art.id}`;

        if (historySet.has(key)) {
          console.log(`Skipping duplicate: "${art.title}" [${key}]`);
          continue;
        }

        // Probe the image before returning
        const imageBuffer = await probeImage(art.imageUrl);
        art.imageBuffer = imageBuffer;

        console.log(`Got: "${art.title}" by ${art.artist} [${source.name}]`);
        return art;
      } catch (err) {
        if (err.statusCode === 429 || err.statusCode === 403) {
          const sourceName = source.name.toLowerCase();
          failedImageSources.add(sourceName);
          console.warn(`${source.name} images ${err.statusCode} — blacklisted, trying next source`);
        } else {
          console.warn(`${source.name} failed: ${err.message}`);
        }
      }
    }
```

**Step 4: Add cache low warning**

At the top of `fetchRandomArtwork`, after the `available` filter:

```js
  // Warn if cache is running low
  try {
    const cache = loadCache();
    const cacheAvail = cache.filter((e) => !e.skip && !historySet.has(`${e.source}:${e.id}`)).length;
    if (cacheAvail > 0 && cacheAvail < 20) {
      console.warn(`⚠ Image cache low: ${cacheAvail} entries remaining. Run curator.mjs to refill.`);
    }
  } catch { /* non-fatal */ }
```

**Step 5: Commit**

```bash
git add scripts/instagram-poster/lib/art-fetchers.mjs
git commit -m "feat(ig-poster): fetchRandomArtwork tries Dropbox cache for Harvard/AIC"
```

---

### Task 4: Add cache tests

**Files:**
- Modify: `scripts/instagram-poster/tests/fallback.test.mjs`

**Step 1: Add cache helper tests**

Append to the test file:

```js
// ── Tests for cache helpers ─────────────────────────────────────────────────

describe("cache helpers", () => {
  it("test 11: pickCached returns random entry for matching source", () => {
    const { pickCached } = await import("../lib/cache.mjs");
    const entries = [
      { source: "harvard", id: 1, title: "A", skip: false },
      { source: "harvard", id: 2, title: "B", skip: false },
      { source: "artic", id: 3, title: "C", skip: false },
    ];
    const result = pickCached(entries, new Set(), "harvard");
    assert.ok(result);
    assert.equal(result.source, "harvard");
  });

  it("test 12: pickCached skips entries with skip:true", () => {
    const { pickCached } = await import("../lib/cache.mjs");
    const entries = [
      { source: "harvard", id: 1, skip: true },
      { source: "harvard", id: 2, skip: false },
    ];
    const result = pickCached(entries, new Set(), "harvard");
    assert.equal(result.id, 2);
  });

  it("test 13: pickCached skips already-posted entries", () => {
    const { pickCached } = await import("../lib/cache.mjs");
    const entries = [
      { source: "harvard", id: 1, skip: false },
      { source: "harvard", id: 2, skip: false },
    ];
    const result = pickCached(entries, new Set(["harvard:1"]), "harvard");
    assert.equal(result.id, 2);
  });

  it("test 14: pickCached returns null when cache empty for source", () => {
    const { pickCached } = await import("../lib/cache.mjs");
    const entries = [
      { source: "artic", id: 1, skip: false },
    ];
    const result = pickCached(entries, new Set(), "harvard");
    assert.equal(result, null);
  });

  it("test 15: excludeEntry marks entry as skip", () => {
    const { excludeEntry } = await import("../lib/cache.mjs");
    const entries = [
      { source: "harvard", id: 1, skip: false },
    ];
    const found = excludeEntry(entries, "harvard:1");
    assert.equal(found, true);
    assert.equal(entries[0].skip, true);
  });

  it("test 16: getCacheStats counts correctly", () => {
    const { getCacheStats } = await import("../lib/cache.mjs");
    const entries = [
      { source: "harvard", id: 1, skip: false },
      { source: "harvard", id: 2, skip: true },
      { source: "artic", id: 3, skip: false },
    ];
    const stats = getCacheStats(entries, new Set(["harvard:1"]));
    assert.equal(stats.total, 3);
    assert.equal(stats.available, 1); // artic:3
    assert.equal(stats.skipped, 1);   // harvard:2
    assert.equal(stats.posted, 1);    // harvard:1
  });
});
```

Note: these tests import from `cache.mjs` directly. The `pickCached`, `excludeEntry`, and `getCacheStats` functions are pure (no I/O) so they're easy to test.

Since the tests use top-level `await` inside `it()` blocks for the dynamic imports, make sure each import has a unique cache-buster query param (e.g., `?t=11`, `?t=12`, etc.).

**Step 2: Run tests**

```bash
cd scripts/instagram-poster && npm test
```

Expected: All 16 tests pass.

**Step 3: Commit**

```bash
git add scripts/instagram-poster/tests/fallback.test.mjs
git commit -m "test(ig-poster): add cache helper tests"
```

---

### Task 5: Update `package.json` scripts + lint + verify

**Files:**
- Modify: `scripts/instagram-poster/package.json`

**Step 1: Ensure package.json has curator scripts**

```json
{
  "scripts": {
    "post": "node post.mjs",
    "post:story": "node post.mjs --story",
    "post:dry-run": "node post.mjs --dry-run",
    "test": "node --test tests/fallback.test.mjs",
    "curator": "node curator.mjs",
    "curator:status": "node curator.mjs --status"
  }
}
```

**Step 2: Run lint**

```bash
cd d:/Projects/arttok && npm run lint
```

Expected: No errors.

**Step 3: Run tests**

```bash
cd scripts/instagram-poster && npm test
```

Expected: All tests pass.

**Step 4: Run curator --status (should show empty cache)**

```bash
cd scripts/instagram-poster && node curator.mjs --status
```

Expected: `Total entries: 0, Available: 0`

**Step 5: Commit any fixes**

```bash
git add -A && git diff --staged --quiet || git commit -m "chore(ig-poster): finalize curator + cache integration"
```

---

### Task 6: Test curator locally (end-to-end)

**Step 1: Run curator with a small batch to test**

Temporarily change `TARGET_PER_SOURCE` to 2 (or add a `--count` arg) and run:

```bash
cd scripts/instagram-poster && node curator.mjs
```

Expected: Fetches 2 Harvard + 2 AIC artworks, uploads to Dropbox, writes to `image-cache.json`.

**Step 2: Verify cache status**

```bash
node curator.mjs --status
```

Expected: Shows 4 entries, 4 available.

**Step 3: Test exclude**

```bash
node curator.mjs --exclude harvard:<id-from-cache>
```

Expected: Entry marked as skipped.

**Step 4: Test dry-run with cache**

```bash
node post.mjs --dry-run
```

Expected: If rotation picks Harvard/AIC, uses cached entry. If Met, fetches directly.

**Step 5: Reset TARGET_PER_SOURCE back to 100, commit**

```bash
git add scripts/instagram-poster/image-cache.json
git commit -m "test(ig-poster): verify curator end-to-end, cache working"
```

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
import { loadCache, saveCache, excludeEntry, getCacheStats, generateTags } from "./lib/cache.mjs";
import { loadHistoryData, artKey } from "./lib/history.mjs";
import { fetchHarvardRandom, fetchAicRandom } from "./lib/art-fetchers.mjs";
import { getDropboxToken, deleteFromDropbox } from "./lib/dropbox.mjs";
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
  console.log("Image Cache Status");
  console.log("\u2500".repeat(40));
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
  { name: "Harvard", source: "harvard", fn: fetchHarvardRandom, totalPages: 187 },
  { name: "AIC", source: "artic", fn: fetchAicRandom, totalPages: 100 },
];

/** Generate a shuffled array of page numbers 1..n */
function shuffledPages(n) {
  const pages = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = pages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pages[i], pages[j]] = [pages[j], pages[i]];
  }
  return pages;
}

async function main() {
  const cache = loadCache();
  const historyData = loadHistoryData(HISTORY_FILE);
  const historySet = new Set(historyData.posted);
  const cacheKeys = new Set(cache.map((e) => `${e.source}:${e.id}`));

  console.log("ArtTok Image Cache Curator");
  console.log("\u2500".repeat(40));
  console.log(`Existing cache: ${cache.length} entries`);
  console.log(`Target: ${TARGET_PER_SOURCE} per source (${TARGET_PER_SOURCE * SOURCES.length} total new)`);
  console.log();

  const token = await getDropboxToken();
  let added = 0;
  let failed = 0;

  // Medium diversity: cap oil at 50% of total target
  const OIL_CAP = Math.floor(TARGET_PER_SOURCE * SOURCES.length * 0.5);
  let oilCount = cache.filter((e) => /oil/i.test(e.medium || "")).length;

  for (const { name, source, fn, totalPages } of SOURCES) {
    // Skip source if it already has enough entries in cache
    const existingForSource = cache.filter((e) => e.source === source).length;
    if (existingForSource >= TARGET_PER_SOURCE) {
      console.log(`\n\u2500\u2500 ${name} \u2500\u2500 (skipped, already ${existingForSource} cached)`);
      continue;
    }
    console.log(`\n\u2500\u2500 ${name} (${existingForSource} existing, need ${TARGET_PER_SOURCE - existingForSource} more) \u2500\u2500`);
    let sourceAdded = 0;
    let consecutiveFails = 0;
    const MAX_CONSECUTIVE_FAILS = 10;
    const pages = shuffledPages(totalPages);
    let pageIdx = 0;

    for (let attempt = 0; attempt < TARGET_PER_SOURCE * 3 && sourceAdded < TARGET_PER_SOURCE && consecutiveFails < MAX_CONSECUTIVE_FAILS; attempt++) {
      try {
        // Cycle through shuffled pages — each call hits a unique page
        const page = pages[pageIdx % pages.length];
        pageIdx++;
        const art = await fn({ page });
        const key = artKey(art);

        // Skip if already cached or posted
        if (cacheKeys.has(key) || historySet.has(key)) {
          continue;
        }

        // Enforce oil diversity cap (50%)
        const isOil = /oil/i.test(art.medium || "");
        if (isOil && oilCount >= OIL_CAP) {
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
          tags: generateTags(art),
          skip: false,
        };

        // Write immediately (crash-safe)
        cache.push(entry);
        cacheKeys.add(key);
        saveCache(cache);

        sourceAdded++;
        added++;
        consecutiveFails = 0;
        if (isOil) oilCount++;
        const mediumTag = isOil ? "oil" : (art.medium || "").slice(0, 20);
        console.log(`  [${sourceAdded}/${TARGET_PER_SOURCE}] "${art.title}" by ${art.artist} (${mediumTag})`);

        // Delay between fetches to avoid rate limiting
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        consecutiveFails++;
        console.warn(`  Failed (${consecutiveFails}/${MAX_CONSECUTIVE_FAILS}): ${err.message}`);
        failed++;
        // Longer delay after failure (rate limit recovery)
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    console.log(`  ${name}: ${sourceAdded} added, ${failed} failed`);
  }

  console.log(`\n${"\u2500".repeat(40)}`);
  console.log(`Done! Added ${added} artworks. ${failed} failures.`);
  console.log(`Cache now has ${cache.length} total entries.`);

  const stats = getCacheStats(cache, historySet);
  console.log(`Available: ${stats.available}`);
  const totalOil = cache.filter((e) => /oil/i.test(e.medium || "")).length;
  console.log(`Oil paintings: ${totalOil}/${cache.length} (${(totalOil / cache.length * 100).toFixed(0)}%, cap: 50%)`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

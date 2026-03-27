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

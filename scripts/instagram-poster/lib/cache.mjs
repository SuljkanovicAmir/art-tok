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
 * If keyword is provided, prefer entries whose tags match it.
 * Returns null if no entries available.
 */
export function pickCached(entries, historySet, source, keyword = null) {
  const available = getAvailable(entries, historySet, source);
  if (available.length === 0) return null;

  if (keyword) {
    const kw = keyword.toLowerCase();
    const tagged = available.filter((e) => e.tags?.some((t) => t.includes(kw) || kw.includes(t)));
    if (tagged.length > 0) return tagged[Math.floor(Math.random() * tagged.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Generate tags from artwork metadata by matching against seasonal keywords.
 */
const ALL_SEASONAL_KEYWORDS = [
  "celebration", "new year", "winter", "feast", "festive",
  "love", "cupid", "romance", "kiss", "lovers", "heart",
  "spring", "flowers", "bloom", "garden", "pastoral",
  "resurrection", "easter", "lamb", "crucifixion", "madonna",
  "summer", "sun", "sea", "beach", "bathing", "harvest",
  "skull", "death", "skeleton", "night", "dark", "witch",
  "abundance", "cornucopia", "gratitude",
  "nativity", "christmas", "angel", "snow",
];

export function generateTags(art) {
  const text = [art.title, art.description, art.culture, art.classification, art.medium]
    .filter(Boolean).join(" ").toLowerCase();
  return ALL_SEASONAL_KEYWORDS.filter((kw) => text.includes(kw));
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

/**
 * Pick a themed carousel set: same culture (the grouping with the best data
 * coverage), same orientation (IG crops all children to the first child's
 * aspect), one work per artist, entries must have a known aspect.
 * Returns null when nothing qualifies — caller falls back to a single post.
 */
export function pickThemedSet(entries, historySet, { size = 4, minSize = 3, rng = Math.random } = {}) {
  const pool = entries.filter((e) =>
    !e.skip && e.aspect && e.culture &&
    !historySet.has(`${e.source}:${e.id}`),
  );

  const groups = new Map();
  for (const e of pool) {
    const orientation = e.aspect < 1.0 ? "portrait" : "landscape";
    const key = `${e.culture}|${orientation}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const viable = [...groups.values()]
    .map((g) => {
      const seen = new Set();
      return g.filter((e) => !seen.has(e.artist) && seen.add(e.artist));
    })
    .filter((g) => g.length >= minSize);
  if (viable.length === 0) return null;

  const group = viable[Math.floor(rng() * viable.length)];
  const shuffled = [...group].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(size, shuffled.length));
}

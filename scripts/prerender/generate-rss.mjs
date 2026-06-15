// Generates dist/feed.xml — an RSS 2.0 feed of posted artworks for Pinterest
// bulk pin creation. Pure builder (buildRssXml) + a main() that joins the
// posting history to the image cache. Run after `vite build` in deploy.yml.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const SITE_URL = "https://suljkanovicamir.github.io/art-tok/";
const MAX_ITEMS = 100;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssXml(items, { siteUrl, title = "ArtTok — Masterworks, daily", description = "Daily fine art from the world's great museums." } = {}) {
  const body = items.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="true">${esc(it.link)}</guid>
      <description>${esc(it.description)}</description>
      <media:content url="${esc(it.imageUrl)}" medium="image" />
    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(siteUrl)}</link>
    <description>${esc(description)}</description>
${body}
  </channel>
</rss>
`;
}

/**
 * Join posted keys (source:id) to cache entries and build feed items.
 * Newest first, capped at MAX_ITEMS. Skips keys with no cache entry or image.
 */
export function buildItems(postedKeys, cacheEntries, siteUrl) {
  const byKey = new Map(cacheEntries.map((e) => [`${e.source}:${e.id}`, e]));
  const base = siteUrl.replace(/\/$/, "");
  const items = [];
  for (const key of [...postedKeys].reverse()) {
    const e = byKey.get(key);
    if (!e || !e.imageUrl) continue;
    const description = [
      e.artist && e.artist !== "Unknown artist" ? e.artist : null,
      e.medium, e.dated, e.museumName,
    ].filter(Boolean).join(" · ");
    items.push({
      title: e.title || "Untitled",
      artist: e.artist,
      description,
      imageUrl: e.imageUrl,
      link: `${base}/artwork/${e.source}/${e.id}`,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function main() {
  const hist = readJson(join(ROOT, "scripts/instagram-poster/posted-history.json"), { posted: [] });
  const postedKeys = Array.isArray(hist) ? hist : (hist.posted || []);
  const cacheRaw = readJson(join(ROOT, "scripts/instagram-poster/image-cache.json"), []);
  const cacheEntries = Array.isArray(cacheRaw) ? cacheRaw : (cacheRaw.entries || Object.values(cacheRaw));

  const items = buildItems(postedKeys, cacheEntries, SITE_URL);
  const xml = buildRssXml(items, { siteUrl: SITE_URL });

  const distDir = join(ROOT, "dist");
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, "feed.xml"), xml);
  console.log(`Generated dist/feed.xml with ${items.length} items`);
}

if (process.argv[1] && process.argv[1].endsWith("generate-rss.mjs")) main();

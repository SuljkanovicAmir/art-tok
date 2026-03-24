#!/usr/bin/env node
/**
 * ArtTok Instagram Auto-Poster
 *
 * Fetches a random artwork from Harvard/Met/AIC, generates a watercolor-style
 * card (post, story, or reel), uploads to Dropbox for hosting, then publishes
 * to Instagram via Meta Graph API.
 *
 * Usage:
 *   node post.mjs              # auto-cycles: post → post → reel → post …
 *   node post.mjs --story      # story (1080x1920, disappears in 24h)
 *   node post.mjs --reel       # reel (30s video with audio)
 *   node post.mjs --dry-run    # generate card locally, skip Instagram publish
 *
 * Required env vars (see .env.example):
 *   INSTAGRAM_ACCESS_TOKEN  — long-lived page access token
 *   INSTAGRAM_USER_ID       — Instagram Business/Creator account ID
 *   HARVARD_API_KEY         — Harvard Art Museums API key
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPostCard, renderStoryCard } from "./render.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Post history (duplicate prevention) ─────────────────────────────────────

const HISTORY_FILE = new URL("./posted-history.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const MAX_HISTORY = 5000;

function loadHistoryData() {
  if (!existsSync(HISTORY_FILE)) {
    return { posted: [], runIndex: 0, postsSinceLastSeasonal: 99 };
  }
  try {
    const raw = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    // Migrate from old array format
    if (Array.isArray(raw)) {
      return { posted: raw, runIndex: 0, postsSinceLastSeasonal: 99 };
    }
    return {
      posted: raw.posted || [],
      runIndex: raw.runIndex || 0,
      postsSinceLastSeasonal: raw.postsSinceLastSeasonal ?? 99,
    };
  } catch {
    return { posted: [], runIndex: 0, postsSinceLastSeasonal: 99 };
  }
}

function saveHistoryData(historyData) {
  const trimmed = historyData.posted.slice(-MAX_HISTORY);
  writeFileSync(HISTORY_FILE, JSON.stringify({
    posted: trimmed,
    runIndex: historyData.runIndex,
    postsSinceLastSeasonal: historyData.postsSinceLastSeasonal,
  }, null, 2));
}

function artKey(art) {
  return `${art.source}:${art.id}`;
}

// ── Config ──────────────────────────────────────────────────────────────────

const {
  INSTAGRAM_USER_ID,
  HARVARD_API_KEY,
  META_APP_ID,
  META_APP_SECRET,
  FACEBOOK_PAGE_ID,
} = process.env;

let INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

const args = process.argv.slice(2);
const IS_STORY = args.includes("--story");
const IS_REEL = args.includes("--reel");
const DRY_RUN = args.includes("--dry-run");
const ART_ARG = args.find((a) => a.startsWith("--art="));
const SPECIFIC_ART = ART_ARG ? ART_ARG.replace("--art=", "") : null; // e.g. "harvard:229060"

// ── Art source configs ──────────────────────────────────────────────────────

const HARVARD_API = "https://api.harvardartmuseums.org/object";
const HARVARD_FIELDS = [
  "objectid", "primaryimageurl", "title", "people", "description",
  "culture", "dated", "classification", "medium", "url", "images",
].join(",");

const MET_API = "https://collectionapi.metmuseum.org/public/collection/v1";

const AIC_API = "https://api.artic.edu/api/v1";
const AIC_IIIF = "https://www.artic.edu/iiif/2";
const AIC_FIELDS = [
  "id", "title", "artist_display", "image_id", "place_of_origin",
  "date_display", "classification_title", "medium_display",
].join(",");

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Harvard: random page from top-viewed works ──────────────────────────────

async function fetchHarvardRandom() {
  if (!HARVARD_API_KEY) throw new Error("HARVARD_API_KEY not set");

  // First get total count
  const countUrl = `${HARVARD_API}?apikey=${HARVARD_API_KEY}&size=1&hasimage=1&q=verificationlevel:4&fields=objectid`;
  const countData = await fetchJson(countUrl);
  const totalPages = Math.min(countData.info.pages, 200);

  // Random page
  const page = Math.floor(Math.random() * totalPages) + 1;
  const url = `${HARVARD_API}?apikey=${HARVARD_API_KEY}&size=10&page=${page}&hasimage=1&q=verificationlevel:4&sort=totalpageviews&sortorder=desc&fields=${HARVARD_FIELDS}`;
  const data = await fetchJson(url);

  const records = data.records.filter((r) => r.primaryimageurl);
  if (records.length === 0) throw new Error("No Harvard artworks with images on this page");

  const r = pick(records);
  const artist = r.people?.map((p) => p.name).filter(Boolean).join(", ") || "Unknown artist";

  return {
    id: r.objectid,
    title: r.title || "Untitled",
    artist,
    imageUrl: r.primaryimageurl,
    source: "harvard",
    culture: r.culture,
    dated: r.dated,
    classification: r.classification,
    medium: r.medium,
    url: r.url || `https://harvardartmuseums.org/collections/object/${r.objectid}`,
    museumName: "Harvard Art Museums",
  };
}

// ── Met: random from highlights ─────────────────────────────────────────────

async function fetchMetRandom() {
  const searchUrl = `${MET_API}/search?hasImages=true&isHighlight=true&q=*`;
  const data = await fetchJson(searchUrl);
  const ids = data.objectIDs;
  if (!ids || ids.length === 0) throw new Error("No Met highlights found");

  // Try up to 5 random picks (some objects may lack images)
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = pick(ids);
    try {
      const obj = await fetchJson(`${MET_API}/objects/${id}`);
      const imageUrl = obj.primaryImage || obj.primaryImageSmall;
      if (!imageUrl) continue;

      return {
        id: obj.objectID,
        title: obj.title || "Untitled",
        artist: obj.artistDisplayName || "Unknown artist",
        imageUrl,
        source: "met",
        culture: obj.culture,
        dated: obj.objectDate,
        classification: obj.classification,
        medium: obj.medium,
        url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
        museumName: "The Metropolitan Museum of Art",
      };
    } catch {
      continue;
    }
  }
  throw new Error("Failed to find Met artwork with image after 5 attempts");
}

// ── AIC: random from search ────────────────────────────────────────────────

async function fetchAicRandom() {
  // Get total, pick random page
  const countUrl = `${AIC_API}/artworks/search?q=*&limit=1&fields=id`;
  const countData = await fetchJson(countUrl);
  const totalPages = Math.min(countData.pagination.total_pages, 200);

  const page = Math.floor(Math.random() * totalPages) + 1;
  const url = `${AIC_API}/artworks/search?q=*&page=${page}&limit=10&fields=${AIC_FIELDS}`;
  const data = await fetchJson(url);

  const records = data.data.filter((r) => r.image_id);
  if (records.length === 0) throw new Error("No AIC artworks with images on this page");

  const r = pick(records);
  return {
    id: r.id,
    title: r.title || "Untitled",
    artist: r.artist_display || "Unknown artist",
    imageUrl: `${AIC_IIIF}/${r.image_id}/full/843,/0/default.jpg`,
    source: "artic",
    culture: r.place_of_origin,
    dated: r.date_display,
    classification: r.classification_title,
    medium: r.medium_display,
    url: `https://www.artic.edu/artworks/${r.id}`,
    museumName: "Art Institute of Chicago",
  };
}

// ── Fetch specific artwork by source:id ─────────────────────────────────────

async function fetchSpecificArtwork(sourceId) {
  const [source, id] = sourceId.split(":");
  if (!source || !id) throw new Error(`Invalid --art format. Use: --art=harvard:229060`);

  console.log(`Fetching ${source}:${id}...`);

  if (source === "harvard") {
    if (!HARVARD_API_KEY) throw new Error("HARVARD_API_KEY not set");
    const url = `${HARVARD_API}/${id}?apikey=${HARVARD_API_KEY}&fields=${HARVARD_FIELDS}`;
    const r = await fetchJson(url);
    if (!r.primaryimageurl) throw new Error("This artwork has no image");
    const artist = r.people?.map((p) => p.name).filter(Boolean).join(", ") || "Unknown artist";
    return {
      id: r.objectid, title: r.title || "Untitled", artist,
      imageUrl: r.primaryimageurl, source: "harvard", culture: r.culture,
      dated: r.dated, classification: r.classification, medium: r.medium,
      url: r.url || `https://harvardartmuseums.org/collections/object/${r.objectid}`,
      museumName: "Harvard Art Museums",
    };
  }

  if (source === "met") {
    const obj = await fetchJson(`${MET_API}/objects/${id}`);
    const imageUrl = obj.primaryImage || obj.primaryImageSmall;
    if (!imageUrl) throw new Error("This artwork has no image");
    return {
      id: obj.objectID, title: obj.title || "Untitled",
      artist: obj.artistDisplayName || "Unknown artist", imageUrl, source: "met",
      culture: obj.culture, dated: obj.objectDate, classification: obj.classification,
      medium: obj.medium,
      url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
      museumName: "The Metropolitan Museum of Art",
    };
  }

  if (source === "artic" || source === "aic") {
    const data = await fetchJson(`${AIC_API}/artworks/${id}?fields=${AIC_FIELDS}`);
    const r = data.data;
    if (!r.image_id) throw new Error("This artwork has no image");
    return {
      id: r.id, title: r.title || "Untitled",
      artist: r.artist_display || "Unknown artist",
      imageUrl: `${AIC_IIIF}/${r.image_id}/full/843,/0/default.jpg`,
      source: "artic", culture: r.place_of_origin, dated: r.date_display,
      classification: r.classification_title, medium: r.medium_display,
      url: `https://www.artic.edu/artworks/${r.id}`,
      museumName: "Art Institute of Chicago",
    };
  }

  throw new Error(`Unknown source: ${source}. Use harvard, met, or artic.`);
}

// ── Random artwork from any source ──────────────────────────────────────────

const SOURCES = [
  { name: "Harvard", fn: fetchHarvardRandom, needsKey: true },
  { name: "Met", fn: fetchMetRandom, needsKey: false },
  { name: "AIC", fn: fetchAicRandom, needsKey: false },
];

async function fetchRandomArtwork(historySet) {
  // Filter to sources we can use (Harvard needs API key)
  const available = SOURCES.filter((s) => !s.needsKey || HARVARD_API_KEY);

  // Try up to 10 times across all sources to find a non-duplicate
  for (let round = 0; round < 10; round++) {
    const shuffled = available.sort(() => Math.random() - 0.5);

    for (const source of shuffled) {
      try {
        if (round === 0) console.log(`Trying ${source.name}...`);
        const art = await source.fn();
        const key = artKey(art);

        if (historySet.has(key)) {
          console.log(`Skipping duplicate: "${art.title}" [${key}]`);
          continue;
        }

        console.log(`Got: "${art.title}" by ${art.artist} [${source.name}]`);
        return art;
      } catch (err) {
        if (round === 0) console.warn(`${source.name} failed: ${err.message}`);
      }
    }
  }

  throw new Error("All art sources failed or all results were duplicates");
}

// ── Seasonal content ─────────────────────────────────────────────────────────

const SEASONAL_CALENDAR = [
  { key: "new-year",     start: [12, 20], end: [1, 5],   keywords: ["celebration", "new year", "winter", "feast", "festive"] },
  { key: "valentine",    start: [2, 7],   end: [2, 15],  keywords: ["love", "cupid", "romance", "kiss", "lovers", "heart"] },
  { key: "spring",       start: [3, 15],  end: [4, 5],   keywords: ["spring", "flowers", "bloom", "garden", "pastoral"] },
  { key: "easter",       start: [3, 25],  end: [4, 20],  keywords: ["resurrection", "easter", "lamb", "crucifixion", "madonna"] },
  { key: "summer",       start: [6, 15],  end: [7, 10],  keywords: ["summer", "sun", "sea", "beach", "bathing", "harvest"] },
  { key: "halloween",    start: [10, 20], end: [11, 1],  keywords: ["skull", "death", "skeleton", "night", "dark", "witch"] },
  { key: "thanksgiving", start: [11, 18], end: [11, 28], keywords: ["harvest", "feast", "abundance", "cornucopia", "gratitude"] },
  { key: "christmas",    start: [12, 10], end: [12, 26], keywords: ["nativity", "christmas", "madonna", "angel", "snow", "winter"] },
];

function getActiveSeason() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  for (const season of SEASONAL_CALENDAR) {
    const [sm, sd] = season.start;
    const [em, ed] = season.end;

    // Handle year-wrapping (e.g. new-year: Dec 20 → Jan 5)
    if (sm > em) {
      if ((month > sm || (month === sm && day >= sd)) ||
          (month < em || (month === em && day <= ed))) {
        return season;
      }
    } else {
      if ((month > sm || (month === sm && day >= sd)) &&
          (month < em || (month === em && day <= ed))) {
        return season;
      }
    }
  }
  return null;
}

function shouldPostSeasonal(historyData) {
  const season = getActiveSeason();
  if (!season) return null;
  if (historyData.postsSinceLastSeasonal < 2) return null;
  if (Math.random() > 0.2) return null;
  return season;
}

async function fetchSeasonalArtwork(season, historySet) {
  const keyword = pick(season.keywords);
  console.log(`Seasonal (${season.key}): searching for "${keyword}"...`);

  const available = SOURCES.filter((s) => !s.needsKey || HARVARD_API_KEY);
  const shuffled = available.sort(() => Math.random() - 0.5);

  for (const source of shuffled) {
    try {
      if (source.name === "Harvard") {
        const url = `${HARVARD_API}?apikey=${HARVARD_API_KEY}&size=10&hasimage=1&keyword=${encodeURIComponent(keyword)}&fields=${HARVARD_FIELDS}`;
        const data = await fetchJson(url);
        const records = data.records?.filter((r) => r.primaryimageurl) || [];
        if (records.length === 0) continue;
        const r = pick(records);
        const artist = r.people?.map((p) => p.name).filter(Boolean).join(", ") || "Unknown artist";
        const art = {
          id: r.objectid, title: r.title || "Untitled", artist,
          imageUrl: r.primaryimageurl, source: "harvard", culture: r.culture,
          dated: r.dated, classification: r.classification, medium: r.medium,
          url: r.url || `https://harvardartmuseums.org/collections/object/${r.objectid}`,
          museumName: "Harvard Art Museums",
        };
        if (!historySet.has(artKey(art))) return art;
      } else if (source.name === "Met") {
        const searchUrl = `${MET_API}/search?hasImages=true&q=${encodeURIComponent(keyword)}`;
        const searchData = await fetchJson(searchUrl);
        const ids = searchData.objectIDs;
        if (!ids || ids.length === 0) continue;
        for (let i = 0; i < Math.min(5, ids.length); i++) {
          const id = pick(ids);
          try {
            const obj = await fetchJson(`${MET_API}/objects/${id}`);
            const imageUrl = obj.primaryImage || obj.primaryImageSmall;
            if (!imageUrl) continue;
            const art = {
              id: obj.objectID, title: obj.title || "Untitled",
              artist: obj.artistDisplayName || "Unknown artist", imageUrl, source: "met",
              culture: obj.culture, dated: obj.objectDate, classification: obj.classification,
              medium: obj.medium,
              url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
              museumName: "The Metropolitan Museum of Art",
            };
            if (!historySet.has(artKey(art))) return art;
          } catch { continue; }
        }
      } else if (source.name === "AIC") {
        const url = `${AIC_API}/artworks/search?q=${encodeURIComponent(keyword)}&limit=10&fields=${AIC_FIELDS}`;
        const data = await fetchJson(url);
        const records = data.data?.filter((r) => r.image_id) || [];
        if (records.length === 0) continue;
        const r = pick(records);
        const art = {
          id: r.id, title: r.title || "Untitled",
          artist: r.artist_display || "Unknown artist",
          imageUrl: `${AIC_IIIF}/${r.image_id}/full/843,/0/default.jpg`,
          source: "artic", culture: r.place_of_origin, dated: r.date_display,
          classification: r.classification_title, medium: r.medium_display,
          url: `https://www.artic.edu/artworks/${r.id}`,
          museumName: "Art Institute of Chicago",
        };
        if (!historySet.has(artKey(art))) return art;
      }
    } catch (err) {
      console.warn(`Seasonal search (${source.name}) failed: ${err.message}`);
    }
  }

  console.log("No seasonal artwork found — falling back to random");
  return null;
}

// ── Dropbox upload (confirmed working with Instagram API) ───────────────────

const {
  DROPBOX_REFRESH_TOKEN,
  DROPBOX_APP_KEY,
  DROPBOX_APP_SECRET,
} = process.env;

async function getDropboxToken() {
  if (!DROPBOX_REFRESH_TOKEN || !DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
    throw new Error("DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and DROPBOX_APP_SECRET must be set");
  }

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: DROPBOX_REFRESH_TOKEN,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dropbox token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function uploadImage(imageBuffer) {
  const token = await getDropboxToken();
  const filename = `arttok-${Date.now()}.jpg`;
  const path = `/arttok/${filename}`;

  // 1. Upload file
  const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "overwrite",
        mute: true,
      }),
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`Dropbox upload failed (${uploadRes.status}): ${body}`);
  }

  // 2. Create shared link
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

  let shareUrl;
  if (shareRes.ok) {
    const shareData = await shareRes.json();
    shareUrl = shareData.url;
  } else {
    // Link may already exist — try to get existing
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
    if (!shareUrl) throw new Error("Failed to create or find Dropbox shared link");
  }

  // 3. Convert to direct download URL (replace dl=0 with raw=1)
  const directUrl = shareUrl.replace(/\?dl=0$/, "?raw=1").replace(/&dl=0/, "&raw=1");
  return { url: directUrl, path, token };
}

async function deleteFromDropbox(path, token) {
  try {
    await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    console.log("Cleaned up Dropbox file");
  } catch {
    // Non-fatal — file will just stay in Dropbox
  }
}

// ── Token auto-refresh ───────────────────────────────────────────────────────

const IG_GRAPH = "https://graph.facebook.com/v21.0";

async function refreshTokenIfNeeded() {
  if (!META_APP_ID || !META_APP_SECRET || !FACEBOOK_PAGE_ID) {
    // Can't auto-refresh without app credentials — use existing token
    return;
  }

  try {
    // Check if current token is still valid
    const debugRes = await fetch(
      `${IG_GRAPH}/debug_token?input_token=${INSTAGRAM_ACCESS_TOKEN}&access_token=${META_APP_ID}|${META_APP_SECRET}`,
    );
    const debugData = await debugRes.json();

    if (debugData.data?.is_valid) {
      const expiresAt = debugData.data.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const daysLeft = expiresAt ? (expiresAt - now) / 86400 : Infinity;

      if (daysLeft > 7) {
        console.log(`Token valid (${Math.floor(daysLeft)} days remaining)`);
        return;
      }
      console.log(`Token expiring soon (${Math.floor(daysLeft)} days) — refreshing...`);
    } else {
      console.log("Token invalid — attempting refresh...");
    }

    // Exchange current token for a fresh long-lived user token
    const exchangeRes = await fetch(
      `${IG_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${INSTAGRAM_ACCESS_TOKEN}`,
    );
    const exchangeData = await exchangeRes.json();

    if (exchangeData.access_token) {
      // Get fresh page token
      const accountsRes = await fetch(
        `${IG_GRAPH}/me/accounts?access_token=${exchangeData.access_token}`,
      );
      const accountsData = await accountsRes.json();
      const page = accountsData.data?.find((p) => p.id === FACEBOOK_PAGE_ID);

      if (page?.access_token) {
        INSTAGRAM_ACCESS_TOKEN = page.access_token;
        console.log("Token refreshed successfully");
        return;
      }
    }

    console.warn("Token refresh failed — using existing token");
  } catch (err) {
    console.warn(`Token refresh error: ${err.message} — using existing token`);
  }
}

// ── Alt text ─────────────────────────────────────────────────────────────────

function buildAltText(art) {
  const parts = [`${art.title} by ${art.artist}`];
  if (art.medium) parts.push(art.medium);
  parts.push(art.museumName);
  return parts.join(". ").slice(0, 1000);
}

// ── Instagram Graph API publishing ──────────────────────────────────────────

async function publishToInstagram(imageUrl, caption, { isStory = false, altText = "" } = {}) {
  if (!INSTAGRAM_ACCESS_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  if (!INSTAGRAM_USER_ID) throw new Error("INSTAGRAM_USER_ID not set");

  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: isStory ? "" : caption, // stories don't support captions via API
    access_token: INSTAGRAM_ACCESS_TOKEN,
  });

  if (altText && !isStory) {
    containerParams.set("alt_text", altText);
  }

  if (isStory) {
    containerParams.set("media_type", "STORIES");
  }

  const containerRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${containerParams.toString()}`,
    { method: "POST" },
  );

  if (!containerRes.ok) {
    const body = await containerRes.text();
    throw new Error(`Instagram container creation failed (${containerRes.status}): ${body}`);
  }

  const { id: containerId } = await containerRes.json();
  console.log(`Container created: ${containerId}`);

  // Step 2: Wait for container to be ready (Instagram processes the image)
  await waitForContainer(containerId);

  // Step 3: Publish
  const publishRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: INSTAGRAM_ACCESS_TOKEN,
      }).toString(),
    },
  );

  if (!publishRes.ok) {
    const body = await publishRes.text();
    throw new Error(`Instagram publish failed (${publishRes.status}): ${body}`);
  }

  const { id: mediaId } = await publishRes.json();
  return mediaId;
}

async function waitForContainer(containerId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_GRAPH}/${containerId}?fields=status_code&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
    );
    const data = await res.json();

    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("Instagram container processing failed");

    console.log(`Container status: ${data.status_code} (attempt ${i + 1}/${maxAttempts})`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Instagram container processing timed out");
}

// ── First comment (hashtags) ─────────────────────────────────────────────────

async function postFirstComment(mediaId, text) {
  try {
    const res = await fetch(`${IG_GRAPH}/${mediaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: text,
        access_token: INSTAGRAM_ACCESS_TOKEN,
      }).toString(),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`First comment failed (${res.status}): ${body}`);
    } else {
      console.log("First comment (hashtags) posted");
    }
  } catch (err) {
    console.warn(`First comment error: ${err.message}`);
  }
}

// ── Auto-story ──────────────────────────────────────────────────────────────

async function publishAutoStory(art) {
  try {
    console.log("Rendering auto-story card...");
    const storyBuffer = await renderStoryCard(art, art.imageUrl);
    console.log(`Story card rendered: ${(storyBuffer.length / 1024).toFixed(0)} KB`);

    const { url: storyUrl, path: storyPath, token: storyToken } = await uploadImage(storyBuffer);
    console.log("Publishing auto-story...");
    await publishToInstagram(storyUrl, "", { isStory: true });
    await deleteFromDropbox(storyPath, storyToken);
    console.log("Auto-story published");
  } catch (err) {
    console.warn(`Auto-story failed (non-fatal): ${err.message}`);
  }
}

// ── Reels ────────────────────────────────────────────────────────────────────

function pickAudioTrack() {
  const audioDir = join(__dirname, "audio");
  const files = readdirSync(audioDir).filter((f) => f.endsWith(".mp3"));
  if (files.length === 0) throw new Error("No MP3 files found in audio/ directory");
  return join(audioDir, pick(files));
}

async function createReelVideo(art) {
  const cardBuffer = await renderStoryCard(art, art.imageUrl);
  console.log(`Reel card rendered: ${(cardBuffer.length / 1024).toFixed(0)} KB`);

  const audioPath = pickAudioTrack();
  console.log(`Audio track: ${audioPath.split(/[\\/]/).pop()}`);

  const tmpDir = join(__dirname, "tmp");
  if (!existsSync(tmpDir)) {
    execSync(`mkdir -p "${tmpDir}"`);
  }
  const cardPath = join(tmpDir, `reel-card-${Date.now()}.png`);
  const reelPath = join(tmpDir, `reel-${Date.now()}.mp4`);

  writeFileSync(cardPath, cardBuffer);

  try {
    execSync(
      `ffmpeg -y -loop 1 -i "${cardPath}" -i "${audioPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 128k -pix_fmt yuv420p -shortest -t 30 -movflags +faststart "${reelPath}"`,
      { stdio: "pipe", timeout: 60000 },
    );

    const videoBuffer = readFileSync(reelPath);
    console.log(`Reel video created: ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    return videoBuffer;
  } finally {
    try { unlinkSync(cardPath); } catch { /* ignore */ }
    try { unlinkSync(reelPath); } catch { /* ignore */ }
  }
}

async function publishReel(videoBuffer, caption, altText) {
  if (!INSTAGRAM_ACCESS_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  if (!INSTAGRAM_USER_ID) throw new Error("INSTAGRAM_USER_ID not set");

  // Upload video to Dropbox
  const token = await getDropboxToken();
  const filename = `arttok-reel-${Date.now()}.mp4`;
  const path = `/arttok/${filename}`;

  const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`Dropbox video upload failed (${uploadRes.status}): ${body}`);
  }

  // Create shared link
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

  let shareUrl;
  if (shareRes.ok) {
    const shareData = await shareRes.json();
    shareUrl = shareData.url;
  } else {
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
    if (!shareUrl) throw new Error("Failed to create or find Dropbox shared link for video");
  }

  const videoUrl = shareUrl.replace(/\?dl=0$/, "?raw=1").replace(/&dl=0/, "&raw=1");
  console.log(`Reel hosted at: ${videoUrl}`);

  // Create REELS container
  const containerParams = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: INSTAGRAM_ACCESS_TOKEN,
  });

  if (altText) {
    containerParams.set("alt_text", altText);
  }

  const containerRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${containerParams.toString()}`,
    { method: "POST" },
  );

  if (!containerRes.ok) {
    const body = await containerRes.text();
    throw new Error(`Reel container creation failed (${containerRes.status}): ${body}`);
  }

  const { id: containerId } = await containerRes.json();
  console.log(`Reel container created: ${containerId}`);

  // Wait for video processing (30 attempts — video takes longer)
  await waitForContainer(containerId, 30);

  // Publish
  const publishRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: INSTAGRAM_ACCESS_TOKEN,
      }).toString(),
    },
  );

  if (!publishRes.ok) {
    const body = await publishRes.text();
    throw new Error(`Reel publish failed (${publishRes.status}): ${body}`);
  }

  const { id: mediaId } = await publishRes.json();

  // Clean up Dropbox
  await deleteFromDropbox(path, token);

  return mediaId;
}

// ── Hashtag pools ────────────────────────────────────────────────────────────

const CORE_TAGS = ["#arttok", "#fineart", "#arthistory"];

const ROTATING_TAGS = [
  "#classicalart", "#museumlife", "#masterpiece", "#artdiscovery",
  "#paintingoftheday", "#artappreciation", "#artcollector", "#fineartphotography",
  "#artgallery", "#culturalheritage", "#artistsoninstagram", "#artworld",
  "#arthistorynerd", "#classicalmasterpiece", "#museumlover", "#oilpaintingart",
  "#artcurator", "#dailyart", "#arteducation", "#artlovers",
  "#renaissanceart", "#impressionism", "#baroqueart", "#modernart",
  "#artmuseum", "#contemporaryart", "#europeanart", "#portraitpainting",
  "#landscapepainting", "#artoftheday", "#instaart", "#artexhibition",
  "#gallerywall", "#oldmasters", "#fineartfriday", "#artcommunity",
  "#artinspiration", "#worldofart", "#artdaily", "#artlover",
];

const MOVEMENT_TAGS = {
  painting: "#painting", paintings: "#painting",
  oil: "#oilpainting", watercolor: "#watercolor",
  sculpture: "#sculpture", photograph: "#photography",
  print: "#printmaking", drawing: "#drawing",
  ceramic: "#ceramics", textile: "#textileart",
};

const MUSEUM_TAGS = {
  harvard: "#harvardartmuseums",
  met: "#themet",
  artic: "#artinstituteofchicago",
};

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function buildHashtags(art) {
  const tags = [...CORE_TAGS];

  // Museum tag
  tags.push(MUSEUM_TAGS[art.source] || "#museum");

  // Medium/movement-specific tags (allow up to 2)
  if (art.medium) {
    const mediumLower = art.medium.toLowerCase();
    let mediumCount = 0;
    for (const [keyword, tag] of Object.entries(MOVEMENT_TAGS)) {
      if (mediumLower.includes(keyword)) {
        tags.push(tag);
        mediumCount++;
        if (mediumCount >= 2) break;
      }
    }
  }

  // Culture-specific tag
  if (art.culture) {
    const clean = art.culture.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (clean.length > 2 && clean.length < 30) tags.push(`#${clean}`);
  }

  // Fill remaining slots from rotating pool (target 20-25 total)
  const target = 20 + Math.floor(Math.random() * 6); // 20-25
  const remaining = target - tags.length;
  if (remaining > 0) tags.push(...pickRandom(ROTATING_TAGS, remaining));

  return tags.join(" ");
}

// ── Caption builder ─────────────────────────────────────────────────────────

function buildCaption(art) {
  const lines = [];

  // Title block — authoritative, museum-label style
  lines.push(art.title);
  if (art.artist !== "Unknown artist") lines.push(art.artist);

  const details = [];
  if (art.dated) details.push(art.dated);
  if (art.medium) details.push(art.medium);
  if (details.length) lines.push(details.join(" · "));

  lines.push(art.museumName);
  lines.push("");

  // CTA
  lines.push("Follow @arttok.art for masterworks from the world's greatest museums.");

  return lines.join("\n");
}

// ── Mode cycle ───────────────────────────────────────────────────────────────

const MODE_CYCLE = ["post", "post", "reel", "post"];

function getRunMode(historyData) {
  if (IS_STORY) return "story";
  if (IS_REEL) return "reel";
  return MODE_CYCLE[historyData.runIndex % MODE_CYCLE.length];
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load history data (object format, auto-migrates from array)
  const historyData = loadHistoryData();
  const historySet = new Set(historyData.posted);

  // 2. Determine mode from cycle (or CLI override)
  const mode = getRunMode(historyData);
  console.log(`ArtTok Instagram Poster — ${mode} mode${DRY_RUN ? " (dry run)" : ""}`);
  console.log("─".repeat(50));
  console.log(`History: ${historySet.size} previously posted artworks (run #${historyData.runIndex})`);

  // 3. Fetch artwork with seasonal check + retry loop
  let art;
  let pngBuffer;
  const MAX_RETRIES = 5;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (SPECIFIC_ART) {
        art = await fetchSpecificArtwork(SPECIFIC_ART);
      } else {
        // Check for seasonal content
        const season = shouldPostSeasonal(historyData);
        if (season) {
          art = await fetchSeasonalArtwork(season, historySet);
        }
        if (!art) {
          art = await fetchRandomArtwork(historySet);
        }
      }

      // Render appropriate card
      const isStoryRender = mode === "story" || mode === "reel";
      const renderFn = isStoryRender ? renderStoryCard : renderPostCard;
      console.log(`Rendering ${mode} card...`);
      pngBuffer = await renderFn(art, art.imageUrl);
      console.log(`Card rendered: ${(pngBuffer.length / 1024).toFixed(0)} KB`);
      break;
    } catch (err) {
      console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt === MAX_RETRIES || SPECIFIC_ART) throw err;
      art = null; // Reset so seasonal fallback can retry
    }
  }

  // 4. Dry-run: save card + optional reel video, print caption + hashtags, exit
  if (DRY_RUN) {
    const basename = `arttok-${art.source}-${art.id}-${mode}`;
    writeFileSync(`${basename}.png`, pngBuffer);
    console.log(`\nSaved to ${basename}.png`);

    if (mode === "reel") {
      try {
        console.log("\nCreating reel video (dry-run)...");
        const videoBuffer = await createReelVideo(art);
        writeFileSync(`${basename}.mp4`, videoBuffer);
        console.log(`Saved to ${basename}.mp4 (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        console.warn(`Reel video failed: ${err.message}`);
        console.warn("Install ffmpeg to test reel creation locally");
      }
    }

    console.log(`\nCaption:\n${buildCaption(art)}`);
    console.log(`\nHashtags:\n${buildHashtags(art)}`);
    return;
  }

  // 5. Refresh token
  await refreshTokenIfNeeded();

  const caption = buildCaption(art);
  const altText = buildAltText(art);
  const hashtags = buildHashtags(art);
  let mediaId;

  // 6. Publish based on mode
  if (mode === "reel") {
    console.log("Creating reel video...");
    const videoBuffer = await createReelVideo(art);
    console.log("Publishing reel...");
    mediaId = await publishReel(videoBuffer, caption, altText);
  } else if (mode === "story") {
    console.log("Uploading story image...");
    const { url: publicUrl, path: dropboxPath, token: dropboxToken } = await uploadImage(pngBuffer);
    console.log(`Hosted at: ${publicUrl}`);
    console.log("Publishing story...");
    mediaId = await publishToInstagram(publicUrl, caption, { isStory: true, altText });
    await deleteFromDropbox(dropboxPath, dropboxToken);
  } else {
    // post mode
    console.log("Uploading post image...");
    const { url: publicUrl, path: dropboxPath, token: dropboxToken } = await uploadImage(pngBuffer);
    console.log(`Hosted at: ${publicUrl}`);
    console.log("Publishing post...");
    mediaId = await publishToInstagram(publicUrl, caption, { altText });
    await deleteFromDropbox(dropboxPath, dropboxToken);
  }

  // 7. Post first comment with hashtags (not for stories)
  if (mode !== "story") {
    await postFirstComment(mediaId, hashtags);
  }

  // 8. Publish auto-story (not if already a story)
  if (mode !== "story") {
    await publishAutoStory(art);
  }

  // 9. Update history
  const wasSeasonal = getActiveSeason() !== null && SPECIFIC_ART === null;
  historyData.posted.push(artKey(art));
  historyData.postsSinceLastSeasonal = wasSeasonal ? 0 : historyData.postsSinceLastSeasonal + 1;
  historyData.runIndex = (historyData.runIndex + 1) % MODE_CYCLE.length;

  // 10. Save history
  saveHistoryData(historyData);

  console.log("─".repeat(50));
  console.log(`Published! Media ID: ${mediaId} (${mode})`);
  console.log(`"${art.title}" by ${art.artist}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

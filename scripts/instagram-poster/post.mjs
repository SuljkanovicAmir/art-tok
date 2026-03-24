#!/usr/bin/env node
/**
 * ArtTok Instagram Auto-Poster
 *
 * Fetches a random artwork from Harvard/Met/AIC, generates a watercolor-style
 * card (post or story), uploads to Imgur for hosting, then publishes to
 * Instagram via Meta Graph API.
 *
 * Usage:
 *   node post.mjs              # post (1080x1350 feed)
 *   node post.mjs --story      # story (1080x1920, disappears in 24h)
 *   node post.mjs --dry-run    # generate card locally, skip Instagram publish
 *
 * Required env vars (see .env.example):
 *   INSTAGRAM_ACCESS_TOKEN  — long-lived page access token
 *   INSTAGRAM_USER_ID       — Instagram Business/Creator account ID
 *   IMGUR_CLIENT_ID         — Imgur app client ID (for temp image hosting)
 *   HARVARD_API_KEY         — Harvard Art Museums API key
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { renderPostCard, renderStoryCard } from "./render.mjs";

// ── Post history (duplicate prevention) ─────────────────────────────────────

const HISTORY_FILE = new URL("./posted-history.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const MAX_HISTORY = 5000;

function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    return new Set(data);
  } catch {
    return new Set();
  }
}

function saveHistory(history) {
  const arr = [...history];
  // Keep only the most recent entries to prevent unbounded growth
  const trimmed = arr.slice(-MAX_HISTORY);
  writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
}

function artKey(art) {
  return `${art.source}:${art.id}`;
}

// ── Config ──────────────────────────────────────────────────────────────────

const {
  INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_USER_ID,
  HARVARD_API_KEY,
} = process.env;

const args = process.argv.slice(2);
const IS_STORY = args.includes("--story");
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

async function fetchRandomArtwork(history) {
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

        if (history.has(key)) {
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

// ── Instagram Graph API publishing ──────────────────────────────────────────

const IG_GRAPH = "https://graph.facebook.com/v21.0";

async function publishToInstagram(imageUrl, caption, isStory = false) {
  if (!INSTAGRAM_ACCESS_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  if (!INSTAGRAM_USER_ID) throw new Error("INSTAGRAM_USER_ID not set");

  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: isStory ? "" : caption, // stories don't support captions via API
    access_token: INSTAGRAM_ACCESS_TOKEN,
  });

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

// ── Caption builder ─────────────────────────────────────────────────────────

function buildCaption(art) {
  const lines = [];

  lines.push(`\uD83C\uDFA8 ${art.title}`);
  if (art.artist !== "Unknown artist") lines.push(`\u270F\uFE0F ${art.artist}`);
  if (art.dated) lines.push(`\uD83D\uDCC5 ${art.dated}`);
  lines.push(`\uD83C\uDFDB\uFE0F ${art.museumName}`);
  lines.push("");
  if (art.medium) lines.push(art.medium);
  lines.push("");
  lines.push(`\uD83D\uDD17 ${art.url}`);
  lines.push("");

  lines.push("Follow @arttok.art for daily masterworks from the world's greatest museums.");
  lines.push("");

  // Hashtags
  const tags = ["#arttok", "#art", "#museum", "#artwork", "#fineart", "#dailyart", "#arthistory", "#classicart", "#masterpiece", "#artlovers"];
  if (art.culture) tags.push(`#${art.culture.replace(/\s+/g, "").toLowerCase()}`);
  if (art.classification) tags.push(`#${art.classification.replace(/[\s,]+/g, "").toLowerCase()}`);
  tags.push(`#${art.source === "harvard" ? "harvardartmuseums" : art.source === "met" ? "themet" : "artinstituteofchicago"}`);
  lines.push(tags.join(" "));

  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`ArtTok Instagram Poster — ${IS_STORY ? "Story" : "Post"} mode${DRY_RUN ? " (dry run)" : ""}`);
  console.log("─".repeat(50));

  // 1. Fetch artwork + render card (retry if image fetch fails)
  const history = loadHistory();
  console.log(`History: ${history.size} previously posted artworks`);
  const renderFn = IS_STORY ? renderStoryCard : renderPostCard;

  let art;
  let pngBuffer;
  const MAX_RETRIES = 5;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      art = SPECIFIC_ART
        ? await fetchSpecificArtwork(SPECIFIC_ART)
        : await fetchRandomArtwork(history);

      console.log(`Rendering ${IS_STORY ? "story" : "post"} card...`);
      pngBuffer = await renderFn(art, art.imageUrl);
      console.log(`Card rendered: ${(pngBuffer.length / 1024).toFixed(0)} KB`);
      break;
    } catch (err) {
      console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt === MAX_RETRIES || SPECIFIC_ART) throw err;
    }
  }

  // In dry-run mode, save locally and exit
  if (DRY_RUN) {
    const filename = `arttok-${art.source}-${art.id}-${IS_STORY ? "story" : "post"}.jpg`;
    writeFileSync(filename, pngBuffer);
    console.log(`\nSaved to ${filename}`);
    console.log(`\nCaption:\n${buildCaption(art)}`);
    return;
  }

  // 3. Upload for public URL
  console.log("Uploading image...");
  const { url: publicUrl, path: dropboxPath, token: dropboxToken } = await uploadImage(pngBuffer);
  console.log(`Hosted at: ${publicUrl}`);

  // 4. Publish to Instagram
  console.log("Publishing to Instagram...");
  const caption = buildCaption(art);
  const mediaId = await publishToInstagram(publicUrl, caption, IS_STORY);

  // 5. Clean up Dropbox file (Instagram already downloaded it)
  await deleteFromDropbox(dropboxPath, dropboxToken);

  // 6. Record in history
  history.add(artKey(art));
  saveHistory(history);

  console.log("─".repeat(50));
  console.log(`Published! Media ID: ${mediaId}`);
  console.log(`"${art.title}" by ${art.artist}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

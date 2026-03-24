# Instagram Automation Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the Instagram auto-poster with 7 features: reduced cadence, alt text, first-comment hashtags, auto-stories, reels with classical music, seasonal content, and weekly analytics.

**Architecture:** All changes are in `scripts/instagram-poster/post.mjs` (the main orchestrator) and two new files: `analytics.mjs` + a GitHub Actions workflow. The existing `render.mjs` is untouched. History format migrates from a plain array to an object with metadata.

**Tech Stack:** Node.js 20, node-canvas, ffmpeg (for reels), Instagram Graph API v21.0, Dropbox API (image hosting)

---

### Task 1: Migrate history format from array to object

The current `posted-history.json` is a plain array `["harvard:229060"]`. All new features need metadata (runIndex, postsSinceLastSeasonal). Migrate to object format with backward compatibility.

**Files:**
- Modify: `scripts/instagram-poster/post.mjs:24-48`

**Step 1: Replace loadHistory and saveHistory**

Replace lines 24-48 in `post.mjs` with:

```js
// ── Post history (duplicate prevention + state) ──────────────────────────────

const HISTORY_FILE = new URL("./posted-history.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const MAX_HISTORY = 5000;

function loadHistoryData() {
  if (!existsSync(HISTORY_FILE)) return { posted: [], runIndex: 0, postsSinceLastSeasonal: 99 };
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

function saveHistoryData(data) {
  const trimmed = data.posted.slice(-MAX_HISTORY);
  writeFileSync(HISTORY_FILE, JSON.stringify({
    posted: trimmed,
    runIndex: data.runIndex,
    postsSinceLastSeasonal: data.postsSinceLastSeasonal,
  }, null, 2));
}

function artKey(art) {
  return `${art.source}:${art.id}`;
}
```

**Step 2: Update all references in main()**

In the `main()` function (line 623+), replace:
- `const history = loadHistory();` → `const historyData = loadHistoryData();`
- `history.size` → `historyData.posted.length`
- `history` passed to `fetchRandomArtwork()` → `new Set(historyData.posted)`
- `history.add(artKey(art));` → `historyData.posted.push(artKey(art));`
- `saveHistory(history);` → `saveHistoryData(historyData);`

**Step 3: Verify with dry-run**

Run: `cd scripts/instagram-poster && node post.mjs --dry-run`
Expected: Card renders, no crash. `posted-history.json` stays unchanged (dry-run doesn't save).

**Step 4: Commit**

```bash
git add scripts/instagram-poster/post.mjs
git commit -m "refactor: migrate posted-history.json to object format with backward compat"
```

---

### Task 2: Add alt text to Instagram API calls

**Files:**
- Modify: `scripts/instagram-poster/post.mjs` — `publishToInstagram()` function (lines 464-515)

**Step 1: Add buildAltText helper**

Add this function before `publishToInstagram`:

```js
function buildAltText(art) {
  const parts = [`${art.title} by ${art.artist}`];
  if (art.medium) parts.push(art.medium);
  parts.push(art.museumName);
  return parts.join(". ").slice(0, 1000); // IG alt text limit
}
```

**Step 2: Add alt_text to container params**

In `publishToInstagram()`, change the function signature and add alt_text:

```js
async function publishToInstagram(imageUrl, caption, { isStory = false, altText = "" } = {}) {
```

After the existing `containerParams` creation (line 473), add:

```js
  if (altText && !isStory) {
    containerParams.set("alt_text", altText);
  }
```

**Step 3: Update the call site in main()**

Where `publishToInstagram` is called, change to:

```js
const altText = buildAltText(art);
const mediaId = await publishToInstagram(publicUrl, caption, { isStory: IS_STORY, altText });
```

**Step 4: Verify with dry-run**

Run: `cd scripts/instagram-poster && node post.mjs --dry-run`
Expected: No crash (alt text only used in live publish path).

**Step 5: Commit**

```bash
git add scripts/instagram-poster/post.mjs
git commit -m "feat: add alt text to Instagram posts for accessibility"
```

---

### Task 3: Move hashtags to first comment

**Files:**
- Modify: `scripts/instagram-poster/post.mjs` — hashtag section (lines 535-618) and main()

**Step 1: Expand the rotating hashtag pool**

Replace the existing `ROTATING_TAGS` array (lines 539-543) with:

```js
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
```

**Step 2: Update buildHashtags to produce 20-25 tags**

Replace the `buildHashtags` function:

```js
function buildHashtags(art) {
  const tags = [...CORE_TAGS];

  // Museum tag
  tags.push(MUSEUM_TAGS[art.source] || "#museum");

  // Medium/movement-specific tags (up to 2)
  if (art.medium) {
    const mediumLower = art.medium.toLowerCase();
    let added = 0;
    for (const [keyword, tag] of Object.entries(MOVEMENT_TAGS)) {
      if (mediumLower.includes(keyword)) {
        tags.push(tag);
        if (++added >= 2) break;
      }
    }
  }

  // Culture-specific tag
  if (art.culture) {
    const clean = art.culture.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (clean.length > 2 && clean.length < 30) tags.push(`#${clean}`);
  }

  // Fill to 20-25 from rotating pool
  const target = 20 + Math.floor(Math.random() * 6); // 20-25
  const remaining = target - tags.length;
  if (remaining > 0) tags.push(...pickRandom(ROTATING_TAGS, remaining));

  return tags.join(" ");
}
```

**Step 3: Remove hashtags from buildCaption**

Replace `buildCaption`:

```js
function buildCaption(art) {
  const lines = [];

  lines.push(art.title);
  if (art.artist !== "Unknown artist") lines.push(art.artist);

  const details = [];
  if (art.dated) details.push(art.dated);
  if (art.medium) details.push(art.medium);
  if (details.length) lines.push(details.join(" · "));

  lines.push(art.museumName);
  lines.push("");
  lines.push("Follow @arttok.art for masterworks from the world's greatest museums.");

  return lines.join("\n");
}
```

**Step 4: Add postFirstComment function**

Add this after `waitForContainer`:

```js
async function postFirstComment(mediaId, text) {
  try {
    const res = await fetch(
      `${IG_GRAPH}/${mediaId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          message: text,
          access_token: INSTAGRAM_ACCESS_TOKEN,
        }).toString(),
      },
    );
    if (res.ok) {
      console.log("First comment posted with hashtags");
    } else {
      const body = await res.text();
      console.warn(`First comment failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.warn(`First comment error: ${err.message}`);
  }
}
```

**Step 5: Call postFirstComment after publish in main()**

After the `publishToInstagram` call and before `deleteFromDropbox`, add:

```js
  // Post hashtags as first comment
  if (!IS_STORY) {
    const hashtags = buildHashtags(art);
    await postFirstComment(mediaId, hashtags);
  }
```

**Step 6: Verify with dry-run**

Run: `cd scripts/instagram-poster && node post.mjs --dry-run`
Expected: Caption output has NO hashtags. No crash.

**Step 7: Commit**

```bash
git add scripts/instagram-poster/post.mjs
git commit -m "feat: move hashtags to first comment, expand to 20-25 niche tags"
```

---

### Task 4: Add auto-story after every feed post

**Files:**
- Modify: `scripts/instagram-poster/post.mjs` — main() function

**Step 1: Add publishAutoStory helper**

Add this function before `main()`:

```js
async function publishAutoStory(art) {
  console.log("Rendering auto-story card...");
  const storyBuffer = await renderStoryCard(art, art.imageUrl);
  console.log(`Story card rendered: ${(storyBuffer.length / 1024).toFixed(0)} KB`);

  console.log("Uploading story image...");
  const { url: storyUrl, path: storyPath, token: storyToken } = await uploadImage(storyBuffer);

  console.log("Publishing story...");
  const storyId = await publishToInstagram(storyUrl, "", { isStory: true });
  await deleteFromDropbox(storyPath, storyToken);

  console.log(`Auto-story published! Media ID: ${storyId}`);
  return storyId;
}
```

**Step 2: Call it in main() after feed post publish**

After `postFirstComment` (or after `publishToInstagram` for story-only runs), add:

```js
  // Auto-story: publish same artwork as a story
  if (!IS_STORY) {
    try {
      await publishAutoStory(art);
    } catch (err) {
      console.warn(`Auto-story failed (non-fatal): ${err.message}`);
    }
  }
```

**Step 3: Verify with dry-run**

Run: `cd scripts/instagram-poster && node post.mjs --dry-run`
Expected: No crash. Auto-story logic only runs in live mode.

**Step 4: Commit**

```bash
git add scripts/instagram-poster/post.mjs
git commit -m "feat: auto-publish story alongside every feed post"
```

---

### Task 5: Add reel support (ffmpeg + classical music)

**Files:**
- Modify: `scripts/instagram-poster/post.mjs` — add reel pipeline
- Already present: `scripts/instagram-poster/audio/*.mp3` (6 tracks downloaded)

**Step 1: Add imports for child_process and path**

At the top of post.mjs, after existing imports, add:

```js
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
```

**Step 2: Add reel creation function**

Add before `main()`:

```js
// ── Reel creation (static image + classical music → 30s MP4) ────────────────

function pickAudioTrack() {
  const audioDir = join(__dirname, "audio");
  const tracks = readdirSync(audioDir).filter((f) => f.endsWith(".mp3"));
  if (tracks.length === 0) throw new Error("No audio tracks found in audio/");
  return join(audioDir, pick(tracks));
}

async function createReelVideo(art) {
  // 1. Render story-format card (1080x1920)
  console.log("Rendering reel card...");
  const cardBuffer = await renderStoryCard(art, art.imageUrl);

  // 2. Write temp files
  const tmpCard = join(__dirname, `tmp-reel-card-${Date.now()}.png`);
  const tmpVideo = join(__dirname, `tmp-reel-${Date.now()}.mp4`);
  writeFileSync(tmpCard, cardBuffer);

  // 3. Pick random classical music track
  const audioPath = pickAudioTrack();
  console.log(`Audio: ${audioPath.split(/[\\/]/).pop()}`);

  // 4. ffmpeg: static image + audio → 30s MP4
  try {
    execSync([
      "ffmpeg", "-y",
      "-loop", "1", "-i", tmpCard,
      "-i", audioPath,
      "-c:v", "libx264", "-tune", "stillimage",
      "-c:a", "aac", "-b:a", "128k",
      "-pix_fmt", "yuv420p",
      "-shortest", "-t", "30",
      "-movflags", "+faststart",
      tmpVideo,
    ].join(" "), { stdio: "pipe", timeout: 60000 });
  } catch (err) {
    // Clean up temp card even on failure
    try { execSync(`rm -f "${tmpCard}"`, { stdio: "pipe" }); } catch {}
    throw new Error(`ffmpeg failed: ${err.stderr?.toString().slice(-200) || err.message}`);
  }

  // 5. Read video buffer, clean up temp files
  const videoBuffer = readFileSync(tmpVideo);
  try { execSync(`rm -f "${tmpCard}" "${tmpVideo}"`, { stdio: "pipe" }); } catch {}

  console.log(`Reel video: ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);
  return videoBuffer;
}
```

**Step 3: Add publishReel function**

Add after `createReelVideo`:

```js
async function publishReel(videoBuffer, caption, altText) {
  // 1. Upload video to Dropbox
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
    shareUrl = (await shareRes.json()).url;
  } else {
    const listRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path, direct_only: true }),
    });
    const listData = await listRes.json();
    shareUrl = listData.links?.[0]?.url;
    if (!shareUrl) throw new Error("Failed to create Dropbox shared link for reel");
  }

  const videoUrl = shareUrl.replace(/\?dl=0$/, "?raw=1").replace(/&dl=0/, "&raw=1");
  console.log(`Reel hosted at: ${videoUrl}`);

  // 3. Create reel container
  const containerParams = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: INSTAGRAM_ACCESS_TOKEN,
  });
  if (altText) containerParams.set("alt_text", altText);

  const containerRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${containerParams.toString()}`,
    { method: "POST" },
  );

  if (!containerRes.ok) {
    const body = await containerRes.text();
    await deleteFromDropbox(path, token);
    throw new Error(`Reel container creation failed (${containerRes.status}): ${body}`);
  }

  const { id: containerId } = await containerRes.json();
  console.log(`Reel container created: ${containerId}`);

  // 4. Wait for processing (videos take longer)
  await waitForContainer(containerId, 30); // more attempts for video

  // 5. Publish
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
    await deleteFromDropbox(path, token);
    throw new Error(`Reel publish failed (${publishRes.status}): ${body}`);
  }

  const { id: mediaId } = await publishRes.json();

  // 6. Clean up
  await deleteFromDropbox(path, token);

  return mediaId;
}
```

**Step 4: Add --reel CLI flag and IS_REEL constant**

Near the existing CLI arg parsing (lines 62-66), add:

```js
const IS_REEL = args.includes("--reel");
```

**Step 5: Wire reel mode into main()**

This will be integrated in Task 7 (mode cycle). For now, add the `--reel` flag handling in main() so reels can be triggered manually.

In main(), after the card render loop and before dry-run check, add a reel branch:

```js
  if (IS_REEL && !DRY_RUN) {
    await refreshTokenIfNeeded();
    const videoBuffer = await createReelVideo(art);
    console.log("Publishing reel...");
    const caption = buildCaption(art);
    const altText = buildAltText(art);
    const mediaId = await publishReel(videoBuffer, caption, altText);

    // First comment with hashtags
    const hashtags = buildHashtags(art);
    await postFirstComment(mediaId, hashtags);

    // Auto-story
    try { await publishAutoStory(art); } catch (e) { console.warn(`Auto-story failed: ${e.message}`); }

    historyData.posted.push(artKey(art));
    historyData.postsSinceLastSeasonal++;
    saveHistoryData(historyData);

    console.log("─".repeat(50));
    console.log(`Reel published! Media ID: ${mediaId}`);
    console.log(`"${art.title}" by ${art.artist}`);
    return;
  }
```

**Step 6: Verify dry-run still works**

Run: `cd scripts/instagram-poster && node post.mjs --dry-run`
Expected: No crash. Reel code not exercised in dry-run.

**Step 7: Commit**

```bash
git add scripts/instagram-poster/post.mjs
git commit -m "feat: add reel support with classical music audio tracks"
```

---

### Task 6: Add seasonal content selection

**Files:**
- Modify: `scripts/instagram-poster/post.mjs` — add seasonal calendar and fetch logic

**Step 1: Add seasonal calendar**

Add after the `SOURCES` array:

```js
// ── Seasonal content calendar ──────────────────────────────────────────────

const SEASONAL_CALENDAR = [
  { key: "new-year",     start: [12, 28], end: [1, 5],   keywords: ["celebration", "feast", "winter", "fireworks"] },
  { key: "valentine",    start: [2, 10],  end: [2, 16],  keywords: ["love", "romance", "couple", "kiss", "heart", "cupid"] },
  { key: "spring",       start: [3, 15],  end: [4, 30],  keywords: ["spring", "garden", "flower", "blossom", "pastoral"] },
  { key: "easter",       start: [4, 10],  end: [4, 25],  keywords: ["resurrection", "cross", "religious", "angel", "church"] },
  { key: "summer",       start: [6, 1],   end: [8, 31],  keywords: ["summer", "beach", "sun", "sea", "bathers"] },
  { key: "halloween",    start: [10, 20], end: [10, 31], keywords: ["death", "skull", "dark", "night", "demon", "skeleton"] },
  { key: "thanksgiving", start: [11, 20], end: [11, 28], keywords: ["harvest", "feast", "autumn", "cornucopia"] },
  { key: "christmas",    start: [12, 10], end: [12, 27], keywords: ["nativity", "madonna", "christmas", "snow", "magi"] },
];

function getActiveSeason() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  for (const season of SEASONAL_CALENDAR) {
    const [sm, sd] = season.start;
    const [em, ed] = season.end;

    // Handle year-wrapping seasons (e.g., new-year: Dec 28 – Jan 5)
    if (sm > em) {
      if ((month > sm || (month === sm && day >= sd)) || (month < em || (month === em && day <= ed))) {
        return season;
      }
    } else {
      if ((month > sm || (month === sm && day >= sd)) && (month < em || (month === em && day <= ed))) {
        return season;
      }
    }
  }
  return null;
}

function shouldPostSeasonal(historyData) {
  const season = getActiveSeason();
  if (!season) return null;

  // Cooldown: at least 2 regular posts since last seasonal
  if (historyData.postsSinceLastSeasonal < 2) return null;

  // 20% probability
  if (Math.random() > 0.2) return null;

  console.log(`Seasonal content triggered: ${season.key}`);
  return season;
}
```

**Step 2: Add seasonal fetch functions**

```js
async function fetchSeasonalArtwork(season, history) {
  const keyword = pick(season.keywords);
  console.log(`Searching for seasonal keyword: "${keyword}"`);

  const attempts = [
    // Try Harvard keyword search
    async () => {
      if (!HARVARD_API_KEY) throw new Error("No Harvard key");
      const url = `${HARVARD_API}?apikey=${HARVARD_API_KEY}&size=10&hasimage=1&keyword=${encodeURIComponent(keyword)}&fields=${HARVARD_FIELDS}`;
      const data = await fetchJson(url);
      const records = data.records.filter((r) => r.primaryimageurl && !history.has(`harvard:${r.objectid}`));
      if (records.length === 0) throw new Error("No Harvard seasonal results");
      const r = pick(records);
      const artist = r.people?.map((p) => p.name).filter(Boolean).join(", ") || "Unknown artist";
      return {
        id: r.objectid, title: r.title || "Untitled", artist,
        imageUrl: r.primaryimageurl, source: "harvard", culture: r.culture,
        dated: r.dated, classification: r.classification, medium: r.medium,
        url: r.url || `https://harvardartmuseums.org/collections/object/${r.objectid}`,
        museumName: "Harvard Art Museums",
      };
    },
    // Try Met keyword search
    async () => {
      const searchUrl = `${MET_API}/search?hasImages=true&q=${encodeURIComponent(keyword)}`;
      const data = await fetchJson(searchUrl);
      const ids = data.objectIDs?.slice(0, 50);
      if (!ids || ids.length === 0) throw new Error("No Met seasonal results");
      for (let i = 0; i < Math.min(5, ids.length); i++) {
        const id = pick(ids);
        if (history.has(`met:${id}`)) continue;
        const obj = await fetchJson(`${MET_API}/objects/${id}`);
        const imageUrl = obj.primaryImage || obj.primaryImageSmall;
        if (!imageUrl) continue;
        return {
          id: obj.objectID, title: obj.title || "Untitled",
          artist: obj.artistDisplayName || "Unknown artist", imageUrl, source: "met",
          culture: obj.culture, dated: obj.objectDate, classification: obj.classification,
          medium: obj.medium,
          url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
          museumName: "The Metropolitan Museum of Art",
        };
      }
      throw new Error("No Met seasonal with images");
    },
    // Try AIC keyword search
    async () => {
      const url = `${AIC_API}/artworks/search?q=${encodeURIComponent(keyword)}&limit=10&fields=${AIC_FIELDS}`;
      const data = await fetchJson(url);
      const records = data.data.filter((r) => r.image_id && !history.has(`artic:${r.id}`));
      if (records.length === 0) throw new Error("No AIC seasonal results");
      const r = pick(records);
      return {
        id: r.id, title: r.title || "Untitled",
        artist: r.artist_display || "Unknown artist",
        imageUrl: `${AIC_IIIF}/${r.image_id}/full/843,/0/default.jpg`,
        source: "artic", culture: r.place_of_origin, dated: r.date_display,
        classification: r.classification_title, medium: r.medium_display,
        url: `https://www.artic.edu/artworks/${r.id}`,
        museumName: "Art Institute of Chicago",
      };
    },
  ];

  // Try each source, return first success
  const shuffled = attempts.sort(() => Math.random() - 0.5);
  for (const attempt of shuffled) {
    try {
      return await attempt();
    } catch {
      continue;
    }
  }
  return null; // Fall back to regular random
}
```

**Step 3: Wire seasonal into the artwork fetch in main()**

In main(), replace the artwork fetch section. Where the code currently does `fetchRandomArtwork(history)`, wrap it:

```js
    // Check for seasonal content
    const historySet = new Set(historyData.posted);
    const season = shouldPostSeasonal(historyData);
    let isSeasonal = false;

    if (season && !SPECIFIC_ART) {
      const seasonalArt = await fetchSeasonalArtwork(season, historySet);
      if (seasonalArt) {
        art = seasonalArt;
        isSeasonal = true;
        console.log(`Seasonal (${season.key}): "${art.title}"`);
      }
    }

    if (!art) {
      art = SPECIFIC_ART
        ? await fetchSpecificArtwork(SPECIFIC_ART)
        : await fetchRandomArtwork(historySet);
    }
```

And when saving history at the end of main(), update seasonal counter:

```js
  historyData.posted.push(artKey(art));
  historyData.postsSinceLastSeasonal = isSeasonal ? 0 : historyData.postsSinceLastSeasonal + 1;
  saveHistoryData(historyData);
```

**Step 4: Verify with dry-run**

Run: `cd scripts/instagram-poster && node post.mjs --dry-run`
Expected: May or may not trigger seasonal (20% chance if in window + cooldown met). No crash either way.

**Step 5: Commit**

```bash
git add scripts/instagram-poster/post.mjs
git commit -m "feat: seasonal content selection with 20% probability and cooldown"
```

---

### Task 7: Add mode cycle (post/post/reel/post) and update main()

**Files:**
- Modify: `scripts/instagram-poster/post.mjs` — rewrite main() to use mode cycle

**Step 1: Add mode cycle logic**

Add before `main()`:

```js
// ── Mode cycle: post → post → reel → post (repeats) ─────────────────────────

const MODE_CYCLE = ["post", "post", "reel", "post"];

function getRunMode(historyData) {
  // CLI flags override cycle
  if (IS_STORY) return "story";
  if (IS_REEL) return "reel";

  const mode = MODE_CYCLE[historyData.runIndex % MODE_CYCLE.length];
  return mode;
}
```

**Step 2: Rewrite main() to use mode cycle**

Replace the entire `main()` function:

```js
async function main() {
  const historyData = loadHistoryData();
  const mode = getRunMode(historyData);

  console.log(`ArtTok Instagram Poster — ${mode} mode${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`Run #${historyData.runIndex + 1} (cycle position ${(historyData.runIndex % MODE_CYCLE.length) + 1}/${MODE_CYCLE.length})`);
  console.log("─".repeat(50));

  // 1. Fetch artwork (with seasonal check + retry)
  const historySet = new Set(historyData.posted);
  console.log(`History: ${historySet.size} previously posted artworks`);

  let art;
  let isSeasonal = false;
  const MAX_RETRIES = 5;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Seasonal check (only if not requesting specific art)
      if (!art && !SPECIFIC_ART) {
        const season = shouldPostSeasonal(historyData);
        if (season) {
          const seasonalArt = await fetchSeasonalArtwork(season, historySet);
          if (seasonalArt) {
            art = seasonalArt;
            isSeasonal = true;
            console.log(`Seasonal (${season.key}): "${art.title}"`);
          }
        }
      }

      if (!art) {
        art = SPECIFIC_ART
          ? await fetchSpecificArtwork(SPECIFIC_ART)
          : await fetchRandomArtwork(historySet);
      }

      // Verify image loads by rendering a card
      const testBuffer = await renderPostCard(art, art.imageUrl);
      console.log(`Card rendered: ${(testBuffer.length / 1024).toFixed(0)} KB`);
      break;
    } catch (err) {
      console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      art = null;
      isSeasonal = false;
      if (attempt === MAX_RETRIES || SPECIFIC_ART) throw err;
    }
  }

  // 2. Dry-run: save locally and exit
  if (DRY_RUN) {
    const cardBuffer = mode === "reel"
      ? await renderStoryCard(art, art.imageUrl)
      : await renderPostCard(art, art.imageUrl);
    const ext = mode === "reel" ? "story" : "post";
    const filename = `arttok-${art.source}-${art.id}-${ext}.png`;
    writeFileSync(filename, cardBuffer);
    console.log(`\nSaved to ${filename}`);
    console.log(`\nCaption:\n${buildCaption(art)}`);
    console.log(`\nHashtags (first comment):\n${buildHashtags(art)}`);
    return;
  }

  // 3. Refresh token
  await refreshTokenIfNeeded();

  const caption = buildCaption(art);
  const altText = buildAltText(art);
  const hashtags = buildHashtags(art);
  let mediaId;

  // 4. Publish based on mode
  if (mode === "reel") {
    const videoBuffer = await createReelVideo(art);
    console.log("Publishing reel...");
    mediaId = await publishReel(videoBuffer, caption, altText);
  } else if (mode === "story") {
    const storyBuffer = await renderStoryCard(art, art.imageUrl);
    console.log("Uploading story...");
    const { url: publicUrl, path: dbxPath, token: dbxToken } = await uploadImage(storyBuffer);
    mediaId = await publishToInstagram(publicUrl, "", { isStory: true });
    await deleteFromDropbox(dbxPath, dbxToken);
  } else {
    // Feed post
    const postBuffer = await renderPostCard(art, art.imageUrl);
    console.log("Uploading post...");
    const { url: publicUrl, path: dbxPath, token: dbxToken } = await uploadImage(postBuffer);
    console.log("Publishing post...");
    mediaId = await publishToInstagram(publicUrl, caption, { altText });
    await deleteFromDropbox(dbxPath, dbxToken);
  }

  // 5. First comment with hashtags (not for stories)
  if (mode !== "story") {
    await postFirstComment(mediaId, hashtags);
  }

  // 6. Auto-story (not if already a story)
  if (mode !== "story") {
    try {
      await publishAutoStory(art);
    } catch (err) {
      console.warn(`Auto-story failed (non-fatal): ${err.message}`);
    }
  }

  // 7. Update history
  historyData.posted.push(artKey(art));
  historyData.postsSinceLastSeasonal = isSeasonal ? 0 : (historyData.postsSinceLastSeasonal + 1);
  historyData.runIndex = (historyData.runIndex + 1) % MODE_CYCLE.length;
  saveHistoryData(historyData);

  console.log("─".repeat(50));
  console.log(`Published ${mode}! Media ID: ${mediaId}`);
  console.log(`"${art.title}" by ${art.artist}`);
}
```

**Step 3: Verify with dry-run**

Run: `cd scripts/instagram-poster && node post.mjs --dry-run`
Expected: Shows "post mode", "Run #1 (cycle position 1/4)". Saves card. No crash.

**Step 4: Commit**

```bash
git add scripts/instagram-poster/post.mjs
git commit -m "feat: mode cycle (post/post/reel/post) with unified main flow"
```

---

### Task 8: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/instagram-post.yml`

**Step 1: Replace the workflow**

```yaml
name: Instagram Auto-Post

on:
  schedule:
    # 4 posts/day — optimal times for art/culture audience (UTC)
    - cron: "0 7,12,18,1 * * *"
  workflow_dispatch:
    inputs:
      mode:
        description: "Post type (auto = follows mode cycle)"
        required: false
        default: "auto"
        type: choice
        options:
          - auto
          - post
          - story
          - reel

jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      # node-canvas native dependencies + ffmpeg for reels
      - name: Install system deps
        run: |
          sudo apt-get update
          sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev \
            libjpeg-dev libgif-dev librsvg2-dev fonts-liberation fonts-dejavu ffmpeg

      - name: Install npm dependencies
        working-directory: scripts/instagram-poster
        run: npm install

      - name: Post to Instagram
        working-directory: scripts/instagram-poster
        env:
          INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
          INSTAGRAM_USER_ID: ${{ secrets.INSTAGRAM_USER_ID }}
          META_APP_ID: ${{ secrets.META_APP_ID }}
          META_APP_SECRET: ${{ secrets.META_APP_SECRET }}
          FACEBOOK_PAGE_ID: ${{ secrets.FACEBOOK_PAGE_ID }}
          DROPBOX_REFRESH_TOKEN: ${{ secrets.DROPBOX_REFRESH_TOKEN }}
          DROPBOX_APP_KEY: ${{ secrets.DROPBOX_APP_KEY }}
          DROPBOX_APP_SECRET: ${{ secrets.DROPBOX_APP_SECRET }}
          HARVARD_API_KEY: ${{ secrets.VITE_HARVARD_API_KEY }}
        run: |
          MODE="${{ inputs.mode }}"
          if [ "$MODE" = "story" ]; then
            node post.mjs --story
          elif [ "$MODE" = "reel" ]; then
            node post.mjs --reel
          else
            node post.mjs
          fi

      - name: Commit updated history
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add scripts/instagram-poster/posted-history.json
          git diff --staged --quiet || git commit -m "chore: update posted history" && git push
```

**Step 2: Commit**

```bash
git add .github/workflows/instagram-post.yml
git commit -m "feat: update workflow to 4x/day with ffmpeg and mode cycle"
```

---

### Task 9: Create weekly analytics report

**Files:**
- Create: `scripts/instagram-poster/analytics.mjs`
- Create: `.github/workflows/instagram-analytics.yml`

**Step 1: Create analytics.mjs**

```js
#!/usr/bin/env node
/**
 * ArtTok Instagram Weekly Analytics Report
 *
 * Fetches engagement metrics from Instagram Graph API and generates
 * a markdown report committed to docs/analytics/.
 *
 * Usage: node analytics.mjs
 * Required env vars: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "..", "..", "docs", "analytics");
const IG_GRAPH = "https://graph.facebook.com/v21.0";
const { INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID } = process.env;

if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
  console.error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID required");
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getProfile() {
  return fetchJson(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}?fields=followers_count,media_count,username&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
  );
}

async function getRecentMedia(limit = 50) {
  const data = await fetchJson(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?fields=id,caption,timestamp,like_count,comments_count,media_type&limit=${limit}&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
  );
  return data.data || [];
}

async function getMediaInsights(mediaId) {
  try {
    // IMAGE/CAROUSEL metrics
    const data = await fetchJson(
      `${IG_GRAPH}/${mediaId}/insights?metric=reach,impressions,saved,shares&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
    );
    const metrics = {};
    for (const m of data.data || []) {
      metrics[m.name] = m.values?.[0]?.value ?? 0;
    }
    return metrics;
  } catch {
    // REELS have different available metrics
    try {
      const data = await fetchJson(
        `${IG_GRAPH}/${mediaId}/insights?metric=reach,plays,saved,shares&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
      );
      const metrics = {};
      for (const m of data.data || []) {
        metrics[m.name] = m.values?.[0]?.value ?? 0;
      }
      return metrics;
    } catch {
      return {};
    }
  }
}

function extractSource(caption) {
  if (!caption) return "unknown";
  if (caption.includes("Harvard")) return "harvard";
  if (caption.includes("Metropolitan")) return "met";
  if (caption.includes("Art Institute of Chicago")) return "artic";
  return "unknown";
}

function getPreviousFollowers() {
  if (!existsSync(DOCS_DIR)) return null;
  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith("-weekly.md")).sort();
  if (files.length === 0) return null;

  const lastReport = readFileSync(join(DOCS_DIR, files[files.length - 1]), "utf-8");
  const match = lastReport.match(/Followers:\s*\*\*(\d+)\*\*/);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  console.log("ArtTok Instagram Weekly Analytics");
  console.log("─".repeat(50));

  // 1. Profile
  const profile = await getProfile();
  console.log(`@${profile.username} — ${profile.followers_count} followers, ${profile.media_count} posts`);

  // 2. Recent media with insights
  const media = await getRecentMedia();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const thisWeek = media.filter((m) => new Date(m.timestamp) >= weekAgo);
  console.log(`Posts this week: ${thisWeek.length}`);

  const enriched = [];
  for (const m of thisWeek) {
    const insights = await getMediaInsights(m.id);
    enriched.push({
      ...m,
      ...insights,
      source: extractSource(m.caption),
      hour: new Date(m.timestamp).getUTCHours(),
      engagement: (m.like_count || 0) + (m.comments_count || 0) + (insights.saved || 0) + (insights.shares || 0),
    });
  }

  // Sort by engagement
  enriched.sort((a, b) => b.engagement - a.engagement);

  // 3. Follower growth
  const prevFollowers = getPreviousFollowers();
  const followerDelta = prevFollowers !== null ? profile.followers_count - prevFollowers : null;
  const deltaStr = followerDelta !== null
    ? (followerDelta >= 0 ? `+${followerDelta}` : `${followerDelta}`)
    : "N/A (first report)";

  // 4. Averages by source
  const bySource = {};
  for (const m of enriched) {
    if (!bySource[m.source]) bySource[m.source] = { likes: 0, saves: 0, reach: 0, count: 0 };
    bySource[m.source].likes += m.like_count || 0;
    bySource[m.source].saves += m.saved || 0;
    bySource[m.source].reach += m.reach || 0;
    bySource[m.source].count++;
  }

  // 5. Averages by hour
  const byHour = {};
  for (const m of enriched) {
    if (!byHour[m.hour]) byHour[m.hour] = { engagement: 0, count: 0 };
    byHour[m.hour].engagement += m.engagement;
    byHour[m.hour].count++;
  }

  // 6. Generate report
  const dateStr = now.toISOString().split("T")[0];
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  let report = `# Weekly Analytics — ${weekAgoStr} to ${dateStr}\n\n`;

  report += `## Profile\n`;
  report += `- Followers: **${profile.followers_count}** (${deltaStr})\n`;
  report += `- Total posts: ${profile.media_count}\n`;
  report += `- Posts this week: ${thisWeek.length}\n\n`;

  // Top 5
  report += `## Top 5 Posts (by engagement)\n\n`;
  report += `| Title | Type | Likes | Comments | Saves | Shares | Reach | Engagement |\n`;
  report += `|-------|------|-------|----------|-------|--------|-------|------------|\n`;
  for (const m of enriched.slice(0, 5)) {
    const title = (m.caption || "").split("\n")[0].slice(0, 40);
    report += `| ${title} | ${m.media_type} | ${m.like_count || 0} | ${m.comments_count || 0} | ${m.saved || 0} | ${m.shares || 0} | ${m.reach || 0} | ${m.engagement} |\n`;
  }
  report += `\n`;

  // Bottom 5
  if (enriched.length > 5) {
    report += `## Bottom 5 Posts\n\n`;
    report += `| Title | Type | Likes | Comments | Saves | Shares | Reach | Engagement |\n`;
    report += `|-------|------|-------|----------|-------|--------|-------|------------|\n`;
    for (const m of enriched.slice(-5).reverse()) {
      const title = (m.caption || "").split("\n")[0].slice(0, 40);
      report += `| ${title} | ${m.media_type} | ${m.like_count || 0} | ${m.comments_count || 0} | ${m.saved || 0} | ${m.shares || 0} | ${m.reach || 0} | ${m.engagement} |\n`;
    }
    report += `\n`;
  }

  // By source
  report += `## Averages by Museum Source\n\n`;
  report += `| Source | Posts | Avg Likes | Avg Saves | Avg Reach |\n`;
  report += `|--------|-------|-----------|-----------|----------|\n`;
  for (const [source, data] of Object.entries(bySource)) {
    report += `| ${source} | ${data.count} | ${(data.likes / data.count).toFixed(1)} | ${(data.saves / data.count).toFixed(1)} | ${(data.reach / data.count).toFixed(0)} |\n`;
  }
  report += `\n`;

  // By hour
  report += `## Averages by Posting Hour (UTC)\n\n`;
  report += `| Hour | Posts | Avg Engagement |\n`;
  report += `|------|-------|----------------|\n`;
  for (const [hour, data] of Object.entries(byHour).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    report += `| ${hour.padStart(2, "0")}:00 | ${data.count} | ${(data.engagement / data.count).toFixed(1)} |\n`;
  }
  report += `\n`;

  // Save
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
  const filename = `${dateStr}-weekly.md`;
  writeFileSync(join(DOCS_DIR, filename), report);
  console.log(`\nReport saved to docs/analytics/${filename}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
```

**Step 2: Create the analytics workflow**

```yaml
name: Instagram Weekly Analytics

on:
  schedule:
    - cron: "0 9 * * 1"  # Every Monday at 09:00 UTC
  workflow_dispatch:

jobs:
  analytics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run analytics
        working-directory: scripts/instagram-poster
        env:
          INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
          INSTAGRAM_USER_ID: ${{ secrets.INSTAGRAM_USER_ID }}
        run: node analytics.mjs

      - name: Commit report
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/analytics/
          git diff --staged --quiet || git commit -m "docs: weekly Instagram analytics report" && git push
```

**Step 3: Commit**

```bash
git add scripts/instagram-poster/analytics.mjs .github/workflows/instagram-analytics.yml
git commit -m "feat: weekly Instagram analytics report with auto-commit"
```

---

### Task 10: Final integration test and cleanup

**Files:**
- Verify: `scripts/instagram-poster/post.mjs` (all features integrated)

**Step 1: Run dry-run to verify no crashes**

```bash
cd scripts/instagram-poster && node post.mjs --dry-run
```

Expected: Renders card, prints caption (no hashtags), prints hashtags separately, shows mode cycle info.

**Step 2: Verify reel dry-run (if ffmpeg available locally)**

```bash
cd scripts/instagram-poster && node post.mjs --reel --dry-run
```

Expected: Renders story card, saves PNG. (ffmpeg only used in live mode.)

**Step 3: Verify analytics script syntax**

```bash
cd scripts/instagram-poster && node -c analytics.mjs
```

Expected: No syntax errors.

**Step 4: Final commit with all features**

```bash
git add -A scripts/instagram-poster/ .github/workflows/ docs/plans/
git commit -m "feat: Instagram automation upgrade — 7 features complete"
```

---

## Execution Order Summary

| Task | Feature | Dependencies |
|------|---------|--------------|
| 1 | History format migration | None |
| 2 | Alt text | None |
| 3 | First comment hashtags | None |
| 4 | Auto-story | Task 2 (altText signature) |
| 5 | Reels | Task 1 (history), Task 3 (hashtags), Task 4 (auto-story) |
| 6 | Seasonal content | Task 1 (history) |
| 7 | Mode cycle + rewrite main() | Tasks 1-6 (integrates all) |
| 8 | GitHub Actions workflow | Task 5 (ffmpeg), Task 7 (mode) |
| 9 | Analytics | None (independent) |
| 10 | Integration test | All above |

**Recommended approach:** Tasks 1-6 build incrementally on post.mjs. Task 7 is the big rewrite that integrates everything into the final main(). Task 8-9 are independent. Task 10 validates.

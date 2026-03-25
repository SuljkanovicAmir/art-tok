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

import { loadHistoryData, saveHistoryData, artKey } from "./lib/history.mjs";
import { fetchSpecificArtwork, fetchRandomArtwork, fetchSeasonalArtwork, shouldPostSeasonal, getActiveSeason } from "./lib/art-fetchers.mjs";
import { uploadImage, deleteFromDropbox } from "./lib/dropbox.mjs";
import { refreshTokenIfNeeded } from "./lib/token-refresh.mjs";
import { publishToInstagram, postFirstComment, publishReel, publishAutoStory } from "./lib/instagram-api.mjs";
import { buildCaption, buildHashtags, buildAltText } from "./lib/captions.mjs";
import { renderPostCard, renderStoryCard } from "./lib/render.mjs";
import { pick } from "./lib/fetch.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const IS_STORY = args.includes("--story");
const IS_REEL = args.includes("--reel");
const DRY_RUN = args.includes("--dry-run");
const ART_ARG = args.find((a) => a.startsWith("--art="));
const SPECIFIC_ART = ART_ARG ? ART_ARG.replace("--art=", "") : null; // e.g. "harvard:229060"

// ── Mode cycle ──────────────────────────────────────────────────────────────

const MODE_CYCLE = ["post", "post", "reel", "post"];

function getRunMode(historyData) {
  if (IS_STORY) return "story";
  if (IS_REEL) return "reel";
  return MODE_CYCLE[historyData.runIndex % MODE_CYCLE.length];
}

// ── Reels (ffmpeg) ──────────────────────────────────────────────────────────

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

// ── Main ────────────────────────────────────────────────────────────────────

const HISTORY_FILE = new URL("./posted-history.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

async function main() {
  // 1. Load history data (object format, auto-migrates from array)
  const historyData = loadHistoryData(HISTORY_FILE);
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

    console.log(`\nCaption:\n${buildCaption(art, mode)}`);
    console.log(`\nHashtags:\n${buildHashtags(art)}`);
    return;
  }

  // 5. Refresh token
  let token = process.env.INSTAGRAM_ACCESS_TOKEN;
  token = await refreshTokenIfNeeded(token);

  const caption = buildCaption(art, mode);
  const altText = buildAltText(art);
  const hashtags = buildHashtags(art);
  let mediaId;

  // 6. Publish based on mode
  if (mode === "reel") {
    console.log("Creating reel video...");
    const videoBuffer = await createReelVideo(art);
    console.log("Publishing reel...");
    mediaId = await publishReel(token, videoBuffer, caption);
  } else if (mode === "story") {
    console.log("Uploading story image...");
    const { url: publicUrl, path: dropboxPath, token: dropboxToken } = await uploadImage(pngBuffer);
    console.log(`Hosted at: ${publicUrl}`);
    console.log("Publishing story...");
    mediaId = await publishToInstagram(token, publicUrl, caption, { isStory: true, altText });
    await deleteFromDropbox(dropboxPath, dropboxToken);
  } else {
    // post mode
    console.log("Uploading post image...");
    const { url: publicUrl, path: dropboxPath, token: dropboxToken } = await uploadImage(pngBuffer);
    console.log(`Hosted at: ${publicUrl}`);
    console.log("Publishing post...");
    mediaId = await publishToInstagram(token, publicUrl, caption, { altText });
    await deleteFromDropbox(dropboxPath, dropboxToken);
  }

  // 7. Post first comment with hashtags (not for stories)
  if (mode !== "story") {
    await postFirstComment(token, mediaId, hashtags);
  }

  // 8. Publish auto-story (not if already a story)
  if (mode !== "story") {
    await publishAutoStory(token, art);
  }

  // 9. Update history
  const wasSeasonal = getActiveSeason() !== null && SPECIFIC_ART === null;
  historyData.posted.push(artKey(art));
  historyData.postsSinceLastSeasonal = wasSeasonal ? 0 : historyData.postsSinceLastSeasonal + 1;
  historyData.runIndex = (historyData.runIndex + 1) % MODE_CYCLE.length;

  // 10. Save history
  saveHistoryData(HISTORY_FILE, historyData);

  console.log("─".repeat(50));
  console.log(`Published! Media ID: ${mediaId} (${mode})`);
  console.log(`"${art.title}" by ${art.artist}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

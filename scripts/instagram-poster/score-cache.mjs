#!/usr/bin/env node
/**
 * ArtTok Image Cache Scoring — deterministic helper.
 *
 * The visual judging itself is done in-session by Claude subagents (see
 * docs/plans/2026-06-15-ai-cache-scoring.md). This script handles the parts a
 * node process CAN do: download + downscale cache images so agents can read
 * them, merge agent scores back into image-cache.json, and report status.
 *
 * Usage:
 *   node score-cache.mjs --download                 # pull unscored images → temp/scoring/, write manifest.json
 *   node score-cache.mjs --apply temp/scoring/scores.json   # merge agent scores into image-cache.json
 *   node score-cache.mjs --status                   # scored/unscored counts + histogram
 *   node score-cache.mjs --prune --min 6            # set skip:true on entries scoring < N (non-destructive)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "canvas";
import { loadCache, saveCache } from "./lib/cache.mjs";
import { probeImage } from "./lib/fetch.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = join(__dirname, "temp", "scoring");
const MANIFEST_FILE = join(TEMP_DIR, "manifest.json");
const MAX_EDGE = 1024;          // downscale longest edge — plenty for grading, ~4-8× cheaper in tokens
const JPEG_QUALITY = 0.8;
const DOWNLOAD_PAUSE_MS = 1000; // be polite to Dropbox between fetches

const args = process.argv.slice(2);
const cmd = args[0];

/** Read an int flag like `--min 6`; returns fallback if absent. */
function intFlag(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return fallback;
  const n = parseInt(args[i + 1], 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Downscale an image buffer to <= MAX_EDGE longest edge, return JPEG buffer. */
async function downscale(buffer) {
  const img = await loadImage(buffer);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toBuffer("image/jpeg", { quality: JPEG_QUALITY });
}

// ── --download ───────────────────────────────────────────────────────────────

async function download() {
  const cache = loadCache();
  const unscored = cache.filter((e) => e.aiScore == null && !e.skip);
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

  console.log("ArtTok Cache Scoring — download");
  console.log("─".repeat(40));
  console.log(`Cache: ${cache.length} total, ${unscored.length} unscored`);

  const manifest = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const e of unscored) {
    const filename = `${e.source}-${e.id}.jpg`;
    const localPath = join(TEMP_DIR, filename);
    const key = `${e.source}:${e.id}`;

    if (existsSync(localPath)) {
      skipped++;
    } else {
      try {
        const raw = await probeImage(e.imageUrl);
        const small = await downscale(raw);
        writeFileSync(localPath, small);
        downloaded++;
        console.log(`  [${downloaded}] ${key} — "${e.title}"`);
        await new Promise((r) => setTimeout(r, DOWNLOAD_PAUSE_MS));
      } catch (err) {
        failed++;
        console.warn(`  Failed ${key}: ${err.message}`);
        continue; // don't add to manifest — nothing on disk to score
      }
    }

    manifest.push({
      key,
      localPath,
      title: e.title || "",
      artist: e.artist || "",
      medium: e.medium || "",
      culture: e.culture || "",
      dated: e.dated || "",
      classification: e.classification || "",
    });
  }

  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`\nDownloaded ${downloaded}, reused ${skipped} already-local, ${failed} failed.`);
  console.log(`Manifest: ${manifest.length} entries → ${MANIFEST_FILE}`);
  console.log(`\nNext: dispatch scoring subagents over the manifest (see the plan), then --apply.`);
}

// ── --apply ──────────────────────────────────────────────────────────────────

function isValidScore(n) {
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

function apply(scoresPath) {
  if (!scoresPath || !existsSync(scoresPath)) {
    console.error(`Scores file not found: ${scoresPath || "(none given)"}`);
    process.exit(1);
  }
  const scores = JSON.parse(readFileSync(scoresPath, "utf-8"));
  if (!Array.isArray(scores)) {
    console.error("Scores file must be a JSON array.");
    process.exit(1);
  }

  const cache = loadCache();
  const byKey = new Map(cache.map((e) => [`${e.source}:${e.id}`, e]));
  const today = new Date().toISOString().slice(0, 10);

  let applied = 0;
  let skipped = 0;
  for (const s of scores) {
    const entry = byKey.get(s?.key);
    if (!entry) { console.warn(`  Unknown key, skipped: ${s?.key}`); skipped++; continue; }
    if (!isValidScore(s.score)) { console.warn(`  Bad score for ${s.key}: ${s.score}`); skipped++; continue; }
    entry.aiScore = s.score;
    if (s.breakdown && typeof s.breakdown === "object") entry.aiScoreBreakdown = s.breakdown;
    if (s.note) entry.aiScoreNote = String(s.note).slice(0, 200);
    entry.aiScoredAt = today;
    entry.aiScoredBy = "claude-sonnet-4-6";
    applied++;
  }

  saveCache(cache);
  console.log(`Applied ${applied} scores, skipped ${skipped}.`);
}

// ── --status ─────────────────────────────────────────────────────────────────

function status() {
  const cache = loadCache();
  const scored = cache.filter((e) => e.aiScore != null);
  const buckets = Array(11).fill(0); // index 1..10
  for (const e of scored) buckets[e.aiScore]++;

  console.log("ArtTok Cache Scoring — status");
  console.log("─".repeat(40));
  console.log(`Total: ${cache.length}  Scored: ${scored.length}  Unscored: ${cache.length - scored.length}`);
  if (scored.length) {
    const mean = scored.reduce((a, e) => a + e.aiScore, 0) / scored.length;
    console.log(`Mean score: ${mean.toFixed(2)}\n`);
    const max = Math.max(...buckets);
    for (let i = 10; i >= 1; i--) {
      const bar = "█".repeat(max ? Math.round((buckets[i] / max) * 30) : 0);
      console.log(`  ${String(i).padStart(2)} | ${bar} ${buckets[i]}`);
    }
  }
}

// ── --prune ──────────────────────────────────────────────────────────────────

function prune() {
  const min = intFlag("--min", 6);
  const cache = loadCache();
  let pruned = 0;
  for (const e of cache) {
    if (e.aiScore != null && e.aiScore < min && !e.skip) {
      e.skip = true;
      pruned++;
    }
  }
  saveCache(cache);
  console.log(`Pruned ${pruned} entries scoring < ${min} (set skip:true — reversible).`);
}

// ── dispatch ─────────────────────────────────────────────────────────────────

switch (cmd) {
  case "--download": await download(); break;
  case "--apply": apply(args[1]); break;
  case "--status": status(); break;
  case "--prune": prune(); break;
  default:
    console.log("Usage: node score-cache.mjs --download | --apply <scores.json> | --status | --prune [--min N]");
    process.exit(cmd ? 1 : 0);
}

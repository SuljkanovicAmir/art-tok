#!/usr/bin/env node
/**
 * One-off: prune cached portrait entries down to PORTRAIT_CAP_PCT of total.
 * Deletes Dropbox files + removes from image-cache.json.
 * Random selection among existing portraits.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { getDropboxToken, deleteFromDropbox } from "./lib/dropbox.mjs";

const PORTRAIT_CAP_PCT = 0.20;
const CACHE_FILE = "./image-cache.json";

function isPortrait(art) {
  const title = (art.title || "").toLowerCase();
  const original = art.title || "";
  if (/\bportrait\b/.test(title)) return true;
  if (/\bself-portrait\b/.test(title)) return true;
  if (/\b(mrs?|miss|mme|madame|monsieur|sir|lady|lord|dr)\.?\s+[A-Z]/i.test(original)) return true;
  if (/\(\d{3,4}\s*[-–—]\s*\d{3,4}\)/.test(original)) return true;
  return false;
}

const cache = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
const portraits = cache.filter(isPortrait);
const nonPortraits = cache.filter((e) => !isPortrait(e));
// K / (N + K) <= cap  ⟹  K <= N * cap / (1 - cap)
const keepPortraits = Math.floor(nonPortraits.length * PORTRAIT_CAP_PCT / (1 - PORTRAIT_CAP_PCT));
const deleteCount = Math.max(0, portraits.length - keepPortraits);

console.log(`Cache: ${cache.length} entries`);
console.log(`Portraits: ${portraits.length} (${(portraits.length / cache.length * 100).toFixed(0)}%)`);
console.log(`Non-portraits: ${nonPortraits.length}`);
console.log(`Cap: ${(PORTRAIT_CAP_PCT * 100).toFixed(0)}% → keep ${keepPortraits} portraits`);
console.log(`Delete: ${deleteCount} portraits`);
console.log();

if (deleteCount === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

// Random selection — shuffle and take first deleteCount
const shuffled = [...portraits].sort(() => Math.random() - 0.5);
const toDelete = shuffled.slice(0, deleteCount);
const toDeleteKeys = new Set(toDelete.map((e) => `${e.source}:${e.id}`));

const token = await getDropboxToken();
let dropboxOk = 0;
let dropboxFail = 0;
for (const e of toDelete) {
  try {
    await deleteFromDropbox(e.dropboxPath, token);
    dropboxOk++;
    console.log(`  Deleted: "${e.title}" by ${e.artist}`);
  } catch (err) {
    dropboxFail++;
    console.warn(`  Dropbox delete failed for ${e.dropboxPath}: ${err.message}`);
  }
}

// Remove from cache regardless of Dropbox success (file may already be missing)
const remaining = cache.filter((e) => !toDeleteKeys.has(`${e.source}:${e.id}`));
writeFileSync(CACHE_FILE, JSON.stringify(remaining, null, 2));

console.log();
console.log(`Dropbox: ${dropboxOk} deleted, ${dropboxFail} failed`);
console.log(`Cache: ${cache.length} → ${remaining.length} entries`);
const finalPortraits = remaining.filter(isPortrait).length;
console.log(`Final portrait ratio: ${finalPortraits}/${remaining.length} (${(finalPortraits / remaining.length * 100).toFixed(0)}%)`);

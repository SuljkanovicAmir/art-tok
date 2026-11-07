#!/usr/bin/env node
/**
 * Builds the Timeline painting set from the Met's open-access collection.
 *
 * For each curated work: confirms it is public domain and has a tight date,
 * downloads the image, trims photographed margins, saves a small self-hosted
 * JPEG and writes the game's manifest.
 *
 * Usage (needs node-canvas from the poster's dependencies):
 *   cd scripts/instagram-poster && npm ci && cd ../..
 *   node scripts/timeline/build-paintings.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../instagram-poster/package.json", import.meta.url));
const { createCanvas, loadImage } = require("canvas");

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT_DIR = join(ROOT, "public", "game-paintings");
const MANIFEST = join(ROOT, "src", "utils", "timeline", "paintings.json");
const MET_OBJECTS = "https://collectionapi.metmuseum.org/public/collection/v1/objects";

const MAX_WIDTH = 420;
const MAX_DATE_SPAN = 4;
const REQUEST_GAP_MS = 1200; // Met blocks bursts of requests

/** Object IDs to include. Add to this list and rerun to grow the set. */
const CURATED_IDS = JSON.parse(readFileSync(join(HERE, "paintings.source.json"), "utf8"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (attempt === 4) throw new Error(`HTTP ${res.status}: ${url}`);
    await sleep(attempt * 8000);
  }
  throw new Error(`Unreachable: ${url}`);
}

/** Finds the painted area by walking in from each edge past dark photo margins. */
function findPaintedArea(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const luminance = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const DARK = 34;
  const rowDark = (y) => {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += luminance((y * width + x) * 4);
    return sum / width < DARK;
  };
  const colDark = (x) => {
    let sum = 0;
    for (let y = 0; y < height; y++) sum += luminance((y * width + x) * 4);
    return sum / height < DARK;
  };

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;
  const limitY = Math.floor(height * 0.08);
  const limitX = Math.floor(width * 0.08);
  while (top < limitY && rowDark(top)) top++;
  while (height - 1 - bottom < limitY && rowDark(bottom)) bottom--;
  while (left < limitX && colDark(left)) left++;
  while (width - 1 - right < limitX && colDark(right)) right--;

  const insetX = Math.round(width * 0.012);
  const insetY = Math.round(height * 0.012);
  return {
    x: left + insetX,
    y: top + insetY,
    width: right - left + 1 - insetX * 2,
    height: bottom - top + 1 - insetY * 2,
  };
}

async function buildPainting(id) {
  const object = await (await fetchWithRetry(`${MET_OBJECTS}/${id}`)).json();
  if (!object.isPublicDomain) throw new Error(`${id} is not public domain`);
  if (object.objectEndDate - object.objectBeginDate > MAX_DATE_SPAN) {
    throw new Error(`${id} has a loose date: ${object.objectDate}`);
  }

  const imageRes = await fetchWithRetry(object.primaryImageSmall);
  const source = await loadImage(Buffer.from(await imageRes.arrayBuffer()));
  const full = createCanvas(source.width, source.height);
  const fullCtx = full.getContext("2d");
  fullCtx.drawImage(source, 0, 0);
  const area = findPaintedArea(fullCtx, source.width, source.height);

  const scale = Math.min(1, MAX_WIDTH / area.width);
  const width = Math.round(area.width * scale);
  const height = Math.round(area.height * scale);
  const output = createCanvas(width, height);
  output.getContext("2d").drawImage(source, area.x, area.y, area.width, area.height, 0, 0, width, height);
  writeFileSync(join(OUT_DIR, `${id}.jpg`), output.toBuffer("image/jpeg", { quality: 0.8 }));

  return {
    id,
    title: object.title.replace(/\s*\(.*$/, "").trim() || object.title,
    artist: object.artistDisplayName.replace(/\s*\(.*$/, "").trim(),
    year: object.objectEndDate,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const paintings = [];
  for (const id of CURATED_IDS) {
    const painting = await buildPainting(id);
    paintings.push(painting);
    console.log(`${painting.year} ${painting.artist}: ${painting.title}`);
    await sleep(REQUEST_GAP_MS);
  }
  paintings.sort((a, b) => a.year - b.year);
  writeFileSync(MANIFEST, `${JSON.stringify(paintings, null, 2)}\n`);
  console.log(`Saved ${paintings.length} paintings`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

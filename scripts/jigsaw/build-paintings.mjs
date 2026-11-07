#!/usr/bin/env node
/**
 * Builds the Jigsaw painting set from the Met's open-access collection.
 *
 * For each curated work: confirms it is public domain, downloads the full
 * image (falling back to the small one), trims photographed margins, saves a
 * self-hosted JPEG (long side 1200px at most) and writes the game's manifest.
 *
 * Usage (needs node-canvas from the poster's dependencies):
 *   cd scripts/instagram-poster && npm ci && cd ../..
 *   node scripts/jigsaw/build-paintings.mjs
 *
 * paintings.source.json holds object IDs. An entry may also be
 * { "id": 123, "crop": { "left": 0.02, "top": 0, "right": 0.02, "bottom": 0.03 } }
 * to trim extra fractions of the image after the automatic margin trim.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../instagram-poster/package.json", import.meta.url));
const { createCanvas, loadImage } = require("canvas");

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT_DIR = join(ROOT, "public", "jigsaw-paintings");
const MANIFEST = join(ROOT, "src", "utils", "jigsaw", "paintings.json");
const MET_OBJECTS = "https://collectionapi.metmuseum.org/public/collection/v1/objects";
const HEADERS = { "User-Agent": "Mozilla/5.0 (ArtTok game build)" };

const MAX_SIDE = 1200;
const MIN_ASPECT = 0.62;
const MAX_ASPECT = 1.7;
const REQUEST_GAP_MS = 1200; // Met blocks bursts of requests

const SOURCE = JSON.parse(readFileSync(join(HERE, "paintings.source.json"), "utf8")).map((entry) =>
  typeof entry === "number" ? { id: entry } : entry,
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS }).catch(() => null);
    if (res?.ok) return res;
    if (attempt === 4) throw new Error(`HTTP ${res?.status ?? "network error"}: ${url}`);
    await sleep(attempt * 8000);
  }
  throw new Error(`Unreachable: ${url}`);
}

/** Tries the full-size image first, then the small one. */
async function loadSource(object) {
  const urls = [object.primaryImage, object.primaryImageSmall].filter(Boolean);
  for (const url of urls) {
    try {
      const res = await fetchWithRetry(url);
      return await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      console.warn(`  ${object.objectID}: ${err.message}`);
    }
  }
  throw new Error(`${object.objectID} has no usable image`);
}

/**
 * Finds the painted area by walking in from each edge while the line is a
 * flat band: dark photo backdrop or pale paper, judged against the corner colour.
 */
function findPaintedArea(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const at = (x, y) => (y * width + x) * 4;
  const corners = [at(2, 2), at(width - 3, 2), at(2, height - 3), at(width - 3, height - 3)];
  const ref = [0, 1, 2].map((c) => corners.reduce((sum, i) => sum + data[i + c], 0) / 4);
  const BAND_DISTANCE = 38;
  const BAND_SPREAD = 26;

  const isBand = (samples) => {
    let mean = 0;
    for (const s of samples) mean += s;
    mean /= samples.length;
    if (mean > BAND_DISTANCE) return false;
    return true;
  };

  /** Distance of a pixel from the reference corner colour. */
  const distance = (i) => Math.hypot(data[i] - ref[0], data[i + 1] - ref[1], data[i + 2] - ref[2]);
  const rowIsBand = (y) => {
    const samples = [];
    for (let x = 0; x < width; x += 2) samples.push(distance(at(x, y)));
    return isBand(samples) && spread(samples) < BAND_SPREAD * 2;
  };
  const colIsBand = (x) => {
    const samples = [];
    for (let y = 0; y < height; y += 2) samples.push(distance(at(x, y)));
    return isBand(samples) && spread(samples) < BAND_SPREAD * 2;
  };
  const spread = (samples) => {
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.9)];
  };

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;
  const limitY = Math.floor(height * 0.12);
  const limitX = Math.floor(width * 0.12);
  while (top < limitY && rowIsBand(top)) top++;
  while (height - 1 - bottom < limitY && rowIsBand(bottom)) bottom--;
  while (left < limitX && colIsBand(left)) left++;
  while (width - 1 - right < limitX && colIsBand(right)) right--;

  const insetX = Math.round(width * 0.012);
  const insetY = Math.round(height * 0.012);
  return {
    x: left + insetX,
    y: top + insetY,
    width: right - left + 1 - insetX * 2,
    height: bottom - top + 1 - insetY * 2,
  };
}

function averageColor(canvas) {
  const size = 16;
  const small = createCanvas(size, size);
  const ctx = small.getContext("2d");
  ctx.drawImage(canvas, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  const px = size * size;
  return `#${sum.map((s) => Math.round(s / px).toString(16).padStart(2, "0")).join("")}`;
}

const clean = (text) => text.replace(/\s*\(.*$/, "").trim() || text;

async function buildPainting({ id, crop }) {
  const object = await (await fetchWithRetry(`${MET_OBJECTS}/${id}`)).json();
  if (!object.isPublicDomain) throw new Error(`${id} is not public domain`);

  const source = await loadSource(object);
  const full = createCanvas(source.width, source.height);
  const fullCtx = full.getContext("2d");
  fullCtx.drawImage(source, 0, 0);
  const auto = findPaintedArea(fullCtx, source.width, source.height);

  const c = { left: 0, top: 0, right: 0, bottom: 0, ...crop };
  const area = {
    x: auto.x + auto.width * c.left,
    y: auto.y + auto.height * c.top,
    width: auto.width * (1 - c.left - c.right),
    height: auto.height * (1 - c.top - c.bottom),
  };
  const aspect = area.width / area.height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    throw new Error(`${id} aspect ${aspect.toFixed(2)} is outside ${MIN_ASPECT} to ${MAX_ASPECT}`);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(area.width, area.height));
  const width = Math.round(area.width * scale);
  const height = Math.round(area.height * scale);
  const output = createCanvas(width, height);
  output.getContext("2d").drawImage(source, area.x, area.y, area.width, area.height, 0, 0, width, height);
  writeFileSync(join(OUT_DIR, `${id}.jpg`), output.toBuffer("image/jpeg", { quality: 0.8 }));

  return {
    id,
    title: clean(object.title),
    artist: clean(object.artistDisplayName),
    date: object.objectDate || clean(object.period || "") || "Undated",
    width,
    height,
    color: averageColor(output),
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(MANIFEST), { recursive: true });
  const paintings = [];
  for (const entry of SOURCE) {
    const painting = await buildPainting(entry);
    paintings.push(painting);
    console.log(`${painting.id} ${painting.artist}: ${painting.title} (${painting.width}x${painting.height})`);
    await sleep(REQUEST_GAP_MS);
  }
  paintings.sort((a, b) => a.id - b.id);
  writeFileSync(MANIFEST, `${JSON.stringify(paintings, null, 2)}\n`);
  console.log(`Saved ${paintings.length} paintings`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

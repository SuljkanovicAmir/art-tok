// lib/reel-pan.mjs
// Plans ffmpeg motion for "Look Closer" reels: turn one high-res painting
// into a slow 9:16 drift. planPanMotion is a pure function -> filtergraph string;
// createPanReel is the ffmpeg/canvas shell that renders it.

import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadImage } from "canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DURATION_S = 18;
export const FPS = 30;
const OUT_W = 1080;
const OUT_H = 1920;
const FRAMES = DURATION_S * FPS;

// mulberry32 — same deterministic PRNG family used for art seeding elsewhere.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planPanMotion({ width, height, seed }) {
  if (!width || !height) return null;
  const longEdge = Math.max(width, height);
  if (longEdge < 1080) return null; // too small for any motion — card reel instead

  const rng = mulberry32(seed >>> 0);
  const aspect = width / height;

  // Supersample before zoompan so zoom steps have sub-pixel resolution (kills jitter).
  const SS = "scale=4320:-2";

  if (aspect >= 1.25 && width >= 1600) {
    // ── Lateral pan: a 9:16 window glides across the canvas. crop is jitter-free.
    //    Direction + travel extent both derive from the seed so every artwork
    //    drifts a little differently (and the same artwork is reproducible).
    const ltr = rng() < 0.5;
    const span = (0.85 + rng() * 0.13).toFixed(4); // covers 85–98% of available travel
    const x = ltr
      ? `(in_w-out_w)*${span}*t/${DURATION_S}`
      : `(in_w-out_w)*(1-${span}*t/${DURATION_S})`;
    return {
      preset: "pan",
      filter:
        `scale=-2:3840,crop=2160:3840:x='${x}':y=0,` +
        `scale=${OUT_W}:${OUT_H},fps=${FPS},format=yuv420p`,
    };
  }

  if (longEdge >= 1400) {
    // ── Pull-out reveal: start ~2.8x on the upper third, settle on full view.
    const startZoom = 2.8;
    const step = ((startZoom - 1.0) / FRAMES).toFixed(5);
    const fx = (0.35 + rng() * 0.3).toFixed(2); // focus x in [0.35, 0.65]
    const fy = "0.30";                           // upper third — faces live here
    return {
      preset: "pullout",
      filter:
        `${SS},zoompan=` +
        `z='if(lte(on,1),${startZoom},max(1.0,zoom-${step}))'` +
        `:x='iw*${fx}-(iw/zoom)*${fx}'` +
        `:y='ih*${fy}-(ih/zoom)*${fy}'` +
        `:d=${FRAMES}:s=${OUT_W}x${OUT_H}:fps=${FPS},format=yuv420p`,
    };
  }

  // ── Gentle push-in: safe for any aspect/medium resolution.
  const step = (0.4 / FRAMES).toFixed(6);
  return {
    preset: "pushin",
    filter:
      `${SS},zoompan=z='min(1.4,zoom+${step})'` +
      `:x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2'` +
      `:d=${FRAMES}:s=${OUT_W}x${OUT_H}:fps=${FPS},format=yuv420p`,
  };
}

// ── ffmpeg / canvas shell ────────────────────────────────────────────────────

function hashKey(s) {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return h >>> 0;
}

/**
 * Probe an image buffer's pixel dimensions via node-canvas (already a dependency).
 */
export async function getImageDims(buffer) {
  const img = await loadImage(buffer);
  return { width: img.width, height: img.height };
}

/**
 * Render a "Look Closer" pan reel from the artwork's source image.
 * @param art         artwork object (uses source + id for a deterministic seed)
 * @param imageBuffer raw painting JPEG/PNG buffer (NOT the 1080 filtered post image)
 * @param dims        { width, height } of imageBuffer
 * @param audioPath   mp3 path
 * @returns Buffer of the rendered mp4
 * @throws if no motion plan fits the source or ffmpeg fails — caller falls back to a card reel
 */
export function createPanReel(art, imageBuffer, dims, audioPath) {
  const seed = hashKey(`${art.source}:${art.id}`);
  const plan = planPanMotion({ ...dims, seed });
  if (!plan) throw new Error(`source too small for pan reel (${dims.width}x${dims.height})`);
  console.log(`Pan reel preset: ${plan.preset} (${dims.width}x${dims.height})`);

  const tmpDir = join(__dirname, "..", "tmp");
  mkdirSync(tmpDir, { recursive: true });
  const imgPath = join(tmpDir, `pan-src-${art.source}-${art.id}.jpg`);
  const outPath = join(tmpDir, `pan-reel-${art.source}-${art.id}.mp4`);
  writeFileSync(imgPath, imageBuffer);

  try {
    // -loop 1 holds the still image on the timeline so the crop/zoompan
    // expressions (which advance with t / on) have the full DURATION_S to animate.
    execFileSync("ffmpeg", [
      "-y", "-loop", "1", "-i", imgPath, "-i", audioPath,
      "-filter_complex", `[0:v]${plan.filter}[v]`,
      "-map", "[v]", "-map", "1:a",
      "-t", String(DURATION_S),
      "-c:v", "libx264", "-preset", "medium", "-crf", "21",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outPath,
    ], { stdio: "pipe", timeout: 180000 });

    const video = readFileSync(outPath);
    if (video.length < 100 * 1024) throw new Error(`pan reel suspiciously small (${video.length} bytes)`);
    console.log(`Pan reel created: ${(video.length / 1024 / 1024).toFixed(1)} MB`);
    return video;
  } finally {
    try { unlinkSync(imgPath); } catch { /* ignore */ }
    try { unlinkSync(outPath); } catch { /* ignore */ }
  }
}

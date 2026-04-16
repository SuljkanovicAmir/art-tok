/**
 * Pure-image feed post filter.
 *
 * Instagram feed posts must have aspect ratio between 4:5 (0.8) and 1.91:1.
 * Source: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
 *
 * This module loads the source artwork, rejects anything outside that range,
 * and produces a 1080-px-wide JPEG at the art's native aspect. No padding,
 * no cropping, no design — rejected artworks surface via AspectOutOfRangeError
 * so the caller can retry with a different piece.
 *
 * Story and reel rendering stay in lib/render.mjs — this module is post-only.
 */
import { createCanvas, loadImage } from "canvas";

export const IG_MIN_ASPECT = 0.8;   // 4:5 — tallest allowed portrait
export const IG_MAX_ASPECT = 1.91;  // 1.91:1 — widest allowed landscape
const TARGET_WIDTH = 1080;           // IG re-encodes anything larger
const JPEG_QUALITY = 0.92;

export class AspectOutOfRangeError extends Error {
  constructor(aspect, width, height) {
    super(
      `Aspect ${aspect.toFixed(3)} (${width}x${height}) outside IG feed range ` +
      `[${IG_MIN_ASPECT}, ${IG_MAX_ASPECT}] — rejecting for retry`,
    );
    this.name = "AspectOutOfRangeError";
    this.aspect = aspect;
    this.width = width;
    this.height = height;
  }
}

/**
 * Load art, verify aspect fits IG feed, produce 1080-wide JPEG at native aspect.
 *
 * @param {Buffer|string} input - image Buffer or URL
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, aspect: number }>}
 * @throws {AspectOutOfRangeError} if aspect outside [0.8, 1.91]
 */
export async function prepareFeedImage(input) {
  const img = await loadImage(input);
  const srcW = img.width;
  const srcH = img.height;
  const aspect = srcW / srcH;

  if (aspect < IG_MIN_ASPECT || aspect > IG_MAX_ASPECT) {
    throw new AspectOutOfRangeError(aspect, srcW, srcH);
  }

  // Scale so width <= 1080; preserve aspect exactly
  const scale = srcW > TARGET_WIDTH ? TARGET_WIDTH / srcW : 1;
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, outW, outH);

  const buffer = canvas.toBuffer("image/jpeg", { quality: JPEG_QUALITY });
  return { buffer, width: outW, height: outH, aspect };
}

/**
 * Story/Post card renderer for Node.js — ported from src/utils/storyCardRenderer.ts
 * Uses node-canvas (same Canvas API as browser) to generate watercolor-style art cards.
 */
import { createCanvas, loadImage } from "canvas";

// ── Image loader with referrer spoofing for blocked sources (AIC IIIF) ──────
const REFERRERS = {
  "www.artic.edu": "https://www.artic.edu/",
};

async function fetchImage(url, retries = 3) {
  const hostname = new URL(url).hostname;
  const referrer = REFERRERS[hostname];

  for (let i = 0; i <= retries; i++) {
    try {
      if (referrer) {
        const res = await fetch(url, { headers: {
          Referer: referrer,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        } });
        if (res.status === 429 && i < retries) {
          const wait = (i + 1) * 2000;
          console.log(`Image rate limited (${hostname}), retrying in ${wait / 1000}s...`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        return loadImage(buffer);
      }

      return await loadImage(url);
    } catch (err) {
      if (err.message?.includes("Server responded with 429") && i < retries) {
        const wait = (i + 1) * 2000;
        console.log(`Image rate limited (${hostname}), retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

// ── Dimensions ──────────────────────────────────────────────────────────────
const STORY_W = 1080;
const STORY_H = 1920;
const POST_W = 1080;
const POST_H = 1350;

// ── Text helpers ────────────────────────────────────────────────────────────

function truncateText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      if (lines.length >= maxLines) break;
      current = word;
    } else {
      current = test;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      let trimmed = last;
      while (ctx.measureText(trimmed + "\u2026").width > maxWidth && trimmed.length > 0) {
        trimmed = trimmed.slice(0, -1).trimEnd();
      }
      lines[maxLines - 1] = trimmed + "\u2026";
    }
  }

  return lines;
}

// ── Color palette extraction (Median Cut) ───────────────────────────────────

const FALLBACK_PALETTES = [
  ["#E8845C", "#F4A261", "#E76F51", "#F2CC8F", "#D4A373"],
  ["#C97B63", "#E0A899", "#D4856B", "#F0D2C4", "#B5654A"],
  ["#D4A03C", "#E8C468", "#C4883C", "#F2D98C", "#B07828"],
  ["#C07088", "#D4949C", "#B85878", "#E8B8C0", "#A04468"],
  ["#C89640", "#D8B06C", "#B87C2C", "#E8CC94", "#A06820"],
];

function extractPalette(img, count = 5) {
  const size = 100;
  const c = createCanvas(size, size);
  const cx = c.getContext("2d");

  cx.drawImage(img, 0, 0, size, size);
  const { data } = cx.getImageData(0, 0, size, size);

  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 245 || lum < 10) continue;
    pixels.push([r, g, b]);
  }

  if (pixels.length < count) return [];

  function channelRange(box, ch) {
    let min = 255, max = 0;
    for (const px of box) {
      if (px[ch] < min) min = px[ch];
      if (px[ch] > max) max = px[ch];
    }
    return max - min;
  }

  function widestChannel(box) {
    const rr = channelRange(box, 0);
    const gr = channelRange(box, 1);
    const br = channelRange(box, 2);
    if (rr >= gr && rr >= br) return 0;
    if (gr >= rr && gr >= br) return 1;
    return 2;
  }

  function splitBox(box) {
    const ch = widestChannel(box);
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = Math.floor(box.length / 2);
    return [box.slice(0, mid), box.slice(mid)];
  }

  function averageColor(box) {
    let rSum = 0, gSum = 0, bSum = 0;
    for (const [r, g, b] of box) { rSum += r; gSum += g; bSum += b; }
    const n = box.length;
    return [Math.round(rSum / n), Math.round(gSum / n), Math.round(bSum / n)];
  }

  const boxes = [pixels];
  while (boxes.length < count) {
    let bestIdx = 0, bestRange = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const ch = widestChannel(boxes[i]);
      const range = channelRange(boxes[i], ch);
      if (range > bestRange) { bestRange = range; bestIdx = i; }
    }
    if (bestRange === 0) break;
    const [a, b] = splitBox(boxes[bestIdx]);
    boxes.splice(bestIdx, 1, a, b);
  }

  boxes.sort((a, b) => b.length - a.length);

  return boxes.slice(0, count).map((box) => {
    const [r, g, b] = averageColor(box);
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
      else if (max === gf) h = ((bf - rf) / d + 2) / 6;
      else h = ((rf - gf) / d + 4) / 6;
    }
    const boostedS = Math.min(s * 1.2, 0.85);
    const boostedL = Math.min(l + (1 - l) * 0.1, 0.85);

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q2 = boostedL < 0.5 ? boostedL * (1 + boostedS) : boostedL + boostedS - boostedL * boostedS;
    const p2 = 2 * boostedL - q2;
    const or = Math.round(hue2rgb(p2, q2, h + 1 / 3) * 255);
    const og = Math.round(hue2rgb(p2, q2, h) * 255);
    const ob = Math.round(hue2rgb(p2, q2, h - 1 / 3) * 255);

    return `#${or.toString(16).padStart(2, "0")}${og.toString(16).padStart(2, "0")}${ob.toString(16).padStart(2, "0")}`;
  });
}

// ── Seeded RNG ──────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Watercolor geometry ─────────────────────────────────────────────────────

function basePolygon(cx, cy, rx, ry, n, rng) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const wobble = 0.85 + rng() * 0.3;
    pts.push({ x: cx + Math.cos(angle) * rx * wobble, y: cy + Math.sin(angle) * ry * wobble });
  }
  return pts;
}

function deformPolygon(pts, depth, variance, rng) {
  let current = pts;
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const disp = (rng() - 0.5) * len * variance;
      next.push(a);
      next.push({ x: mx + nx * disp, y: my + ny * disp });
    }
    current = next;
  }
  return current;
}

function drawPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// ── Watercolor effects ──────────────────────────────────────────────────────

function watercolorWash(ctx, poly, color, rng, layers = 60, layerAlpha = 0.018) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = color;
  for (let i = 0; i < layers; i++) {
    const deformed = deformPolygon(poly, 4, 0.5 + rng() * 0.3, rng);
    ctx.globalAlpha = layerAlpha * (0.6 + rng() * 0.8);
    drawPoly(ctx, deformed);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const deformed = deformPolygon(poly, 3, 0.3, rng);
    ctx.globalAlpha = 0.008 + rng() * 0.006;
    drawPoly(ctx, deformed);
    ctx.stroke();
  }
  ctx.restore();
}

function wetBloom(ctx, cx, cy, radius, color, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 15; i++) {
    const ox = (rng() - 0.5) * radius * 0.5;
    const oy = (rng() - 0.5) * radius * 0.5;
    const r = radius * (0.6 + rng() * 0.6);
    ctx.globalAlpha = 0.02 + rng() * 0.02;
    const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.6, color);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
  }
  ctx.restore();
}

function applyPaperTexture(ctx, rng, w, h) {
  const scale = 4;
  const tw = Math.ceil(w / scale);
  const th = Math.ceil(h / scale);
  const tc = createCanvas(tw, th);
  const tx = tc.getContext("2d");
  const img = tx.createImageData(tw, th);

  for (let i = 0; i < img.data.length; i += 4) {
    const noise = 215 + rng() * 40;
    img.data[i] = noise;
    img.data[i + 1] = noise - 2;
    img.data[i + 2] = noise - 5;
    img.data[i + 3] = 255;
  }
  tx.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.6;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tc, 0, 0, w, h);
  ctx.restore();
}

function drawWatercolorBackground(ctx, seed, w, h, imagePalette) {
  const palette =
    imagePalette && imagePalette.length >= 3
      ? imagePalette
      : FALLBACK_PALETTES[seed % FALLBACK_PALETTES.length];
  const rng = mulberry32(seed);

  ctx.fillStyle = "#FEFCF9";
  ctx.fillRect(0, 0, w, h);

  const washCount = 4 + Math.floor(rng() * 3);
  const washes = [];
  for (let i = 0; i < washCount; i++) {
    washes.push({
      cx: rng() * w, cy: rng() * h,
      rx: 200 + rng() * 350, ry: 200 + rng() * 350,
      color: palette[Math.floor(rng() * palette.length)],
    });
  }

  for (const ws of washes) {
    const poly = basePolygon(ws.cx, ws.cy, ws.rx, ws.ry, 12, rng);
    watercolorWash(ctx, poly, ws.color, rng, 60, 0.018);
  }

  for (let i = 0; i < washes.length; i++) {
    const a = washes[i];
    const b = washes[(i + 1) % washes.length];
    const blendCx = (a.cx + b.cx) / 2 + (rng() - 0.5) * 200;
    const blendCy = (a.cy + b.cy) / 2 + (rng() - 0.5) * 200;
    const blendR = 120 + rng() * 180;
    const poly = basePolygon(blendCx, blendCy, blendR, blendR * (0.6 + rng() * 0.8), 10, rng);
    watercolorWash(ctx, poly, rng() > 0.5 ? a.color : b.color, rng, 35, 0.014);
  }

  for (let i = 0; i < 3; i++) {
    const ws = washes[Math.floor(rng() * washes.length)];
    wetBloom(ctx, ws.cx + (rng() - 0.5) * ws.rx, ws.cy + (rng() - 0.5) * ws.ry, 100 + rng() * 150, ws.color, rng);
  }

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 30; i++) {
    const ws = washes[Math.floor(rng() * washes.length)];
    const sx = ws.cx + (rng() - 0.5) * ws.rx * 2.5;
    const sy = ws.cy + (rng() - 0.5) * ws.ry * 2.5;
    const sr = 2 + rng() * 8;
    ctx.globalAlpha = 0.03 + rng() * 0.05;
    ctx.fillStyle = ws.color;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  applyPaperTexture(ctx, rng, w, h);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// ── Card renderers ──────────────────────────────────────────────────────────

const CARD_PRESETS = {
  post: {
    w: POST_W, h: POST_H,
    padding: 70, captionHeight: 180, captionGap: 28,
    shadowBlur: 28, shadowOffsetY: 6,
    fadeStops: [0, 0.2, 0.5, 1],
    titleFont: 'italic 38px "Georgia", "Liberation Serif", "Times New Roman", serif',
    titleLineHeight: 48,
    artistFont: '300 24px "Liberation Sans", "Helvetica Neue", Arial, sans-serif',
    artistGap: 4,
    brandFont: 'italic 800 22px "Georgia", "Liberation Serif", serif',
    brandBottomOffset: 44,
  },
  story: {
    w: STORY_W, h: STORY_H,
    padding: 80, captionHeight: 200, captionGap: 40,
    shadowBlur: 32, shadowOffsetY: 8,
    fadeStops: [0, 0.15, 0.4, 1],
    titleFont: 'italic 42px "Georgia", "Liberation Serif", "Times New Roman", serif',
    titleLineHeight: 54,
    artistFont: '300 28px "Liberation Sans", "Helvetica Neue", Arial, sans-serif',
    artistGap: 8,
    brandFont: 'italic 800 26px "Georgia", "Liberation Serif", serif',
    brandBottomOffset: 60,
  },
};

async function renderCard(art, imageUrl, preset) {
  const { w, h, padding, captionHeight, captionGap, shadowBlur, shadowOffsetY,
    fadeStops, titleFont, titleLineHeight, artistFont, artistGap,
    brandFont, brandBottomOffset } = preset;

  const img = await fetchImage(imageUrl);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  const imagePalette = extractPalette(img);
  drawWatercolorBackground(ctx, Math.abs(art.id), w, h, imagePalette);

  const availW = w - padding * 2;
  const availH = h - padding * 2 - captionHeight;

  const scale = Math.min(availW / img.width, availH / img.height, 1);
  const artW = Math.round(img.width * scale);
  const artH = Math.round(img.height * scale);
  const artX = Math.round((w - artW) / 2);
  const artY = padding + Math.round((availH - artH) / 2);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = shadowOffsetY;
  ctx.drawImage(img, artX, artY, artW, artH);
  ctx.restore();

  const fadeTop = artY + artH - 10;
  const fadeGrad = ctx.createLinearGradient(0, fadeTop, 0, h);
  fadeGrad.addColorStop(fadeStops[0], "rgba(254, 252, 249, 0)");
  fadeGrad.addColorStop(fadeStops[1], "rgba(254, 252, 249, 0.75)");
  fadeGrad.addColorStop(fadeStops[2], "rgba(254, 252, 249, 0.92)");
  fadeGrad.addColorStop(fadeStops[3], "rgba(254, 252, 249, 0.95)");
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, fadeTop, w, h - fadeTop);

  const captionY = artY + artH + captionGap;
  const captionMaxW = w - padding * 2;

  ctx.fillStyle = "#2a2a2a";
  ctx.font = titleFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const titleLines = truncateText(ctx, art.title, captionMaxW, 2);
  let lineY = captionY;
  for (const line of titleLines) {
    ctx.fillText(line, w / 2, lineY);
    lineY += titleLineHeight;
  }

  ctx.fillStyle = "#888";
  ctx.font = artistFont;
  const artistText = art.artist.length > 50 ? art.artist.slice(0, 47) + "\u2026" : art.artist;
  ctx.fillText(artistText, w / 2, lineY + artistGap);

  ctx.fillStyle = "#555";
  ctx.font = brandFont;
  ctx.fillText("A R T T O K", w / 2, h - brandBottomOffset);

  return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

/**
 * Render a 1080x1350 Instagram feed post card.
 * @param {object} art - ArtPiece-like object with { id, title, artist, imageUrl }
 * @param {string} imageUrl - URL of the artwork image
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function renderPostCard(art, imageUrl) {
  return renderCard(art, imageUrl, CARD_PRESETS.post);
}

/**
 * Render a 1080x1920 Instagram story card.
 * @param {object} art - ArtPiece-like object with { id, title, artist, imageUrl }
 * @param {string} imageUrl - URL of the artwork image
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function renderStoryCard(art, imageUrl) {
  return renderCard(art, imageUrl, CARD_PRESETS.story);
}

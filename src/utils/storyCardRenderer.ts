import type { ArtPiece } from "../types/art";

const W = 1080;
const H = 1920;

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
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
      while (ctx.measureText(trimmed + "…").width > maxWidth && trimmed.length > 0) {
        trimmed = trimmed.slice(0, -1).trimEnd();
      }
      lines[maxLines - 1] = trimmed + "…";
    }
  }

  return lines;
}

// Referrer URLs for sources that require them (e.g. AIC IIIF)
const REFERRERS: Record<string, string> = {
  "www.artic.edu": "https://www.artic.edu/",
};

async function fetchAsBlob(url: string): Promise<HTMLImageElement> {
  const hostname = new URL(url).hostname;
  const referrer = REFERRERS[hostname];

  const res = await fetch(url, referrer ? { referrer, referrerPolicy: "origin" } : undefined);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const img = await loadImg(objectUrl, false);
  (img as HTMLImageElement & { _objectUrl?: string })._objectUrl = objectUrl;
  return img;
}

export async function loadShareImage(url: string): Promise<HTMLImageElement> {
  // 1. Fetch as blob with referrer spoofing for blocked sources (AIC)
  try {
    return await fetchAsBlob(url);
  } catch {
    // fetch blocked
  }

  // 2. crossOrigin attribute — works if server sends CORS headers
  try {
    return await loadImg(url, true);
  } catch {
    // Last resort — no CORS, canvas will be tainted
    return loadImg(url, false);
  }
}

function loadImg(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });
}

// Fallback warm palettes — used only if color extraction fails
const FALLBACK_PALETTES = [
  ["#E8845C", "#F4A261", "#E76F51", "#F2CC8F", "#D4A373"], // sunset coral
  ["#C97B63", "#E0A899", "#D4856B", "#F0D2C4", "#B5654A"], // terracotta blush
  ["#D4A03C", "#E8C468", "#C4883C", "#F2D98C", "#B07828"], // amber honey
  ["#C07088", "#D4949C", "#B85878", "#E8B8C0", "#A04468"], // dusty rose
  ["#C89640", "#D8B06C", "#B87C2C", "#E8CC94", "#A06820"], // warm ochre
];

/**
 * Median Cut palette extraction — the industry-standard algorithm (same as color-thief).
 * Recursively splits the pixel population along the channel with the widest range,
 * producing `count` perceptually distinct color clusters.
 */
function extractPalette(img: HTMLImageElement, count = 5): string[] {
  const size = 100;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const cx = c.getContext("2d", { willReadFrequently: true });
  if (!cx) return [];

  cx.drawImage(img, 0, 0, size, size);
  const { data } = cx.getImageData(0, 0, size, size);

  // Collect all usable pixels — skip transparent, near-white, near-black
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 245 || lum < 10) continue;
    pixels.push([r, g, b]);
  }

  if (pixels.length < count) return [];

  // ── Median Cut ──
  type Box = [number, number, number][];

  function channelRange(box: Box, ch: 0 | 1 | 2): number {
    let min = 255, max = 0;
    for (const px of box) {
      if (px[ch] < min) min = px[ch];
      if (px[ch] > max) max = px[ch];
    }
    return max - min;
  }

  function widestChannel(box: Box): 0 | 1 | 2 {
    const rr = channelRange(box, 0);
    const gr = channelRange(box, 1);
    const br = channelRange(box, 2);
    if (rr >= gr && rr >= br) return 0;
    if (gr >= rr && gr >= br) return 1;
    return 2;
  }

  function splitBox(box: Box): [Box, Box] {
    const ch = widestChannel(box);
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = Math.floor(box.length / 2);
    return [box.slice(0, mid), box.slice(mid)];
  }

  function averageColor(box: Box): [number, number, number] {
    let rSum = 0, gSum = 0, bSum = 0;
    for (const [r, g, b] of box) {
      rSum += r; gSum += g; bSum += b;
    }
    const n = box.length;
    return [Math.round(rSum / n), Math.round(gSum / n), Math.round(bSum / n)];
  }

  // Start with all pixels in one box, split until we have enough
  const boxes: Box[] = [pixels];
  while (boxes.length < count) {
    // Split the box with the widest color range
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

  // Average each box to get final palette, sorted by population (largest cluster first)
  boxes.sort((a, b) => b.length - a.length);

  // Boost saturation slightly so watercolor washes look vivid, not muddy
  return boxes.slice(0, count).map((box) => {
    const [r, g, b] = averageColor(box);
    // Convert to HSL, bump saturation, convert back
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
    // Bump saturation by 20%, cap at 0.85 — keeps it vivid but not neon
    const boostedS = Math.min(s * 1.2, 0.85);
    // Lighten slightly for the watercolor wash feel
    const boostedL = Math.min(l + (1 - l) * 0.1, 0.85);

    // HSL → RGB
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
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

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = { x: number; y: number };
type RNG = () => number;

/** Generate a base polygon (rough circle) with `n` vertices */
function basePolygon(cx: number, cy: number, rx: number, ry: number, n: number, rng: RNG): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const wobble = 0.85 + rng() * 0.3;
    pts.push({
      x: cx + Math.cos(angle) * rx * wobble,
      y: cy + Math.sin(angle) * ry * wobble,
    });
  }
  return pts;
}

/**
 * Tyler Hobbs polygon deformation — recursive midpoint displacement.
 * Each iteration doubles vertex count and displaces midpoints perpendicular to the edge.
 * This is what gives watercolor its organic, fractal edges.
 */
function deformPolygon(pts: Pt[], depth: number, variance: number, rng: RNG): Pt[] {
  let current = pts;
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];

      // Midpoint
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;

      // Edge perpendicular
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // Displacement proportional to edge length
      const disp = (rng() - 0.5) * len * variance;

      next.push(a);
      next.push({ x: mx + nx * disp, y: my + ny * disp });
    }
    current = next;
  }
  return current;
}

/** Draw a polygon path from point array */
function drawPoly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
}

/**
 * Render one watercolor wash — the core of the effect.
 * Draws 50-80 deformed copies of a polygon at very low alpha.
 * Overlap naturally creates: darker edges, soft interior, organic boundary.
 */
function watercolorWash(
  ctx: CanvasRenderingContext2D,
  poly: Pt[],
  color: string,
  rng: RNG,
  layers = 60,
  layerAlpha = 0.018,
) {
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

  // Edge darkening pass — strokes on deformed outlines to simulate pigment pooling
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

/**
 * Wet-on-wet bloom — soft feathered spread at a point.
 * Many offset radial gradients at very low alpha simulate pigment diffusion.
 */
function wetBloom(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  rng: RNG,
) {
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

/**
 * Paper grain texture — Perlin-ish noise overlay.
 * Uses simple value noise composited with multiply to simulate
 * pigment settling into paper valleys.
 */
function applyPaperTexture(ctx: CanvasRenderingContext2D, rng: RNG, w: number, h: number) {
  // Generate on a smaller canvas and scale up for performance
  const scale = 4;
  const tw = Math.ceil(w / scale);
  const th = Math.ceil(h / scale);
  const tc = document.createElement("canvas");
  tc.width = tw;
  tc.height = th;
  const tx = tc.getContext("2d")!;
  const img = tx.createImageData(tw, th);

  for (let i = 0; i < img.data.length; i += 4) {
    const noise = 215 + rng() * 40; // range 215-255: subtle warm paper grain
    img.data[i] = noise;
    img.data[i + 1] = noise - 2; // slightly warm tint
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

function drawWatercolorBackground(
  ctx: CanvasRenderingContext2D,
  seed: number,
  w: number,
  h: number,
  imagePalette?: string[],
) {
  const palette =
    imagePalette && imagePalette.length >= 3
      ? imagePalette
      : FALLBACK_PALETTES[seed % FALLBACK_PALETTES.length];
  const rng = mulberry32(seed);

  // Warm white base
  ctx.fillStyle = "#FEFCF9";
  ctx.fillRect(0, 0, w, h);

  // ── Plan wash placements — 4-6 large washes across the canvas ──
  const washCount = 4 + Math.floor(rng() * 3);
  const washes: { cx: number; cy: number; rx: number; ry: number; color: string }[] = [];
  for (let i = 0; i < washCount; i++) {
    washes.push({
      cx: rng() * w,
      cy: rng() * h,
      rx: 200 + rng() * 350,
      ry: 200 + rng() * 350,
      color: palette[Math.floor(rng() * palette.length)],
    });
  }

  // ── Phase 1: Large watercolor washes (the main color areas) ──
  for (const w of washes) {
    const poly = basePolygon(w.cx, w.cy, w.rx, w.ry, 12, rng);
    watercolorWash(ctx, poly, w.color, rng, 60, 0.018);
  }

  // ── Phase 2: Smaller overlapping washes for color bleeding ──
  for (let i = 0; i < washes.length; i++) {
    const a = washes[i];
    const b = washes[(i + 1) % washes.length];
    // Place a blending wash between two adjacent washes
    const blendCx = (a.cx + b.cx) / 2 + (rng() - 0.5) * 200;
    const blendCy = (a.cy + b.cy) / 2 + (rng() - 0.5) * 200;
    const blendR = 120 + rng() * 180;
    const poly = basePolygon(blendCx, blendCy, blendR, blendR * (0.6 + rng() * 0.8), 10, rng);
    // Use the neighboring color so washes bleed into each other
    watercolorWash(ctx, poly, rng() > 0.5 ? a.color : b.color, rng, 35, 0.014);
  }

  // ── Phase 3: Wet-on-wet blooms at wash intersections ──
  for (let i = 0; i < 3; i++) {
    const w = washes[Math.floor(rng() * washes.length)];
    wetBloom(ctx, w.cx + (rng() - 0.5) * w.rx, w.cy + (rng() - 0.5) * w.ry, 100 + rng() * 150, w.color, rng);
  }

  // ── Phase 4: Tiny splatter dots near washes ──
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 30; i++) {
    const w = washes[Math.floor(rng() * washes.length)];
    const sx = w.cx + (rng() - 0.5) * w.rx * 2.5;
    const sy = w.cy + (rng() - 0.5) * w.ry * 2.5;
    const sr = 2 + rng() * 8;
    ctx.globalAlpha = 0.03 + rng() * 0.05;
    ctx.fillStyle = w.color;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── Phase 5: Paper grain texture overlay ──
  applyPaperTexture(ctx, rng, w, h);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

const PADDING = 80;
const CAPTION_HEIGHT = 200;

export async function renderStoryCard(
  art: ArtPiece,
  img: HTMLImageElement,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Watercolor background from artwork's own palette ──
  const imagePalette = extractPalette(img);
  drawWatercolorBackground(ctx, Math.abs(art.id), W, H, imagePalette);

  // ── Artwork — maintain natural aspect ratio, fit within available space ──
  const availW = W - PADDING * 2;
  const availH = H - PADDING * 2 - CAPTION_HEIGHT;

  const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1);
  const artW = Math.round(img.naturalWidth * scale);
  const artH = Math.round(img.naturalHeight * scale);
  const artX = Math.round((W - artW) / 2);
  const artY = PADDING + Math.round((availH - artH) / 2);

  // Subtle shadow behind artwork
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.10)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(img, artX, artY, artW, artH);
  ctx.restore();

  // ── Soft white fade behind caption + branding for legibility ──
  const fadeTop = artY + artH - 10;
  const fadeGrad = ctx.createLinearGradient(0, fadeTop, 0, H);
  fadeGrad.addColorStop(0, "rgba(254, 252, 249, 0)");
  fadeGrad.addColorStop(0.15, "rgba(254, 252, 249, 0.75)");
  fadeGrad.addColorStop(0.4, "rgba(254, 252, 249, 0.92)");
  fadeGrad.addColorStop(1, "rgba(254, 252, 249, 0.95)");
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, fadeTop, W, H - fadeTop);

  // ── Caption below artwork ──
  const captionY = artY + artH + 40;
  const captionMaxW = W - PADDING * 2;

  // Title
  ctx.fillStyle = "#2a2a2a";
  ctx.font = `italic 42px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const titleLines = truncateText(ctx, art.title, captionMaxW, 2);
  let lineY = captionY;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, lineY);
    lineY += 54;
  }

  // Artist
  ctx.fillStyle = "#888";
  ctx.font = `300 28px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const artistText = art.artist.length > 50 ? art.artist.slice(0, 47) + "…" : art.artist;
  ctx.fillText(artistText, W / 2, lineY + 8);

  // ── Branding at bottom ──
  ctx.fillStyle = "#555";
  ctx.font = `italic 800 26px "Playfair Display", Georgia, "Times New Roman", serif`;
  ctx.letterSpacing = "6px";
  ctx.fillText("ARTTOK", W / 2, H - 60);
  ctx.letterSpacing = "0px";

  return toBlob(canvas);
}

/** Instagram post format — 1080 × 1350 (4:5) */
const POST_W = 1080;
const POST_H = 1350;
const POST_PADDING = 100;
const POST_CAPTION_HEIGHT = 240;

export async function renderPostCard(
  art: ArtPiece,
  img: HTMLImageElement,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = POST_W;
  canvas.height = POST_H;
  const ctx = canvas.getContext("2d")!;

  // ── Watercolor background from artwork's own palette ──
  const imagePalette = extractPalette(img);
  drawWatercolorBackground(ctx, Math.abs(art.id), POST_W, POST_H, imagePalette);

  // ── Artwork — maintain natural aspect ratio, fit within available space ──
  const availW = POST_W - POST_PADDING * 2;
  const availH = POST_H - POST_PADDING * 2 - POST_CAPTION_HEIGHT;

  const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1);
  const artW = Math.round(img.naturalWidth * scale);
  const artH = Math.round(img.naturalHeight * scale);
  const artX = Math.round((POST_W - artW) / 2);
  const artY = POST_PADDING + Math.round((availH - artH) / 2);

  // Subtle shadow behind artwork
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.10)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(img, artX, artY, artW, artH);
  ctx.restore();

  // ── Soft white fade behind caption + branding for legibility ──
  const fadeTop = artY + artH - 10;
  const fadeGrad = ctx.createLinearGradient(0, fadeTop, 0, POST_H);
  fadeGrad.addColorStop(0, "rgba(254, 252, 249, 0)");
  fadeGrad.addColorStop(0.2, "rgba(254, 252, 249, 0.75)");
  fadeGrad.addColorStop(0.5, "rgba(254, 252, 249, 0.92)");
  fadeGrad.addColorStop(1, "rgba(254, 252, 249, 0.95)");
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, fadeTop, POST_W, POST_H - fadeTop);

  // ── Caption below artwork ──
  const captionY = artY + artH + 28;
  const captionMaxW = POST_W - POST_PADDING * 2;

  // Title
  ctx.fillStyle = "#2a2a2a";
  ctx.font = `italic 38px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const titleLines = truncateText(ctx, art.title, captionMaxW, 2);
  let lineY = captionY;
  for (const line of titleLines) {
    ctx.fillText(line, POST_W / 2, lineY);
    lineY += 48;
  }

  // Artist
  ctx.fillStyle = "#888";
  ctx.font = `300 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const artistText = art.artist.length > 50 ? art.artist.slice(0, 47) + "…" : art.artist;
  ctx.fillText(artistText, POST_W / 2, lineY + 4);

  // ── Branding at bottom ──
  ctx.fillStyle = "#555";
  ctx.font = `italic 800 22px "Playfair Display", Georgia, "Times New Roman", serif`;
  ctx.letterSpacing = "5px";
  ctx.fillText("ARTTOK", POST_W / 2, POST_H - 44);
  ctx.letterSpacing = "0px";

  return toBlob(canvas);
}

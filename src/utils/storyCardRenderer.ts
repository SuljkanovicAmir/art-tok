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

export async function loadShareImage(url: string): Promise<HTMLImageElement> {
  // Fetch as blob first — avoids canvas tainting from cross-origin images
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const img = await loadImg(objectUrl, false);
    // Keep objectUrl alive — revoke after canvas draw in caller
    (img as HTMLImageElement & { _objectUrl?: string })._objectUrl = objectUrl;
    return img;
  } catch {
    // fetch blocked (e.g. opaque redirect) — try crossOrigin
  }

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

// Warm color palettes — picked per card based on art.id
const PALETTES = [
  ["#E8845C", "#F4A261", "#E76F51", "#F2CC8F", "#D4A373"], // sunset coral
  ["#C97B63", "#E0A899", "#D4856B", "#F0D2C4", "#B5654A"], // terracotta blush
  ["#D4A03C", "#E8C468", "#C4883C", "#F2D98C", "#B07828"], // amber honey
  ["#C07088", "#D4949C", "#B85878", "#E8B8C0", "#A04468"], // dusty rose
  ["#C89640", "#D8B06C", "#B87C2C", "#E8CC94", "#A06820"], // warm ochre
];

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWarmShapesOnWhite(ctx: CanvasRenderingContext2D, seed: number) {
  const palette = PALETTES[seed % PALETTES.length];
  const rng = mulberry32(seed);

  // White base
  ctx.fillStyle = "#FEFCF9";
  ctx.fillRect(0, 0, W, H);

  // Large soft blobs on the white surface
  for (let i = 0; i < 5; i++) {
    const color = palette[Math.floor(rng() * palette.length)];
    const x = rng() * W;
    const y = rng() * H;
    const rx = 250 + rng() * 350;
    const ry = 250 + rng() * 350;
    const rotation = rng() * Math.PI * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = 0.12 + rng() * 0.10;

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    grad.addColorStop(0, color);
    grad.addColorStop(0.7, color + "44");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;

    ctx.beginPath();
    const points = 6;
    for (let p = 0; p <= points; p++) {
      const angle = (p / points) * Math.PI * 2;
      const wobble = 0.7 + rng() * 0.6;
      const px = Math.cos(angle) * rx * wobble;
      const py = Math.sin(angle) * ry * wobble;
      if (p === 0) {
        ctx.moveTo(px, py);
      } else {
        const cpAngle = ((p - 0.5) / points) * Math.PI * 2;
        const cpWobble = 0.7 + rng() * 0.6;
        const cpx = Math.cos(cpAngle) * rx * cpWobble * 1.2;
        const cpy = Math.sin(cpAngle) * ry * cpWobble * 1.2;
        ctx.quadraticCurveTo(cpx, cpy, px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Smaller accent dots
  for (let i = 0; i < 6; i++) {
    const color = palette[Math.floor(rng() * palette.length)];
    const x = rng() * W;
    const y = rng() * H;
    const r = 40 + rng() * 120;

    ctx.save();
    ctx.globalAlpha = 0.06 + rng() * 0.08;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
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

  // ── White background with warm color shapes ──
  drawWarmShapesOnWhite(ctx, Math.abs(art.id));

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
  ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(img, artX, artY, artW, artH);
  ctx.restore();

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


export interface ColorSwatch {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
}

/**
 * Extract dominant colors from an image URL.
 * Uses canvas pixel sampling + simplified k-means clustering.
 */
export async function extractColors(imageUrl: string, k = 5): Promise<ColorSwatch[]> {
  const img = await loadImage(imageUrl);
  const pixels = getPixels(img);
  const clusters = kMeans(pixels, k);

  const total = clusters.reduce((sum, c) => sum + c.count, 0);

  return clusters
    .sort((a, b) => b.count - a.count)
    .map((c) => ({
      hex: rgbToHex(c.center),
      rgb: c.center,
      percentage: Math.round((c.count / total) * 100),
    }));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function getPixels(img: HTMLImageElement): [number, number, number][] {
  // Downsample to max 100x100 for performance
  const maxSize = 100;
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const w = Math.floor(img.width * scale);
  const h = Math.floor(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels: [number, number, number][] = [];

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    // Skip transparent pixels
    if (a < 128) continue;
    pixels.push([r, g, b]);
  }

  return pixels;
}

interface Cluster {
  center: [number, number, number];
  count: number;
}

function kMeans(pixels: [number, number, number][], k: number, maxIterations = 10): Cluster[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) {
    return pixels.map((p) => ({ center: p, count: 1 }));
  }

  // Initialize centers using evenly spaced pixels
  let centers: [number, number, number][] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centers.push([...pixels[i * step]]);
  }

  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each pixel to nearest center
    const newAssignments = pixels.map((pixel) => {
      let minDist = Infinity;
      let closest = 0;
      for (let c = 0; c < centers.length; c++) {
        const dist = colorDistance(pixel, centers[c]);
        if (dist < minDist) {
          minDist = dist;
          closest = c;
        }
      }
      return closest;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    // Update centers
    const sums: [number, number, number][] = centers.map(() => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      counts[c]++;
    }

    centers = sums.map((sum, i) => {
      if (counts[i] === 0) return centers[i];
      return [
        Math.round(sum[0] / counts[i]),
        Math.round(sum[1] / counts[i]),
        Math.round(sum[2] / counts[i]),
      ] as [number, number, number];
    });
  }

  // Build result
  const counts = new Array(k).fill(0);
  for (const a of assignments) counts[a]++;

  return centers.map((center, i) => ({
    center,
    count: counts[i],
  })).filter((c) => c.count > 0);
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function rgbToHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}

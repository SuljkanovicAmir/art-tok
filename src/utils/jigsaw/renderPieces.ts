import type { Jigsaw } from "../../types/jigsaw";
import { piecePath, pieceBounds } from "./geometry";

/** One canvas per piece, sized to its bounds in image pixels. Browser only. */
export function renderPieces(image: CanvasImageSource, jigsaw: Jigsaw): HTMLCanvasElement[] {
  const scale = jigsaw.width / 900;
  const canvases: HTMLCanvasElement[] = [];

  for (let piece = 0; piece < jigsaw.cols * jigsaw.rows; piece++) {
    const bounds = pieceBounds(jigsaw, piece);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bounds.width);
    canvas.height = Math.ceil(bounds.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvases.push(canvas);
      continue;
    }

    const path = new Path2D(piecePath(jigsaw, piece));
    ctx.translate(-bounds.x, -bounds.y);
    ctx.save();
    ctx.clip(path);
    ctx.drawImage(image, 0, 0, jigsaw.width, jigsaw.height);

    // Emboss while still clipped: a light edge down-right, a dark edge up-left.
    ctx.lineWidth = 2.5 * scale;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.translate(1, 1);
    ctx.stroke(path);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.translate(-2, -2);
    ctx.stroke(path);
    ctx.restore();

    canvases.push(canvas);
  }
  return canvases;
}

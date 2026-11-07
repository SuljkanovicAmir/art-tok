import type { GridSize, Jigsaw, JigsawPainting } from "../../types/jigsaw";
import { cutJigsaw } from "./geometry";
import { renderPieces } from "./renderPieces";

export const jigsawImageUrl = (painting: JigsawPainting): string =>
  `${import.meta.env.BASE_URL}jigsaw-paintings/${painting.id}.jpg`;

export interface LoadedJigsaw {
  image: HTMLImageElement;
  jigsaw: Jigsaw;
  pieces: HTMLCanvasElement[];
}

/** Loads the image, cuts it and renders every piece. Returns null if anything fails. */
export async function loadJigsaw(
  painting: JigsawPainting,
  grid: GridSize,
  seed: number,
): Promise<LoadedJigsaw | null> {
  try {
    const image = new Image();
    image.src = jigsawImageUrl(painting);
    await image.decode();
    const jigsaw = cutJigsaw(image.naturalWidth, image.naturalHeight, grid, seed);
    return { image, jigsaw, pieces: renderPieces(image, jigsaw) };
  } catch {
    return null;
  }
}

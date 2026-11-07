import { describe, expect, it } from "vitest";
import type { JigsawPainting } from "../../types/jigsaw";
import manifest from "../jigsaw/paintings.json";

const paintings = manifest as JigsawPainting[];
const imageFiles = new Set(Object.keys(import.meta.glob("/public/jigsaw-paintings/*.jpg")));

describe("jigsaw paintings manifest", () => {
  it("has enough paintings for a long cycle", () => {
    expect(paintings.length).toBeGreaterThanOrEqual(40);
  });

  it("has unique ids", () => {
    expect(new Set(paintings.map((p) => p.id)).size).toBe(paintings.length);
  });

  it("is sorted by id", () => {
    const ids = paintings.map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  describe.each(paintings.map((p) => [p.id, p] as const))("painting %s", (_id, painting) => {
    it("has every field of the JigsawPainting shape", () => {
      expect(Number.isInteger(painting.id)).toBe(true);
      for (const key of ["title", "artist", "date"] as const) {
        expect(typeof painting[key]).toBe("string");
        expect(painting[key].trim().length).toBeGreaterThan(0);
      }
      expect(Number.isInteger(painting.width)).toBe(true);
      expect(Number.isInteger(painting.height)).toBe(true);
      expect(painting.width).toBeGreaterThan(0);
      expect(painting.height).toBeGreaterThan(0);
      expect(Object.keys(painting).sort()).toEqual(
        ["artist", "color", "date", "height", "id", "title", "width"],
      );
    });

    it("has an aspect between 0.62 and 1.7", () => {
      const aspect = painting.width / painting.height;
      expect(aspect).toBeGreaterThanOrEqual(0.62);
      expect(aspect).toBeLessThanOrEqual(1.7);
    });

    it("has a #rrggbb colour", () => {
      expect(painting.color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("has an image on disk", () => {
      expect(imageFiles.has(`/public/jigsaw-paintings/${painting.id}.jpg`)).toBe(true);
    });
  });
});

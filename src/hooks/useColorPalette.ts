import { useState, useEffect } from "react";
import type { ColorSwatch } from "../utils/extractColors";
import { extractColors } from "../utils/extractColors";

const cache = new Map<string, ColorSwatch[]>();

export function useColorPalette(imageUrl: string | undefined) {
  const [palette, setPalette] = useState<ColorSwatch[] | null>(
    imageUrl ? cache.get(imageUrl) ?? null : null
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;

    const cached = cache.get(imageUrl);
    if (cached) {
      setPalette(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    extractColors(imageUrl)
      .then((colors) => {
        if (!cancelled) {
          cache.set(imageUrl, colors);
          setPalette(colors);
        }
      })
      .catch(() => {
        // CORS or load failure — silently ignore
        if (!cancelled) setPalette(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [imageUrl]);

  return { palette, isLoading };
}

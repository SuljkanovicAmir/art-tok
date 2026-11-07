import { useCallback, useEffect, useState } from "react";
import type { GridSize, JigsawAssets, JigsawPainting } from "../types/jigsaw";
import { loadJigsaw } from "../utils/jigsaw/assets";
import type { LoadedJigsaw } from "../utils/jigsaw/assets";

interface Settled {
  key: string;
  result: LoadedJigsaw | null;
}

const LOADING: JigsawAssets = { status: "loading", image: null, jigsaw: null, pieces: [] };

/** Loads the day's image and cuts it. `enabled` false waits without loading. */
export function useJigsawAssets(
  painting: JigsawPainting,
  grid: GridSize,
  seed: number,
  enabled: boolean,
): JigsawAssets & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const key = `${painting.id}:${grid.cols}x${grid.rows}:${seed}:${attempt}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      const result = await loadJigsaw(painting, grid, seed);
      if (!cancelled) setSettled({ key, result });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, key, painting, grid, seed]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!settled || settled.key !== key) return { ...LOADING, retry };
  if (!settled.result) return { ...LOADING, status: "error", retry };
  return { status: "ready", ...settled.result, retry };
}

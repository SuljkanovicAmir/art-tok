import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const SEASONAL_COOLDOWN_RESET = 99;

const MAX_HISTORY = 5000;

export function loadHistoryData(historyFile) {
  if (!existsSync(historyFile)) {
    return { posted: [], runIndex: 0, postsSinceLastSeasonal: SEASONAL_COOLDOWN_RESET };
  }
  try {
    const raw = JSON.parse(readFileSync(historyFile, "utf-8"));
    // Migrate from old array format
    if (Array.isArray(raw)) {
      return { posted: raw, runIndex: 0, postsSinceLastSeasonal: SEASONAL_COOLDOWN_RESET };
    }
    return {
      posted: raw.posted || [],
      runIndex: raw.runIndex || 0,
      postsSinceLastSeasonal: raw.postsSinceLastSeasonal ?? SEASONAL_COOLDOWN_RESET,
    };
  } catch {
    return { posted: [], runIndex: 0, postsSinceLastSeasonal: SEASONAL_COOLDOWN_RESET };
  }
}

export function saveHistoryData(historyFile, historyData) {
  const trimmed = historyData.posted.slice(-MAX_HISTORY);
  writeFileSync(historyFile, JSON.stringify({
    posted: trimmed,
    runIndex: historyData.runIndex,
    postsSinceLastSeasonal: historyData.postsSinceLastSeasonal,
  }, null, 2));
}

export function artKey(art) {
  return `${art.source}:${art.id}`;
}

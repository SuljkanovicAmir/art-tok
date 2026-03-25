/**
 * Post-publish quality logging.
 *
 * Logs image resolution, metadata completeness, caption length, and card size
 * after each successful publish. Used by analytics.mjs to correlate quality
 * metrics with engagement and flag potential issues.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MAX_ENTRIES = 500;

export function loadQualityLog(logFile) {
  if (!existsSync(logFile)) return [];
  try {
    return JSON.parse(readFileSync(logFile, "utf-8"));
  } catch {
    return [];
  }
}

export function saveQualityLog(logFile, entries) {
  writeFileSync(logFile, JSON.stringify(entries.slice(-MAX_ENTRIES), null, 2));
}

/**
 * Score metadata completeness (0–100).
 * Checks: title, artist, dated, medium, description, culture, museumName.
 */
function metadataScore(art) {
  const checks = [
    art.title && art.title !== "Untitled",
    art.artist && art.artist !== "Unknown artist",
    !!art.dated,
    !!art.medium,
    !!art.description && art.description.length >= 20,
    !!art.culture,
    !!art.museumName,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Build a quality entry for the current post.
 */
export function buildQualityEntry(art, { mode, caption, cardSizeKB, mediaId, wasSeasonal }) {
  return {
    timestamp: new Date().toISOString(),
    mediaId,
    artKey: `${art.source}:${art.id}`,
    source: art.source,
    mode,
    title: art.title,
    artist: art.artist,
    wasSeasonal,
    captionLength: caption.length,
    cardSizeKB: Math.round(cardSizeKB),
    metadataScore: metadataScore(art),
    metadata: {
      hasTitle: art.title && art.title !== "Untitled",
      hasArtist: art.artist && art.artist !== "Unknown artist",
      hasDated: !!art.dated,
      hasMedium: !!art.medium,
      hasDescription: !!art.description && art.description.length >= 20,
      hasCulture: !!art.culture,
    },
  };
}

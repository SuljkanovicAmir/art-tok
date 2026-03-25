import type { ArtPiece, ArtSourceId } from "../types/art";

/** Composite key: "harvard:12345" — unique across all sources */
export function artKey(piece: ArtPiece): string {
  return `${piece.source}:${piece.id}`;
}

/** Inverse of artKey */
export function parseArtKey(key: string): { source: ArtSourceId; id: number } {
  const sep = key.indexOf(":");
  if (sep === -1) {
    // Legacy numeric-only key — assume Harvard
    return { source: "harvard", id: Number(key) };
  }
  return {
    source: key.slice(0, sep) as ArtSourceId,
    id: Number(key.slice(sep + 1)),
  };
}

/** Human-readable source name */
export function sourceName(source: ArtSourceId): string {
  switch (source) {
    case "harvard":
      return "Harvard Art Museums";
    case "met":
      return "The Metropolitan Museum of Art";
    case "artic":
      return "Art Institute of Chicago";
  }
}

/** Museum website URL for a given piece */
export function sourceUrl(piece: ArtPiece): string | undefined {
  if (piece.url) return piece.url;
  switch (piece.source) {
    case "met":
      return `https://www.metmuseum.org/art/collection/search/${piece.id}`;
    case "artic":
      return `https://www.artic.edu/artworks/${piece.id}`;
    default:
      return undefined;
  }
}

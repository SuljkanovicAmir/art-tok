import { useInfiniteQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtPiece } from "../types/art";
import { getPreferenceVector, computeSimilarity } from "../utils/preferenceEngine";

const FETCH_SIZE = 20;
const DISPLAY_SIZE = 8;
const SERENDIPITY_RATIO = 0.2;
const MIN_INTERACTIONS_FOR_RANKING = 10;

function rankAndMix(pieces: ArtPiece[]): ArtPiece[] {
  const vector = getPreferenceVector();

  // Cold start: not enough data to rank meaningfully
  if (vector.totalInteractions < MIN_INTERACTIONS_FOR_RANKING) {
    return pieces.slice(0, DISPLAY_SIZE);
  }

  // Score all pieces
  const scored = pieces.map((piece) => ({
    piece,
    score: computeSimilarity(vector, piece),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Pick top 80% personalized + 20% random from the rest
  const personalizedCount = Math.ceil(DISPLAY_SIZE * (1 - SERENDIPITY_RATIO));
  const serendipityCount = DISPLAY_SIZE - personalizedCount;

  const personalized = scored.slice(0, personalizedCount).map((s) => s.piece);

  // Shuffle the remaining for serendipity picks
  const remaining = scored.slice(personalizedCount);
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  const serendipity = remaining.slice(0, serendipityCount).map((s) => s.piece);

  // Interleave: put serendipity items at positions 3 and 6 (roughly)
  const result = [...personalized];
  const insertPositions = [2, 5]; // 0-indexed positions to insert serendipity
  for (let i = 0; i < serendipity.length; i++) {
    const pos = insertPositions[i] ?? result.length;
    result.splice(Math.min(pos, result.length), 0, serendipity[i]);
  }

  return result.slice(0, DISPLAY_SIZE);
}

export function useFeedQuery() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: async ({ pageParam }) => {
      const result = await artRegistry.fetchFeed({ page: pageParam, size: FETCH_SIZE });
      const ranked = rankAndMix(result.pieces);
      return {
        pieces: ranked,
        hasNext: result.hasNext,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
    staleTime: 2 * 60 * 1000,
  });
}

export function flattenFeedPages(data: ReturnType<typeof useFeedQuery>["data"]) {
  if (!data) return [];
  const seen = new Set<number>();
  const result: ArtPiece[] = [];
  for (const page of data.pages) {
    for (const piece of page.pieces) {
      if (!seen.has(piece.id)) {
        seen.add(piece.id);
        result.push(piece);
      }
    }
  }
  return result;
}

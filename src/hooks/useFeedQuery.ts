import { useInfiniteQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtPiece } from "../types/art";

export function useFeedQuery() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: async ({ pageParam }) => {
      return artRegistry.fetchFeed({ page: pageParam, size: 8 });
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

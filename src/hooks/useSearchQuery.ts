import { useInfiniteQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtPiece, ArtSearchParams } from "../types/art";

export function useSearchQuery(params: ArtSearchParams | null) {
  return useInfiniteQuery({
    queryKey: ["search", params],
    queryFn: async ({ pageParam }) => {
      const result = await artRegistry.search({
        keyword: params!.keyword,
        culture: params!.culture,
        classification: params!.classification,
        century: params!.century,
        medium: params!.medium,
        page: pageParam,
        size: params!.size || 8,
      });
      return {
        pieces: result.pieces,
        totalResults: result.total ?? 0,
        hasNext: result.hasNext,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNext ? lastPageParam + 1 : undefined,
    enabled: params !== null && (
      Boolean(params.keyword?.trim()) ||
      Boolean(params.culture) ||
      Boolean(params.classification) ||
      Boolean(params.century) ||
      Boolean(params.medium)
    ),
    staleTime: 2 * 60 * 1000,
  });
}

export function flattenSearchPages(data: ReturnType<typeof useSearchQuery>["data"]) {
  if (!data) return [];
  const result: ArtPiece[] = [];
  for (const page of data.pages) {
    result.push(...page.pieces);
  }
  return result;
}

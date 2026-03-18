import { useInfiniteQuery } from "@tanstack/react-query";
import ArtImagesService from "../services/ArtImagesService";
import type { ArtPiece, ArtSearchParams } from "../types/art";
import { mapArtRecord } from "../utils/mapArtRecord";

const service = new ArtImagesService();

export function useSearchQuery(params: ArtSearchParams | null) {
  return useInfiniteQuery({
    queryKey: ["search", params],
    queryFn: async ({ pageParam }) => {
      const response = await service.searchArtworks({ ...params!, page: pageParam });
      const pieces = response.records
        .map((r) => mapArtRecord(r))
        .filter((p): p is ArtPiece => p !== null);
      return {
        pieces,
        totalResults: response.info.totalrecords,
        hasNext: Boolean(response.info.next),
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

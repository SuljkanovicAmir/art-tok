import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { artRegistry } from "../services/registry";
import { readLikedSet, LIKED_ART_STORAGE_EVENT } from "../utils/likedArtStorage";
import type { ArtPiece } from "../types/art";

export function useLikedArtQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleChange = () => {
      queryClient.invalidateQueries({ queryKey: ["liked-artworks"] });
    };

    window.addEventListener(LIKED_ART_STORAGE_EVENT, handleChange);
    return () => window.removeEventListener(LIKED_ART_STORAGE_EVENT, handleChange);
  }, [queryClient]);

  return useQuery({
    queryKey: ["liked-artworks", JSON.stringify(Array.from(readLikedSet()))],
    queryFn: async () => {
      const likedIds = readLikedSet();
      if (likedIds.size === 0) return [];

      const results = await Promise.allSettled(
        Array.from(likedIds).map((id) => artRegistry.fetchById(id))
      );

      const pieces: ArtPiece[] = [];
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          pieces.push(result.value);
        }
      }
      return pieces;
    },
    staleTime: 2 * 60 * 1000,
  });
}

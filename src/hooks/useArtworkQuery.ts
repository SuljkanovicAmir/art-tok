import { useQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";
import type { ArtSourceId } from "../types/art";

export function useArtworkQuery(id: number | undefined, source?: ArtSourceId) {
  return useQuery({
    queryKey: ["artwork", source, id],
    queryFn: async () => {
      if (!id) throw new Error("No artwork ID provided");
      const piece = await artRegistry.fetchById(id, source);
      if (!piece) throw new Error("Artwork not found");
      return piece;
    },
    enabled: id !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";

export function useArtworkQuery(id: number | undefined) {
  return useQuery({
    queryKey: ["artwork", id],
    queryFn: async () => {
      if (!id) throw new Error("No artwork ID provided");
      const piece = await artRegistry.fetchById(id);
      if (!piece) throw new Error("Artwork not found");
      return piece;
    },
    enabled: id !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}

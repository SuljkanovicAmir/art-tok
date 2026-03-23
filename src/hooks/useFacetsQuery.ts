import { useQuery } from "@tanstack/react-query";
import { artRegistry } from "../services/registry";

interface FacetSection {
  label: string;
  facet: "culture" | "classification" | "century";
  items: { name: string; count: number }[];
}

export function useFacetsQuery() {
  return useQuery({
    queryKey: ["facets"],
    queryFn: async (): Promise<FacetSection[]> => {
      const [cultures, classifications, centuries] = await Promise.all([
        artRegistry.fetchFacet("culture", 40),
        artRegistry.fetchFacet("classification", 40),
        artRegistry.fetchFacet("century", 30),
      ]);

      return [
        { label: "By Culture", facet: "culture", items: cultures },
        { label: "By Classification", facet: "classification", items: classifications },
        { label: "By Century", facet: "century", items: centuries },
      ];
    },
    staleTime: 10 * 60 * 1000,
  });
}

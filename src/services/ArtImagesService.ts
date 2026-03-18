import type { ArtSearchParams, HarvardArtRecord, HarvardArtResponse } from "../types/art";

const API_ENDPOINT = "https://api.harvardartmuseums.org/object";
const API_KEY = import.meta.env.VITE_HARVARD_API_KEY as string;
const DEFAULT_PAGE_SIZE = 8;
const DEFAULT_QUERY = "verificationlevel:4";
const FIELDS = [
  "objectid",
  "primaryimageurl",
  "title",
  "people",
  "description",
  "labeltext",
  "creditline",
  "culture",
  "dated",
  "classification",
  "medium",
  "technique",
  "dimensions",
  "url",
];

interface FetchParams {
  page?: number;
  size?: number;
}

export default class ArtImagesService {
  public async fetchImages({ page = 1, size = DEFAULT_PAGE_SIZE }: FetchParams = {}): Promise<HarvardArtResponse> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(size),
      page: String(page),
      sort: "random",
      hasimage: "1",
      q: DEFAULT_QUERY,
      fields: FIELDS.join(","),
    });

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch artworks: ${response.status}`);
    }

    const data: HarvardArtResponse = await response.json();
    return data;
  }

  public async searchArtworks(searchParams: ArtSearchParams): Promise<HarvardArtResponse> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(searchParams.size || DEFAULT_PAGE_SIZE),
      page: String(searchParams.page || 1),
      hasimage: "1",
      fields: FIELDS.join(","),
    });

    const queryParts: string[] = [DEFAULT_QUERY];

    if (searchParams.keyword) {
      params.set("keyword", searchParams.keyword);
    }
    if (searchParams.artist) {
      queryParts.push(`person:${searchParams.artist}`);
    }
    if (searchParams.culture) {
      params.set("culture", searchParams.culture);
    }
    if (searchParams.classification) {
      params.set("classification", searchParams.classification);
    }
    if (searchParams.century) {
      params.set("century", searchParams.century);
    }
    if (searchParams.medium) {
      params.set("medium", searchParams.medium);
    }

    params.set("q", queryParts.join(" AND "));

    if (searchParams.sort) {
      params.set("sort", searchParams.sort);
      params.set("sortorder", searchParams.sortorder || "desc");
    }

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    return response.json();
  }

  public async fetchArtworkById(id: number): Promise<HarvardArtRecord | null> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      fields: FIELDS.join(","),
    });

    const response = await fetch(`${API_ENDPOINT}/${id}?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch artwork: ${response.status}`);
    }

    return response.json();
  }

  public async fetchFacet(
    facet: "classification" | "culture" | "century" | "medium",
    size = 50
  ): Promise<{ name: string; count: number }[]> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(size),
      sort: "objectcount",
      sortorder: "desc",
    });

    const response = await fetch(
      `https://api.harvardartmuseums.org/${facet}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ${facet} facets: ${response.status}`);
    }

    const data = await response.json();
    return (data.records || []).map((r: { name: string; objectcount: number }) => ({
      name: r.name,
      count: r.objectcount,
    }));
  }
}

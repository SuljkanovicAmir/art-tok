import type { ArtSource, ArtSourceFeedOptions, ArtSourceFeedResult, ArtSourceSearchOptions, FacetItem } from "./types";
import type { ArtPiece, HarvardArtResponse } from "../types/art";
import { mapArtRecord } from "../utils/mapArtRecord";

const API_ENDPOINT = "https://api.harvardartmuseums.org/object";
const API_KEY = import.meta.env.VITE_HARVARD_API_KEY as string;
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
  "images",
  "datebegin",
  "dateend",
  "department",
  "period",
  "style",
  "tags",
  "colors",
  "gallery",
];

export class HarvardAdapter implements ArtSource {
  readonly name = "Harvard Art Museums";
  readonly id = "harvard" as const;

  async fetchFeed(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(options.size),
      page: String(options.page),
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
    const pieces = data.records
      .map((r) => mapArtRecord(r))
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: Boolean(data.info?.next) || pieces.length > 0,
      total: data.info?.totalrecords,
    };
  }

  async search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      size: String(options.size),
      page: String(options.page),
      hasimage: "1",
      fields: FIELDS.join(","),
    });

    const queryParts: string[] = [DEFAULT_QUERY];

    if (options.keyword) {
      params.set("keyword", options.keyword);
    }
    if (options.culture) {
      params.set("culture", options.culture);
    }
    if (options.classification) {
      params.set("classification", options.classification);
    }
    if (options.century) {
      params.set("century", options.century);
    }
    if (options.medium) {
      params.set("medium", options.medium);
    }

    params.set("q", queryParts.join(" AND "));

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data: HarvardArtResponse = await response.json();
    const pieces = data.records
      .map((r) => mapArtRecord(r))
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: Boolean(data.info?.next),
      total: data.info?.totalrecords,
    };
  }

  async fetchById(id: number): Promise<ArtPiece | null> {
    const params = new URLSearchParams({
      apikey: API_KEY,
      fields: FIELDS.join(","),
    });

    const response = await fetch(`${API_ENDPOINT}/${id}?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch artwork: ${response.status}`);
    }

    const record = await response.json();
    return mapArtRecord(record);
  }

  async fetchFacet(facet: string, size: number): Promise<FacetItem[]> {
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

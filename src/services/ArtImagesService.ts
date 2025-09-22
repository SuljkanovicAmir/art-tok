import type { HarvardArtResponse } from "../types/art";

const API_ENDPOINT = "https://api.harvardartmuseums.org/object";
const API_KEY = "6c508855-dcac-4b25-a405-42f8581b8070";
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
}

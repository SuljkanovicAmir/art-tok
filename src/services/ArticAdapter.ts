import type {
  ArtSource,
  ArtSourceFeedOptions,
  ArtSourceFeedResult,
  ArtSourceSearchOptions,
  FacetItem,
} from "./types";
import type { ArtPiece } from "../types/art";

const API_BASE = "https://api.artic.edu/api/v1";
const IIIF_BASE = "https://www.artic.edu/iiif/2";

const FIELDS = [
  "id",
  "title",
  "artist_display",
  "image_id",
  "thumbnail",
  "description",
  "short_description",
  "place_of_origin",
  "date_display",
  "date_start",
  "date_end",
  "classification_title",
  "medium_display",
  "dimensions",
  "api_link",
  "style_title",
  "subject_titles",
  "department_title",
  "is_public_domain",
  "credit_line",
  "gallery_title",
  "gallery_id",
  "is_on_view",
  "color",
  "alt_image_ids",
].join(",");

interface ArticArtwork {
  id: number;
  title: string;
  artist_display: string;
  image_id: string | null;
  thumbnail: { alt_text?: string; lqip?: string; width?: number; height?: number } | null;
  description: string | null;
  short_description: string | null;
  place_of_origin: string | null;
  date_display: string | null;
  date_start: number | null;
  date_end: number | null;
  classification_title: string | null;
  medium_display: string | null;
  dimensions: string | null;
  api_link: string | null;
  style_title: string | null;
  subject_titles: string[] | null;
  department_title: string | null;
  is_public_domain: boolean;
  credit_line: string | null;
  gallery_title: string | null;
  gallery_id: number | null;
  is_on_view: boolean;
  color: { h: number; l: number; s: number; percentage: number; population: number } | null;
  alt_image_ids: string[] | null;
}

interface ArticSearchResponse {
  pagination: {
    total: number;
    total_pages: number;
    current_page: number;
  };
  data: ArticArtwork[];
}

function imageUrl(imageId: string | null): string | null {
  if (!imageId) return null;
  return `${IIIF_BASE}/${imageId}/full/843,/0/default.jpg`;
}

function mapArticArtwork(aw: ArticArtwork): ArtPiece | null {
  const img = imageUrl(aw.image_id);
  if (!img) return null;

  // Strip HTML tags from description
  const rawDesc = aw.description?.replace(/<[^>]*>/g, "").trim();

  return {
    id: aw.id,
    imageUrl: img,
    title: aw.title || "Untitled",
    artist: aw.artist_display || "Unknown artist",
    source: "artic" as const,
    description: rawDesc || undefined,
    shortDescription: aw.short_description?.replace(/<[^>]*>/g, "").trim() || undefined,
    lqip: aw.thumbnail?.lqip || undefined,
    culture: aw.place_of_origin || undefined,
    dated: aw.date_display || undefined,
    dateStart: aw.date_start ?? undefined,
    dateEnd: aw.date_end ?? undefined,
    classification: aw.classification_title || undefined,
    styleTitle: aw.style_title || undefined,
    tags: aw.subject_titles?.length ? aw.subject_titles : undefined,
    department: aw.department_title || undefined,
    medium: aw.medium_display || undefined,
    dimensions: aw.dimensions || undefined,
    isPublicDomain: aw.is_public_domain,
    creditLine: aw.credit_line || undefined,
    galleryInfo: aw.gallery_title || undefined,
    isOnView: aw.is_on_view,
    dominantColor: aw.color ? { h: aw.color.h, s: aw.color.s, l: aw.color.l } : undefined,
    additionalImages: aw.alt_image_ids?.length
      ? aw.alt_image_ids.map(imgId => `${IIIF_BASE}/${imgId}/full/843,/0/default.jpg`)
      : undefined,
    url: `https://www.artic.edu/artworks/${aw.id}`,
  };
}

export class ArticAdapter implements ArtSource {
  readonly name = "Art Institute of Chicago";
  readonly id = "artic" as const;

  async fetchFeed(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult> {
    // Use GET search — avoids CORS preflight issues with POST
    const params = new URLSearchParams({
      q: "*",
      page: String(options.page),
      limit: String(options.size),
      fields: FIELDS,
    });

    const response = await fetch(
      `${API_BASE}/artworks/search?${params.toString()}`
    );

    if (!response.ok) throw new Error(`AIC feed failed: ${response.status}`);

    const data: ArticSearchResponse = await response.json();
    const pieces = data.data
      .map(mapArticArtwork)
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: data.pagination.current_page < data.pagination.total_pages,
      total: data.pagination.total,
    };
  }

  async search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult> {
    const queryParts: string[] = [];
    if (options.keyword) queryParts.push(options.keyword);
    if (options.culture) queryParts.push(options.culture);
    if (options.classification) queryParts.push(options.classification);
    if (options.century) queryParts.push(options.century);
    if (options.medium) queryParts.push(options.medium);

    const params = new URLSearchParams({
      q: queryParts.join(" ") || "*",
      page: String(options.page),
      limit: String(options.size),
      fields: FIELDS,
    });

    const response = await fetch(
      `${API_BASE}/artworks/search?${params.toString()}`
    );

    if (!response.ok) throw new Error(`AIC search failed: ${response.status}`);

    const data: ArticSearchResponse = await response.json();
    const pieces = data.data
      .map(mapArticArtwork)
      .filter((p): p is ArtPiece => p !== null);

    return {
      pieces,
      hasNext: data.pagination.current_page < data.pagination.total_pages,
      total: data.pagination.total,
    };
  }

  async fetchById(id: number): Promise<ArtPiece | null> {
    const response = await fetch(`${API_BASE}/artworks/${id}?fields=${FIELDS}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`AIC fetchById failed: ${response.status}`);
    }

    const data: { data: ArticArtwork } = await response.json();
    return mapArticArtwork(data.data);
  }

  async fetchFacet(facet: string, size: number): Promise<FacetItem[]> {
    // AIC aggregations require POST with Elasticsearch DSL which hits CORS issues.
    // Facets are served by Harvard's dedicated facet endpoints instead.
    void facet; void size;
    return [];
  }
}

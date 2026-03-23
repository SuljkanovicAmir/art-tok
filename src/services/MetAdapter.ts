import type {
  ArtSource,
  ArtSourceFeedOptions,
  ArtSourceFeedResult,
  ArtSourceSearchOptions,
  FacetItem,
} from "./types";
import type { ArtPiece } from "../types/art";

const API_BASE = "https://collectionapi.metmuseum.org/public/collection/v1";

/** Max concurrent object fetches per page to stay polite */
const BATCH_SIZE = 8;

interface MetObject {
  objectID: number;
  title: string;
  artistDisplayName: string;
  primaryImage: string;
  primaryImageSmall: string;
  culture: string;
  objectDate: string;
  classification: string;
  medium: string;
  dimensions: string;
  objectURL: string;
  department: string;
  artistBeginDate: string;
  artistEndDate: string;
  isPublicDomain: boolean;
  additionalImages: string[];
  tags: { term: string; AAT_URL?: string; Wikidata_URL?: string }[] | null;
  artistDisplayBio: string;
  GalleryNumber: string;
  creditLine: string;
  objectBeginDate: number;
  objectEndDate: number;
  rightsAndReproduction: string;
}

interface MetSearchResponse {
  total: number;
  objectIDs: number[] | null;
}

interface MetDepartment {
  departmentId: number;
  displayName: string;
}

function mapMetObject(obj: MetObject): ArtPiece | null {
  const imageUrl = obj.primaryImage || obj.primaryImageSmall;
  if (!imageUrl) return null;

  return {
    id: obj.objectID,
    imageUrl,
    title: obj.title || "Untitled",
    artist: obj.artistDisplayName || "Unknown artist",
    source: "met" as const,
    description: undefined,
    culture: obj.culture || undefined,
    dated: obj.objectDate || undefined,
    classification: obj.classification || undefined,
    medium: obj.medium || undefined,
    dimensions: obj.dimensions || undefined,
    url: obj.objectURL || undefined,
    artistBio: obj.artistDisplayBio || undefined,
    tags: obj.tags?.map(t => t.term).filter(Boolean) || undefined,
    additionalImages: obj.additionalImages?.length ? obj.additionalImages : undefined,
    isPublicDomain: obj.isPublicDomain,
    creditLine: obj.creditLine || undefined,
    department: obj.department || undefined,
    galleryInfo: obj.GalleryNumber ? `Gallery ${obj.GalleryNumber}` : undefined,
    isOnView: Boolean(obj.GalleryNumber),
    dateStart: obj.objectBeginDate || undefined,
    dateEnd: obj.objectEndDate || undefined,
  };
}

async function fetchObject(id: number): Promise<ArtPiece | null> {
  try {
    const response = await fetch(`${API_BASE}/objects/${id}`);
    if (!response.ok) return null;
    const obj: MetObject = await response.json();
    return mapMetObject(obj);
  } catch {
    return null;
  }
}

/**
 * Fetch objects in parallel from a slice of IDs.
 * Filters out null (no image / fetch failure).
 */
async function batchFetchObjects(ids: number[]): Promise<ArtPiece[]> {
  const results = await Promise.allSettled(ids.map(fetchObject));
  const pieces: ArtPiece[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) pieces.push(r.value);
  }
  return pieces;
}

export class MetAdapter implements ArtSource {
  readonly name = "The Metropolitan Museum of Art";
  readonly id = "met" as const;

  /**
   * Feed: search highlights with images, paginate through ID list.
   * Met search returns ALL matching IDs at once; we use BATCH_SIZE as effective
   * page size to limit concurrent requests while not skipping any IDs.
   */
  async fetchFeed(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult> {
    const response = await fetch(
      `${API_BASE}/search?hasImages=true&isHighlight=true&q=*`
    );
    if (!response.ok) throw new Error(`Met feed failed: ${response.status}`);

    const data: MetSearchResponse = await response.json();
    const allIds = data.objectIDs ?? [];

    // Use BATCH_SIZE as effective page size so we don't skip IDs
    const effectiveSize = Math.min(options.size, BATCH_SIZE);
    const start = (options.page - 1) * effectiveSize;
    const pageIds = allIds.slice(start, start + effectiveSize);

    const pieces = await batchFetchObjects(pageIds);

    return {
      pieces,
      hasNext: start + effectiveSize < allIds.length,
      total: data.total,
    };
  }

  async search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult> {
    const params = new URLSearchParams({ hasImages: "true" });

    const queryParts: string[] = [];
    if (options.keyword) queryParts.push(options.keyword);
    if (options.culture) queryParts.push(options.culture);
    if (options.classification) queryParts.push(options.classification);
    if (options.century) queryParts.push(options.century);
    if (options.medium) queryParts.push(options.medium);

    params.set("q", queryParts.join(" ") || "*");

    const response = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!response.ok) throw new Error(`Met search failed: ${response.status}`);

    const data: MetSearchResponse = await response.json();
    const allIds = data.objectIDs ?? [];

    const effectiveSize = Math.min(options.size, BATCH_SIZE);
    const start = (options.page - 1) * effectiveSize;
    const pageIds = allIds.slice(start, start + effectiveSize);

    const pieces = await batchFetchObjects(pageIds);

    return {
      pieces,
      hasNext: start + effectiveSize < allIds.length,
      total: data.total,
    };
  }

  async fetchById(id: number): Promise<ArtPiece | null> {
    return fetchObject(id);
  }

  async fetchFacet(facet: string, size: number): Promise<FacetItem[]> {
    // Met only exposes departments as a facet-like endpoint
    if (facet !== "department") return [];

    const response = await fetch(`${API_BASE}/departments`);
    if (!response.ok) return [];

    const data: { departments: MetDepartment[] } = await response.json();
    return data.departments.slice(0, size).map((d) => ({
      name: d.displayName,
      count: 0,
    }));
  }
}

import type { ArtPiece } from "../types/art";

export interface ArtSourceFeedOptions {
  page: number;
  size: number;
}

export interface ArtSourceSearchOptions {
  keyword?: string;
  culture?: string;
  classification?: string;
  century?: string;
  medium?: string;
  page: number;
  size: number;
}

export interface ArtSourceFeedResult {
  pieces: ArtPiece[];
  hasNext: boolean;
  total?: number;
}

export interface FacetItem {
  name: string;
  count: number;
}

export interface ArtSource {
  readonly name: string;
  readonly id: 'harvard' | 'met' | 'artic';
  fetchFeed(options: ArtSourceFeedOptions): Promise<ArtSourceFeedResult>;
  search(options: ArtSourceSearchOptions): Promise<ArtSourceFeedResult>;
  fetchById(id: number): Promise<ArtPiece | null>;
  fetchFacet(facet: string, size: number): Promise<FacetItem[]>;
}

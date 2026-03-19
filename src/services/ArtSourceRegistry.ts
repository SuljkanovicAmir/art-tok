import type { ArtSource, ArtSourceFeedOptions, ArtSourceFeedResult, ArtSourceSearchOptions, FacetItem } from "./types";
import type { ArtPiece, ArtSourceId } from "../types/art";

export class ArtSourceRegistry {
  private sources: Map<ArtSourceId, ArtSource> = new Map();

  register(source: ArtSource): void {
    this.sources.set(source.id, source);
  }

  getSource(id: ArtSourceId): ArtSource | undefined {
    return this.sources.get(id);
  }

  getAllSources(): ArtSource[] {
    return Array.from(this.sources.values());
  }

  async fetchFeed(options: ArtSourceFeedOptions, sourceId?: ArtSourceId): Promise<ArtSourceFeedResult> {
    const source = sourceId ? this.sources.get(sourceId) : this.sources.values().next().value;
    if (!source) throw new Error("No art source available");
    return source.fetchFeed(options);
  }

  async search(options: ArtSourceSearchOptions, sourceId?: ArtSourceId): Promise<ArtSourceFeedResult> {
    const source = sourceId ? this.sources.get(sourceId) : this.sources.values().next().value;
    if (!source) throw new Error("No art source available");
    return source.search(options);
  }

  async fetchById(id: number, sourceId?: ArtSourceId): Promise<ArtPiece | null> {
    if (sourceId) {
      const source = this.sources.get(sourceId);
      if (!source) return null;
      return source.fetchById(id);
    }
    for (const source of this.sources.values()) {
      const result = await source.fetchById(id);
      if (result) return result;
    }
    return null;
  }

  async fetchFacet(facet: string, size: number, sourceId?: ArtSourceId): Promise<FacetItem[]> {
    const source = sourceId ? this.sources.get(sourceId) : this.sources.values().next().value;
    if (!source) throw new Error("No art source available");
    return source.fetchFacet(facet, size);
  }
}

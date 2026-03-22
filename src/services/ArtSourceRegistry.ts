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

  /**
   * Fetch feed from a single source, or aggregate from ALL sources.
   * When aggregating, pieces are interleaved so no single source dominates.
   */
  async fetchFeed(options: ArtSourceFeedOptions, sourceId?: ArtSourceId): Promise<ArtSourceFeedResult> {
    if (sourceId) {
      const source = this.sources.get(sourceId);
      if (!source) throw new Error(`Art source "${sourceId}" not found`);
      return source.fetchFeed(options);
    }

    // Aggregate from all sources in parallel
    const sources = this.getAllSources();
    if (sources.length === 0) throw new Error("No art source available");
    if (sources.length === 1) return sources[0].fetchFeed(options);

    const results = await Promise.allSettled(
      sources.map((s) => s.fetchFeed(options))
    );

    return this.mergeResults(results);
  }

  /**
   * Search a single source, or aggregate from ALL sources.
   */
  async search(options: ArtSourceSearchOptions, sourceId?: ArtSourceId): Promise<ArtSourceFeedResult> {
    if (sourceId) {
      const source = this.sources.get(sourceId);
      if (!source) throw new Error(`Art source "${sourceId}" not found`);
      return source.search(options);
    }

    const sources = this.getAllSources();
    if (sources.length === 0) throw new Error("No art source available");
    if (sources.length === 1) return sources[0].search(options);

    const results = await Promise.allSettled(
      sources.map((s) => s.search(options))
    );

    return this.mergeResults(results);
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

  /**
   * Merge results from multiple sources by interleaving pieces
   * so the feed feels diverse (Harvard, Met, AIC, Harvard, Met, AIC...).
   */
  private mergeResults(
    settled: PromiseSettledResult<ArtSourceFeedResult>[]
  ): ArtSourceFeedResult {
    const buckets: ArtPiece[][] = [];
    let hasNext = false;
    let total = 0;

    for (const result of settled) {
      if (result.status === "fulfilled") {
        buckets.push(result.value.pieces);
        if (result.value.hasNext) hasNext = true;
        if (result.value.total) total += result.value.total;
      }
    }

    // Interleave: round-robin from each bucket
    const merged: ArtPiece[] = [];
    const maxLen = Math.max(...buckets.map((b) => b.length), 0);

    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (i < bucket.length) {
          merged.push(bucket[i]);
        }
      }
    }

    return { pieces: merged, hasNext, total };
  }
}

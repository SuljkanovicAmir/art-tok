import { action, makeObservable, observable, runInAction } from "mobx";
import ArtImagesService from "../services/ArtImagesService";
import type { ArtPiece } from "../types/art";
import { mapArtRecord } from "../utils/mapArtRecord";

class ArtImagesStore {
  private artImagesService: ArtImagesService;

  @observable.shallow artPieces: ArtPiece[] = [];
  @observable isLoading = false;
  @observable isInitialLoad = true;
  @observable hasMore = true;
  @observable error: string | null = null;
  @observable private page = 1;

  constructor() {
    makeObservable(this);
    this.artImagesService = new ArtImagesService();
  }

  @action.bound
  resetFeed() {
    this.artPieces = [];
    this.isLoading = false;
    this.isInitialLoad = true;
    this.hasMore = true;
    this.error = null;
    this.page = 1;
  }

  @action.bound
  async fetchNextPage() {
    if (this.isLoading || (!this.hasMore && !this.isInitialLoad)) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const response = await this.artImagesService.fetchImages({ page: this.page });

      runInAction(() => {
        const mappedRecords = response.records
          .map((record) => mapArtRecord(record))
          .filter((piece): piece is ArtPiece => Boolean(piece));

        const existingIds = new Set(this.artPieces.map((piece) => piece.id));
        const uniqueRecords = mappedRecords.filter((piece) => !existingIds.has(piece.id));

        if (uniqueRecords.length) {
          this.artPieces.push(...uniqueRecords);
        }

        this.page += 1;
        this.hasMore = Boolean(response.info?.next) || uniqueRecords.length > 0;

        if (!this.hasMore && !this.artPieces.length) {
          this.error = "No artworks available at the moment.";
        }
      });
    } catch (error) {
      console.error("Error fetching art images", error);
      runInAction(() => {
        this.error = "Unable to load art right now. Please try again.";
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
        this.isInitialLoad = false;
      });
    }
  }

}

const artImagesStore = new ArtImagesStore();
export default artImagesStore;

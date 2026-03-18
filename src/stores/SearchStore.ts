import { action, makeObservable, observable, runInAction } from "mobx";
import ArtImagesService from "../services/ArtImagesService";
import type { ArtPiece, ArtSearchParams } from "../types/art";
import { mapArtRecord } from "../utils/mapArtRecord";

class SearchStore {
  private service = new ArtImagesService();

  @observable query = "";
  @observable results: ArtPiece[] = [];
  @observable isLoading = false;
  @observable hasMore = false;
  @observable error: string | null = null;
  @observable totalResults = 0;
  @observable private page = 1;
  @observable private currentParams: ArtSearchParams = {};

  constructor() {
    makeObservable(this);
  }

  @action.bound
  async search(params: ArtSearchParams) {
    this.currentParams = params;
    this.query = params.keyword || "";
    this.page = 1;
    this.results = [];
    this.isLoading = true;
    this.error = null;

    try {
      const response = await this.service.searchArtworks({ ...params, page: 1 });
      runInAction(() => {
        this.results = response.records
          .map((r) => mapArtRecord(r))
          .filter((p): p is ArtPiece => p !== null);
        this.totalResults = response.info.totalrecords;
        this.hasMore = Boolean(response.info.next);
        this.page = 2;
      });
    } catch {
      runInAction(() => {
        this.error = "Search failed. Please try again.";
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  @action.bound
  async loadMore() {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;

    try {
      const response = await this.service.searchArtworks({
        ...this.currentParams,
        page: this.page,
      });
      runInAction(() => {
        const newPieces = response.records
          .map((r) => mapArtRecord(r))
          .filter((p): p is ArtPiece => p !== null);
        this.results.push(...newPieces);
        this.hasMore = Boolean(response.info.next);
        this.page += 1;
      });
    } catch {
      runInAction(() => {
        this.error = "Failed to load more results.";
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  @action.bound
  reset() {
    this.query = "";
    this.results = [];
    this.isLoading = false;
    this.hasMore = false;
    this.error = null;
    this.totalResults = 0;
    this.page = 1;
    this.currentParams = {};
  }
}

const searchStore = new SearchStore();
export default searchStore;

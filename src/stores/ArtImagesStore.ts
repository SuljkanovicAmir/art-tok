import { action, makeObservable, observable, runInAction } from "mobx";
import ArtImagesService from "../services/ArtImagesService";

class ArtImagesStore {
  private artImagesService: ArtImagesService;

  @observable data: string[] = [];
  @observable isLoading: boolean = false;

  constructor() {
    makeObservable(this);
    this.artImagesService = new ArtImagesService();
  }

  @action.bound
  async fetchArtImages() {
    this.isLoading = true;
    try {
      const response = await this.artImagesService.fetchImages();
      runInAction(() => {
        this.data = response.records
          .filter((data: any) => data.primaryimageurl)
          .map((record: any) => record.primaryimageurl);
        console.log(this.data);
      });
    } catch (error) {
      console.error("Error fetching art images", error);
      throw error;
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }
}

const artImagesStore = new ArtImagesStore();
export default artImagesStore;

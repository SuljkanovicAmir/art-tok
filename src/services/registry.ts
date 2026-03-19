import { ArtSourceRegistry } from "./ArtSourceRegistry";
import { HarvardAdapter } from "./HarvardAdapter";

export const artRegistry = new ArtSourceRegistry();
artRegistry.register(new HarvardAdapter());

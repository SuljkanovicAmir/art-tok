import { ArtSourceRegistry } from "./ArtSourceRegistry";
import { HarvardAdapter } from "./HarvardAdapter";
import { MetAdapter } from "./MetAdapter";
import { ArticAdapter } from "./ArticAdapter";

export const artRegistry = new ArtSourceRegistry();
artRegistry.register(new HarvardAdapter());
artRegistry.register(new MetAdapter());
artRegistry.register(new ArticAdapter());

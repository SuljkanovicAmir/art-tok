export interface HarvardArtInfo {
  page: number;
  pages: number;
  totalrecords: number;
  next?: string;
}

export interface HarvardArtPerson {
  name?: string;
  prefix?: string;
  role?: string;
}

export interface HarvardArtRecord {
  objectid: number;
  title?: string;
  primaryimageurl?: string;
  images?: { baseimageurl?: string }[];
  people?: HarvardArtPerson[];
  description?: string;
  labeltext?: string;
  creditline?: string;
  culture?: string;
  dated?: string;
  datebegin?: number;
  dateend?: number;
  classification?: string;
  department?: string;
  medium?: string;
  technique?: string;
  dimensions?: string;
  url?: string;
  accessionmethod?: string;
  period?: string;
  style?: string;
  tags?: { tag: string }[];
  colors?: { color: string; css3: string; hue: string; percent: number }[];
  gallery?: { gallerynumber?: string; name?: string };
}

export interface HarvardArtResponse {
  info: HarvardArtInfo;
  records: HarvardArtRecord[];
}

export interface ArtSearchParams {
  keyword?: string;
  artist?: string;
  culture?: string;
  classification?: string;
  century?: string;
  medium?: string;
  page?: number;
  size?: number;
  sort?: string;
  sortorder?: string;
}

export type ArtSourceId = 'harvard' | 'met' | 'artic';

export interface ArtPiece {
  id: number;
  imageUrl: string;
  title: string;
  artist: string;
  source: ArtSourceId;
  // Core metadata
  description?: string;
  shortDescription?: string;
  culture?: string;
  dated?: string;
  dateStart?: number;
  dateEnd?: number;
  classification?: string;
  medium?: string;
  dimensions?: string;
  url?: string;
  // Artist info
  artistBio?: string;
  // Categorization
  tags?: string[];
  department?: string;
  styleTitle?: string;
  // Visual
  additionalImages?: string[];
  dominantColor?: { h: number; s: number; l: number };
  lqip?: string;
  // Rights & provenance
  isPublicDomain?: boolean;
  creditLine?: string;
  // Museum location
  galleryInfo?: string;
  isOnView?: boolean;
}

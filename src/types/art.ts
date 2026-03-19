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
  people?: HarvardArtPerson[];
  description?: string;
  labeltext?: string;
  creditline?: string;
  culture?: string;
  dated?: string;
  classification?: string;
  medium?: string;
  technique?: string;
  dimensions?: string;
  url?: string;
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

export type ArtSourceId = 'harvard' | 'met' | 'artic' | 'rijks';

export interface ArtPiece {
  id: number;
  imageUrl: string;
  title: string;
  artist: string;
  source: ArtSourceId;
  description?: string;
  culture?: string;
  dated?: string;
  classification?: string;
  medium?: string;
  dimensions?: string;
  url?: string;
}

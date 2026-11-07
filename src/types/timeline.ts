export interface TimelinePainting {
  id: number;
  title: string;
  artist: string;
  /** Year used for ordering and shown after placement */
  year: number;
}

export interface PlacedPainting {
  painting: TimelinePainting;
  /** Null for the starting painting, which is placed for the player */
  correct: boolean | null;
}

export interface TimelineRecord {
  puzzle: number;
  score: number;
  /** Result of each placement, in the order played */
  marks: boolean[];
}

export interface Challenge {
  puzzle: number;
  score: number;
}
